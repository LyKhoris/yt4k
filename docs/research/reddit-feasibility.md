# Reddit quality-selection feasibility

Research date: 2026-11-13 (environment date; manifest responses reported `Date: Sat, 14 Nov 2026 07:07:14 GMT`). The initial research below was source-only; subsequent live exploration and the **implemented, live-tested packaged-MP4 adapter** are recorded chronologically at the end. No access-control bypasses were used.

## Verdict

**Current outcome:** a narrow `www.reddit.com` packaged-MP4 controller adapter is implemented and live-verified; see [Implementation and autonomous integration proof](#implementation-and-autonomous-integration-proof). HLS, inaccessible controllers and unknown dimensions are deliberately unsupported. The original research verdict follows for historical context.

**Conditionally feasible for native Reddit video as best-effort “select the highest exposed, playable rendition whose actual height is ≤2160.” Not yet verified against Reddit's current player, and not a universal/hard 4K cap.** Start with a small, isolated Reddit adapter using the existing player's quality controls; do not replace playback or intercept all network traffic. Cross-origin embeds and unsupported players should initially be explicitly out of scope.

The media plumbing is verified: Reddit documents DASH, HLS and direct-video URLs, and public manifests retrieved below contain selectable representations. What remains unverified is the bridge into today's feed/post player: accessible quality UI, exposed controller, lifecycle, and whether manual selection persists. DASH availability does **not** prove Reddit uses dash.js; HLS availability does **not** prove it uses hls.js. [R1, M1–M4]

## Current repository constraints

- [`README.md`](../../README.md), lines 3–15 and 35–44, promises YouTube-only API-first/menu-fallback selection, ≤2160p, zero dependencies and `@grant none`.
- [`yt4k-1.2.0.user.js`](../../yt4k-1.2.0.user.js), lines 7–12, matches only `www.youtube.com`/`m.youtube.com`, excludes YouTube embeds, runs at `document-idle`, and has `@noframes`.
- Lines 49–85 and 94–170 depend on `#movie_player`, YouTube methods and `.ytp-*` controls. Lines 176–224 depend on `?v=`, one global `lastVideoId`, and YouTube navigation events. These cannot simply be enabled on Reddit by adding `@match`.
- The file also has an existing menu-fallback defect: `waitFor(isOpen, ...)` returns a boolean, later treated as a menu element (`menu.querySelectorAll`, lines 110–116). Do not copy this into a Reddit adapter. No code was changed here.

## Verified evidence and its limits

### Native media: HLS, DASH, direct

Reddit's `RedditVideo` schema explicitly documents optional `dashUrl`, `hlsUrl`, `fallbackUrl`, dimensions and transcoding status. This is a **data schema**, not a documented browser-player quality API and not a reason to introduce Devvit/authentication into this userscript. `SecureMedia` separately represents Reddit video and oEmbed providers (example: `youtube.com`). [R1, R2]

Actual public HTTP manifest observations (no media playback/download test):

| Source | Advertised video dimensions / important details |
| --- | --- |
| [M1] `gyh95hiqc0b11/DASHPlaylist.mpd` | Representation heights 480, 360, 720, 240, in that unsorted order; relative BaseURLs such as `DASH_4_8_M`; byte-range `SegmentBase`/initialization metadata. |
| [M2] Same video's `HLSPlaylist.m3u8` | Heights 640, 768, 288, 432, 320; relative variant URLs and separate I-frame entries. Not the same ladder as M1. |
| [M3] `a2mdj5d57qyc1/DASHPlaylist.mpd` | Video heights 318, 390, 522, 694; separate audio AdaptationSet (64/128 audio files). `DASH_480.mp4` is **480×694**. AdaptationSet `maxHeight="1042"` does not establish a selectable 1042-height Representation in this response. |
| [M4] Same video's `HLSPlaylist.m3u8` | Heights 318, 390, 522, 694, 1042; variants repeat with different `AUDIO` groups referencing `HLS_AUDIO_64.m3u8` / `HLS_AUDIO_128.m3u8`. |

M2–M4 returned HTTP 200, `Access-Control-Allow-Origin: *`, `Vary: Accept-Encoding,x-reddit-video-features`, and `x-reddit-video-features: sd`. This supports trying ordinary noncredentialed CORS fetch for these public resources, **not** a claim that every Reddit asset is readable, that these are the full original upload ladders, or that browser fetch succeeds under Reddit's CSP. No feature headers/query parameters were changed to seek other variants. The first sample's ID and second sample's ID were located in yt-dlp's test fixtures [L1]; factual media claims above come from the Reddit-hosted responses themselves.

Consequences:

- Select from **actual representations/levels exposed to the active player**, using declared width/height and codec support, not array order, `maxHeight`, fallback metadata or guessed `DASH_2160.mp4` paths. The HLS spec defines `RESOLUTION` as width × height and relative URI resolution against the containing playlist. [M1–M4, H1 §4.2, §4.3.4.2]
- Define the cap literally as representation **height ≤2160**, consistent with `MAX_HEIGHT`; portrait labels/filenames can describe width instead. A short-edge “2160p” policy would be a separate requirement. Neither sample demonstrates actual 2160p or >2160p availability; do not assert Reddit universally caps at 720p/1080p or supports 4K. [M1–M4]
- A direct file offers no generic ladder-selection interface. Replacing the player's source with a DASH video BaseURL can omit separately declared audio; switching to a raw HLS variant can lose the master playlist's audio-group association. Preserve the existing player and full audio/subtitle handling. [M3, M4, H1 §4.3.4.1–2]
- Standard `HTMLVideoElement` has read-only `videoWidth`/`videoHeight` and a `resize` event, but no universal `setQuality(2160)` or manifest-rendition enumeration. Setting HTML/CSS height merely changes layout; changing `src` invokes loading and is not an innocuous quality preference. [W1]

### Current native feed/post UI: unverified

Public `https://www.reddit.com/r/videos/` returned a JavaScript challenge; `https://www.reddit.com/r/videos/new.json?limit=3` returned 403. Stopped rather than executing/solving the challenge or seeking alternate access routes. A speculative static player-bundle URL returned 404; therefore no current Reddit player bundle was inspected. [R3, R4]

**Unknown, not established facts:** whether feed and post players share a controller; whether a `shreddit-player` component exists in the tested variant; shadow-root openness; exact quality-menu selectors/labels; available quality methods; player library/version; Reddit-specific navigation events; logged-in/mobile/old-Reddit differences. Treat component names, private properties and synthetic menu clicks as prototype discovery targets, not APIs promised by this report.

### Library capabilities, conditional on finding the actual instance

- **dash.js v4.7.4:** source exposes `getBitrateInfoListFor('video')`, `setQualityFor('video', index)` and `getQualityFor`. Its documentation explicitly warns ABR overwrites manual quality unless `autoSwitchBitrate` is false. **Current dash.js:** documentation instead recommends `getRepresentationsByType` + `setRepresentationForTypeById`; settings support `streaming.abr.autoSwitchBitrate.video = false`. Feature-detect a known instance/version; do not assume these methods exist on Reddit's DOM element. A bitrate ceiling is not a resolution ceiling. [D1–D3]
- **hls.js:** `levels` enumerates levels; `loadLevel` chooses future loaded fragments; `currentLevel` immediately switches and flushes buffered media. `autoLevelCapping` only caps ABR by **index**, and alone does not force the highest level. Error handling may reset manual selection to Auto (`preserveManualLevelOnError` defaults false). Inspect actual heights; an index cap is not necessarily a height filter across mixed ladders. These are library capabilities, not verified Reddit internals. [H2]

## Proposed least-invasive integration (design, not validated code)

1. **Separate site adapters.** Keep the existing YouTube path isolated. Initially scope Reddit matches to deliberately supported top-level hosts (start with `https://www.reddit.com/*`); do not add wildcard external hosts or enable frames globally.
2. **Discover each native player, not one player per URL.** On initial load and debounced DOM additions, track player-element + media identity in a `WeakMap`. Handle source changes, late initialization, replacement/reuse and removal. Configure near-visible/playing players only; serialize any menu interaction so one feed video's menu cannot affect another. Use bounded retry/backoff and mark success only after verification, not discovery.
3. **UI-first proof of concept, if a manual quality menu is accessible.** Within that player's controls, enumerate explicit numeric quality choices, exclude Auto/unknown and >2160, select the maximum eligible height, then reread the selected state. Avoid localized English-only matching, global settings selectors, focus theft and repeated menu flashing. If the menu lacks usable dimensions or cannot be safely scoped, report unsupported instead of guessing.
4. **Prefer a narrow controller adapter only after inspection establishes one.** A stable, accessible quality setter would avoid UI flicker. Confirm it belongs to that media element, enumerate actual heights, select an explicit level and disable video ABR where required. Do not instantiate a second dash.js/hls.js player on Reddit's video. Use the site's existing manifest/ladders; extra manifest requests should be diagnostic/fallback metadata, not automatic source replacement.
5. **SPA resilience without invented Reddit events.** Observe document plus any discovered **open** shadow roots separately; document selectors/observers do not traverse separate shadow trees. Attach media lifecycle listeners inside the relevant root. Rescan on `popstate`/`pageshow`; same-document `pushState` is not itself a `popstate` notification. DOM/player lifecycle discovery must also cover infinite feed additions without URL changes. Do not patch History or `attachShadow` unless a prototype proves it necessary. Closed roots are an unsupported boundary for this low-impact approach. [W2, W3]
6. **Verify requested vs effective quality.** Check selected UI/controller state, then `videoHeight`/`resize` after old buffered segments drain. For testing, correlate actual segment/byte-range requests with the selected representation. Log requested/applied/effective/unsupported separately; neither a successful click nor a non-Auto label proves decoded/network quality. [W1, D3, H2]

### Sandbox, grants and embeds

- UI-only operation can retain `@grant none`, zero dependencies and `document-idle`. Tampermonkey documents that `none` disables its sandbox and removes GM APIs; Violentmonkey documents the same, but its `@inject-into auto` may fall back to content context under CSP. DOM access can still work there while page JS objects are inaccessible. Test actual injection world, browser and manager combinations; `@grant none` is not a portable guarantee of access to private controller objects. [U1–U3]
- If privileged manifest networking is genuinely needed later, explicitly add `GM_xmlhttpRequest`/`GM.xmlHttpRequest`, narrowly scoped `@connect v.redd.it`, and reassess page-object access (`unsafeWindow`/manager-specific bridge). Adding grants changes the sandbox contract; a privileged fetch does not grant cross-origin iframe DOM access or bypass site authorization. The sampled public CORS headers suggest no such networking permission is necessary for the initial prototype. [U1–U4, W4]
- Keep `@noframes` initially. oEmbed providers are distinct from Reddit-hosted video. A Reddit parent script cannot inspect a cross-origin YouTube/Vimeo/etc. frame; support would require an approved provider API via `postMessage`, or a separately matched frame adapter. Merely adding Reddit matches does neither, and this script explicitly excludes YouTube embeds already. Treat Reddit-hosted iframe surfaces similarly until their origins are inspected. Avoid broadening existing embed exclusions as a side effect. [R2, W4, local metadata]

## Hard-cap limitations and risks

**Best-effort manual maximum ≠ ABR maximum ≠ “never download/decode >2160.”** `document-idle`/menu selection can occur after an initial >2160 request or buffered frames. ABR recovery, player recreation, new manifests/periods, user changes and external playback can supersede a request. Even dash.js documents retaining higher-quality buffered media on downswitch. [D3, H2, U2]

A true no-above-cap guarantee requires excluding all disallowed/unknown-dimension representations **before initial loading**, preserving audio/captions/relative URLs/codec groups, and reapplying on every recovery and source transition. That likely needs an early verified initialization hook or owned playback pipeline—not the least-invasive userscript path. Native browser HLS lacks the library controller above. If no safe representation exists, strict compliance would require refusing/pausing playback rather than allowing Auto; that behavioral change needs an explicit product decision. [W1, H1, D1–D3, H2]

Other risks: forced maximum stalls on slow networks or unsupported decoders, battery/data usage across feed players, private APIs/DOM and localization changes, state races across recycled players, CSP/injection failures, lost manual user preferences, and replacing media breaking sound/seeking/captions. These are engineering risks/inferences, not observed Reddit regressions.

## Concrete prototype verification gate / open questions

Perform later in a **fresh, disposable browser profile**, not the user's existing session; stop on login/challenge restrictions. No steps below have been performed here.

1. Inventory current top-level feed, subreddit, direct post, modal/post navigation, back/forward, infinite scrolling and recycled players. Record browser, manager, site variant, locale and authentication state. Which roots/iframes contain each player, which are open, and which hooks survive replacement?
2. Inspect only bundles actually loaded by that page and record exact URLs/version/hash. Identify controller ownership, quality enumeration/setter/event APIs or exact scoped UI controls. Is quality manual or just a preference? Does it persist after seek/fullscreen/error recovery?
3. Save the **actual requested** manifests and headers, preserving URL queries. Compare their real Representation/variant heights with UI/controller choices, including portrait media and separate audio. Does the player's available ladder differ from a bare public manifest request?
4. Start with an opt-in diagnostic harness; apply once to one visible native player. Confirm audio, subtitles, seek position, paused/muted state and playback continuity. Then repeat with multiple feed players and delayed initialization; prove no unrelated player/menu is touched.
5. Test selection fixtures with unsorted/duplicate levels `[240, 720, 1080, 1440, 2160, 4320]`, only 720/1080, only >2160, missing dimensions, unsupported codecs, portrait dimensions and same-height bitrate alternatives. Expected eligible maximum is 2160 where present, otherwise the highest safe playable height; no guessing when none is known. Verify idempotence, failure retry limits and cleanup.
6. Obtain a legitimately accessible real ≥2160 and >2160 sample, or use controlled local HLS/DASH fixtures for cap mechanics. Capture initial and subsequent requests plus effective decoded dimensions through seek, bandwidth changes, error fallback and source swaps. A local fixture proves algorithm/library behavior, **not Reddit integration**. No native Reddit 4K/8K sample was validated here.
7. Repeat Chromium/Firefox + Tampermonkey/Violentmonkey; separately evaluate native HLS where supported. Explicitly skip external embeds and unsupported roots. Decide whether the deliverable is “best exposed manual quality” or a strict pre-request cap before making README guarantees.

## Exact sources

All linked external sources were fetched/read in this research except where an access failure is explicitly stated. Moving documentation/source links describe their retrieved version, not a stable Reddit API contract.

- **R1:** Reddit, [RedditVideo schema](https://developers.reddit.com/docs/api/redditapi/models/type-aliases/RedditVideo), `@devvit/reddit v0.15.3-dev`: `dashUrl`, `hlsUrl`, `fallbackUrl`, dimensions, status.
- **R2:** Reddit, [SecureMedia schema](https://developers.reddit.com/docs/api/redditapi/models/type-aliases/SecureMedia); [Post.secureMedia](https://developers.reddit.com/docs/api/redditapi/models/classes/Post#securemedia).
- **R3:** Reddit [public feed request](https://www.reddit.com/r/videos/): challenge HTML, not usable feed/player markup.
- **R4:** Reddit [public JSON request](https://www.reddit.com/r/videos/new.json?limit=3): HTTP 403.
- **M1:** Reddit CDN [first DASH manifest](https://v.redd.it/gyh95hiqc0b11/DASHPlaylist.mpd).
- **M2:** Reddit CDN [first HLS manifest](https://v.redd.it/gyh95hiqc0b11/HLSPlaylist.m3u8).
- **M3:** Reddit CDN [second DASH manifest](https://v.redd.it/a2mdj5d57qyc1/DASHPlaylist.mpd).
- **M4:** Reddit CDN [second HLS manifest](https://v.redd.it/a2mdj5d57qyc1/HLSPlaylist.m3u8).
- **D1:** DASH-IF, [dash.js v4.7.4 MediaPlayer source](https://github.com/Dash-Industry-Forum/dash.js/blob/v4.7.4/src/streaming/MediaPlayer.js), `getBitrateInfoListFor`, `getQualityFor`, `setQualityFor` and its ABR warning.
- **D2:** DASH-IF, [current manual-quality selection](https://dashif.org/dash.js/pages/usage/abr/manual-quality-selection.html).
- **D3:** DASH-IF, [ABR settings](https://dashif.org/dash.js/pages/usage/abr/settings.html), disabling ABR, min/max **bitrate**, fast switching/buffer behavior.
- **H1:** Apple/MLB authors, [RFC 8216](https://www.rfc-editor.org/rfc/rfc8216.html#section-4.3.4.2), especially §§4.1–4.2, 4.3.4.1–2 (relative URLs, resolution, variants/audio groups).
- **H2:** video-dev, [hls.js v1 API](https://github.com/video-dev/hls.js/blob/master/docs/API.md#quality-switch-control-api), quality-control API and `preserveManualLevelOnError`.
- **W1:** WHATWG, [HTML video/media interfaces and loading](https://html.spec.whatwg.org/multipage/media.html#htmlvideoelement).
- **W2:** WHATWG, [Element.shadowRoot](https://dom.spec.whatwg.org/#dom-element-shadowroot), [mutation observers](https://dom.spec.whatwg.org/#mutation-observers), separate shadow trees.
- **W3:** WHATWG, [History API](https://html.spec.whatwg.org/multipage/nav-history-apis.html#dom-history-pushstate).
- **W4:** WHATWG, [origins](https://html.spec.whatwg.org/multipage/browsers.html#origin), [cross-origin Window access](https://html.spec.whatwg.org/multipage/nav-history-apis.html#crossoriginproperties-(-o-)), [CORS](https://fetch.spec.whatwg.org/#http-cors-protocol).
- **U1:** Tampermonkey, [@grant](https://www.tampermonkey.net/documentation.php?q=grant).
- **U2:** Violentmonkey, [metadata](https://violentmonkey.github.io/api/metadata-block/), `@run-at`, `@noframes`, `@grant`, `@inject-into`.
- **U3:** Tampermonkey, [@sandbox/injection worlds](https://www.tampermonkey.net/documentation.php?q=sandbox).
- **U4:** Tampermonkey, [GM_xmlhttpRequest](https://www.tampermonkey.net/documentation.php?q=GM_xmlhttpRequest) and its `@connect` requirement.
- **L1 (locator only, not evidence of Reddit player behavior):** [yt-dlp Reddit test fixtures](https://raw.githubusercontent.com/yt-dlp/yt-dlp/master/yt_dlp/extractor/reddit.py), IDs `gyh95hiqc0b11` / `a2mdj5d57qyc1`. No extractor/session setup logic was executed.

## Hands-on exploration

### Scope and verdict

**2026-11-13 environment date; actual browser/tool clock 2026-11-14, 07:17–07:21 UTC. Live native-player UI selection worked in Chromium on one public feed video and its post page. A general Reddit adapter, literal ≤2160-height enforcement, HLS control, and 4K playback remain unverified.** This section supplements the earlier research-only observations; it does not turn the proposed implementation above into tested production support.

Used a newly created browse session/tab named `reddit-hands-on-20261113`, with that explicit session ID on every browser execution. This was an isolated tab in the connected browser, **not a fresh browser profile**. Browser user agent reported Linux Chromium/Chrome `157.0.0.0`; English quality controls were observed. No login, account-preference controls, posts, votes, installs, userscript injection, or challenge bypasses were performed. Authentication/account details were not inspected. Tracking/performance requests reported `ERR_BLOCKED_BY_CLIENT`, but playback and first-party static-source reads succeeded. The session was deleted on completion; existing user/other-agent tabs were not used or cleaned up.

Observed public URLs:

- `https://www.reddit.com/r/videos/` loaded normally in this browser, unlike the earlier HTTP challenge. The initially inspected cards were external links, so they were not treated as native-video integration evidence.
- `https://www.reddit.com/r/Unexpected/` exposed the native video **“Nothing to worry about”**.
- `https://www.reddit.com/r/Unexpected/comments/1xvewbj/nothing_to_worry_about/` was the corresponding directly navigated post page, and also played normally.

### Live DOM and exact working controls

The tested player had these **open** roots:

```js
const player = document.querySelector('shreddit-player'); // first/main player in these tests
const video = player.shadowRoot.querySelector('video');
const ui = player.shadowRoot.querySelector('shreddit-media-ui');
const settings = ui.shadowRoot.querySelector('shreddit-video-settings');
const root = settings.shadowRoot;
```

After taking a fresh `snapshot()`, these browser/Playwright operations worked, scoped to the first inspected native player (Playwright locators traversed its open roots):

```js
const player = page.locator('shreddit-player').first();
await player.getByRole('button', { name: 'Settings', exact: true }).click();
await player.locator('[data-testid=quality-menu-button]').click();
// Inspect options and their actual source dimensions before choosing a label.
await player.locator('[data-testid=quality-option]').filter({ hasText: '540p' }).click();
```

Quality entries were `[data-testid=quality-option]`; Auto was `[data-testid=auto-quality-option]`. The selected entry contained `[data-testid=checkmark]`, rather than a verified `aria-checked` attribute. Both feed and post menus offered **Auto, 540p, 360p, 240p, 144p**. Fresh DOM reads verified the checkmark after selection. Snapshot output on the comments-heavy post omitted the player controls because of output truncation; the already inspected scoped shadow DOM was used instead of guessing global buttons.

**These labels are not rendition heights.** The live player's `packaged-media-json` attribute contained `playbackMp4s.permutations`, with H264 and VP9 sources whose actual dimensions were **218×392, 268×480, 358×640, 476×854, 714×1280**. The highest known eligible actual height was therefore **1280**, not 540. The selected source was the existing packaged H264 MP4 for that 1280-height rendition; no source was replaced by the diagnostic code. No DASH/HLS manifest request was observed for this playback path. No signed media URL, query string, token, or account data is recorded here.

### Requested, selected, effective, and continuity evidence

| Live test | Request and selected state | Effective playback / result |
| --- | --- | --- |
| Feed, first native player | Initial Auto → explicit top `540p`; only that player's menu was clicked | Checkmark moved to `540p`. A later read measured **714×1280**, `currentTime=5.972809`, `paused=false`, `readyState=4`, full 22.966667-second clip buffered. |
| Direct post, same public clip | New page initially showed `540p` selected | **714×1280** playback was present. Persistence was explained by browser-local storage, not assumed to be per-player state. |
| Post, diagnostic downswitch | `540p` → `144p` | Actual decoded dimensions became **218×392**; same player and same video element. Before action: time 3.937680; after load: 5.657871. `paused=false` and `muted=true` were retained. |
| Post, return to best known eligible rendition | `144p` → `540p`; checkmark verified | **714×1280**, `readyState=4`, no media error. Before action: time 5.716362; after load: 7.475794. Playback resumed at the current region rather than restarting the clip. |
| Cleanup | Selected Auto through `[data-testid=auto-quality-option]` | Fresh read verified Auto checkmark, browser-local quality key absent, and **714×1280**, `paused=false`, time 8.939397. |

For the post switches, temporary DOM event listeners recorded `emptied`/`loadstart` (transient time/dimensions zero), then `resize`, `loadedmetadata`, `seeking`, `seeked`, `loadeddata`, and `playing`. On the upswitch, metadata/seek resumed around **7.112427** seconds. Thus this is **source-reload-and-resume continuity**, not a seamless adaptive switch or proof of uninterrupted audio. Playback stayed muted; audible audio, captions, fullscreen, paused-state switching, recovery and bandwidth changes were not validated.

**Important UI side effect discovered:** clicking a quality option writes the browser-local key `@reddit/shreddit-player-media-quality`; after selecting the maximum it contained `540`. This explains persistence across the feed-to-post navigation. Auto removes that key. The original visible Auto selection was restored and the key's absence verified before session deletion. No account-wide settings were changed. An eventual adapter must not silently use this preference-writing UI if its contract requires strictly per-player changes; the controller path below is a discovery target, not yet a verified substitute.

### First-party loaded source: separate from live API verification

Read the actual `<script src>` resources already referenced by the accessible post with ordinary `fetch(url, { credentials: 'omit' })`; all 14 static concat responses returned HTTP 200. No guessed bundle URL or feature/access override was used. The relevant loaded response was:

`https://www.redditstatic.com/js/concat?prefix=en-US/&chunks=20iqj19X__,5c94InhXpY,6GjM15K6jx,6bOZk2qyY7,7FMm6rSc7J,BLHED5lUeY,BhLG8iAldU,C8HDW2nxHf,CHlbjg2boK,Cejw7lfx2C,CkLCT2JhR_,CzDDdQUbYK,D4aN4lphBX,D5MfeNCIiD,DPlNKANsUx,DQN2upiJjO,DbrxBinYFI,DiDnt7dEPs,DkwKr0jHAR,Iynzky-vLe,RWwhz1ezvd,bj2SZNNV8k,fqVxxLERd7,hwtx65QYOu,ikvrRysfGN,rUYCpb_QNx`

Response text length: **238654 characters**; SHA-256 of UTF-8 text: `adde3c2413405331dd3945bad786b687a8d971dc0a32083ed449dbec0ba72e26`. Player code appeared within SML module `C8HDW2nxHf`.

Source-only findings, corroborating but not replacing the live DOM evidence:

- `handleQualityChange(event, level)` calls `mediaActionsController.setQualityLevel(index)` and then a helper that writes/removes the local quality key. A separate autoplay path uses `UpdateAccountPreferences`; it was not invoked.
- The media-actions setter routes to `hlsController.setQualityLevel(index)` or `packagedMediaController.setQualityLevel(index)` according to the existing player's mode. **Neither controller was directly invoked here.** `player.mediaActionsController` was `undefined` in the tool's evaluation realm; page-world/userscript access remains unproved, not proven impossible.
- Packaged-media `createQualityLevels()` maps to `mp4SourceIndex`, sorts sources by bitrate/short-side criteria, and deduplicates display-quality buckets. Its dimension-to-label function buckets `Math.min(width, height)` into 144/240/360/480/540/720/1080, with everything ≥1080 labelled 1080. **Selecting a numeric menu label ≤2160 cannot enforce the literal height cap**, especially for portrait sources or bucketed ≥1080 sources.
- Packaged-media `setQualityLevel()` captures current time, assigns the existing selected source with a `#t=...` fragment, updates `currentQualityLevelIndex`, and calls play if it was playing. This matches the live reload/seek/resume sequence.
- Its disconnect hook clears packaged permutations/current-source state unless a media-reparent/preservation controller says to retain them. This lifecycle behavior was read in source, not exercised by a recycle/fullscreen test.

### Per-player lifecycle and remaining blocker

The feed contained **28 `shreddit-player` elements** at inspection; the direct post contained **16**, including offscreen comment-media players. All 16 post-page players carried the **same `post-id="t3_1xvewbj"`**, while their media/dimensions differed. Only the main player had the observed `player-type="post_detail_screen"`; offscreen comment players were paused and many had zero decoded dimensions. **Post ID alone is therefore not a player/media identity.** Scope by the actual player element plus media identity and initialization, not one run per page/post ID. Within the two quality switches, the main player and its video element retained identity. Feed recycling, infinite-scroll additions, SPA/modal navigation and back/forward were not tested.

No prototype file, fixture harness, automated repository test, or installed userscript was used: the evidence above is **real integration via scoped browser commands and DOM/media event reads**, not a local fixture passing. Production userscript and README remain untouched.

**Supported verdict:** a narrow UI-driven maximum selection succeeds for this native packaged-MP4 sample on feed and post, with selected-state and actual decoded-dimension verification. **Unsupported/unproved:** a general automatic Reddit implementation, a menu-label-only literal ≤2160 cap, a no-preference-write UI adapter, controller access from `@grant none`, native Reddit 2160/>2160 examples, HLS/DASH runtime control, and cross-browser/userscript-manager behavior. Next gate: verify a page-world per-player setter and map its real source indices/dimensions before applying the unchanged **height ≤2160** policy without persistent preference writes. Do not reinterpret the policy as a short-side cap.

## Implementation and autonomous integration proof

### Scope and injection world

Follow-up: **2026-11-14 07:28–07:37 UTC** (tool/system clock; environment task date remains November 13). Created a separate browse session, `reddit-adapter-proof-20261113`, with the explicit session ID on every call. This was a **new tab/session in the connected browser, not a fresh/anonymous browser profile**. Linux Chrome `157.0.0.0`, `en-US`. No existing tabs, login flow, account settings, posts or votes were used. No challenge/access gate occurred. Tracking/performance requests still reported `ERR_BLOCKED_BY_CLIENT`; ordinary native playback worked.

The earlier `page.evaluate` result (`mediaActionsController === undefined`) was an **isolated-world visibility limitation**, not evidence of an unavailable page controller. An ordinary DOM-created inline `<script>` executed in the page world and read the controller successfully. No CSP modification, nonce extraction, extension-policy change or privileged injection was needed. Diagnostic results crossed back through a temporary DOM attribute.

The **actual repository adapter** `src/platforms/reddit.js` was copied byte-for-byte to `/tmp/opencode/reddit-adapter-live.js`, read by the browser tool, and inserted inside an IIFE with a small `YT4K` contract harness. SHA-256 of the live-tested adapter:

`2da4dfed9b66a3cf336d6e995cf901a9aa1c6b180ca26daff75716810d9b87ac`

The harness provided registration, `maxHeight`, highest-valid-level selection, polling and captured `log`/`warn`; it did **not** replace the Reddit player, controller or media sources. This proves real integration of this adapter code in the **page execution world**. It does not prove a specific userscript manager injects the final bundled script into that world, nor validate the parent's shared core/bundle. In an isolated/content world the adapter feature-detects missing controller properties and makes no quality change.

### Verified controller ownership and exact index mapping

For each tested native player:

```js
const video = player.shadowRoot.querySelector('video');
const controller = player.packagedMediaController;
controller.host === player;
controller.videoElement === video;
player.mediaActionsController.host === player;
player.mediaActionsController.videoElement === video;
player.isMp4 === true;
player.isHls === false;
```

`controller.playbackPermutations` contained the **active codec's** actual source objects with `source.dimensions.{width,height}`, `bitrateBps`, `videoCodec` and the existing packaged URL. `controller.getCurrentSource()` returned one of these exact objects. This is controller data, not a dimension inferred from DOM layout or a menu label. The previously inspected `packaged-media-json` contained both H264 and VP9, but the active controller ladder contained five H264 permutations; blindly indexing the combined JSON would have been wrong.

For “Nothing to worry about”, `player.qualityLevels` was:

```js
[
  { mp4SourceIndex: 4, quality: 540 },
  { mp4SourceIndex: 3, quality: 360 },
  { mp4SourceIndex: 2, quality: 240 },
  { mp4SourceIndex: 0, quality: 144 }
]
```

Actual dimensions by controller source index were 0: **218×392**, 1: **268×480**, 2: **358×640**, 3: **476×854**, 4: **714×1280**. Source index 1 was not an exposed independent bucket. The adapter maps only the explicitly exposed `mp4SourceIndex` values into the active controller's source objects. It does not reinterpret `quality`, assume menu order, reconstruct Reddit's bucketing algorithm, or select a guessed filename. Invalid/unknown dimensions, indices and codecs are skipped.

Live `String(player.mediaActionsController.setQualityLevel)` showed the actual MP4/HLS dispatch; the MP4 route calls `packagedMediaController.setQualityLevel(index)`. The packaged setter takes a **source index**, preserves current time through `#t=...`, assigns its existing source, updates `player.currentQualityLevelIndex`, and resumes only when previously playing. The adapter invokes the media-actions setter, not source assignment of its own. Unlike the settings UI, this setter does not invoke the local-quality preference helper.

### Actual automatic playback outcomes

| Test | Controller/requested result | Independently read decoded result |
| --- | --- | --- |
| Direct post baseline, real setter diagnostic | Source index 0, local preference remained absent | **218×392**, playing, muted, no media error |
| Inject actual adapter, production `maxHeight=2160` | Automatically chose index 4; `getCurrentSource()` identity and selected index matched | **714×1280**, same video element, playing/muted; `reddit effective` emitted |
| Feed initial automatic discovery | Two visible native players independently selected index 4 | “The hotel requires you to wake up at 5 AM sharp”: **720×1280** playing; “Nothing to worry about”: **714×1280** paused; both verified |
| Scroll and later initialization | No manual menu interaction or adapter restart; further players discovered | Effective logs included **1080×1920**, **720×1046**, **360×404**, **720×890** |
| Feed → real post-link activation | Same harness/log array survived SPA navigation; newly mounted main post player automatically selected index 4 | **714×1280**, playing/muted, time **2.298462**, 16 post players present |
| Browser Back | Same adapter returned to 27-player feed, selected new/reconnected visible instances | **720×1280** playing at **34.901370**; **714×1280** paused at **9.259234** |
| Browser Forward | Same adapter selected the newly mounted post player without reinjection | **714×1280**, playing/muted at **4.186893** |
| Real literal-height filtering, diagnostic `maxHeight=800` | Restarted same actual adapter with only harness cap changed; chose **source index 2**, not the 540-labelled portrait maximum | **358×640**, playing/muted at **6.886114**; local preference absent |
| Restore production cap while paused | Paused main video, restarted actual adapter at 2160; chose index 4 | **714×1280**, **still paused**, muted, time **7.364753** |
| Infinite feed additions/removals | Scroll expanded native-player count **27 → 50**, then feed virtualization removed old players (**26** remained); adapter stayed running | Newly loaded visible “Beyond the wall”: **720×1280**, index 4; “Be careful when parking”: **640×358**, index 2; “Different types of milk”: **480×854**, index 3, playing; all decoded and selected indices verified |

The post/feed link's large overlay and fixed search header intercepted ordinary Playwright pointer clicks; the inspected real title anchor's DOM `click()` navigated successfully. This was a normal public post link, not an access-control workaround. Navigation was verified from URL, player inventory and preserved harness logs, not assumed from the click.

`@reddit/shreddit-player-media-quality` was **absent before, during and after every controller/adapter experiment**. No experimental browser-local preference needed restoration; neither the adapter nor harness writes local/account preferences. Controller selection survives independently of that absent key. Playback observations used actual `videoWidth`/`videoHeight`, `readyState` and controller-selected-source identity, not CSS dimensions or menu checkmarks. Time/paused/muted snapshots corroborate reload/resume behavior but do not establish seamless switching or audible continuity.

### Implementation behavior and repository tests

- Registers only `www.reddit.com`; supports verified packaged MP4 controllers with explicit ownership and source-identity checks. HLS/native-HLS/DASH, embeds and unknown private-API shapes remain untouched.
- Observes document/open roots for new players, polls known players for late roots/controllers, handles per-element media-ladder identity changes and disconnected players, and listens for `pageshow`/`popstate`. No history or shadow-creation monkeypatch. The live feed/SPA/infinite-scroll tests above validate automatic lifecycle handling; artificially delayed root/controller initialization is covered by fixtures, not claimed as independently forced on Reddit.
- Configures visible or playing players only. Serializes attempts per player/media identity, retries at most three times, and marks success only when selected index/source identity **and actual decoded dimensions** agree. A request without decode verification emits a warning, not success. After success, it does not continually fight user quality changes for the same player/ladder.
- Cleanup disconnects observers, clears timers/listeners and invalidates pending verification. It does not undo per-player selected quality or change preferences.
- `node --test tests/reddit.test.cjs`: **14 passed, 0 failed**. CJS `node:test`/`vm`, no dependencies. Covers literal portrait cap, unknown/string/NaN/>cap/unmapped levels, tie selection, controller ownership, active codec, multiple new open-root players, late roots/controllers, visibility, recycled media, bounded errors/no-op retries, pending-attempt serialization, decoded mismatch, removal and cleanup.

### Remaining boundaries

**This is a proven narrow integration, not a human-required blocker.** It still uses Reddit private APIs and deliberately fails closed if their shape changes. No native Reddit ≥2160 or >2160 sample was found/tested; real 800-height filtering and synthetic 2160/4320 fixtures prove their respective mechanics, not native Reddit 4K availability. HLS/DASH runtime control, native HLS, external embeds, closed roots, forced codec fallback/error recovery, bandwidth changes, fullscreen, captions and audible audio remain unvalidated/unsupported. No guarantee prevents an initial above-cap request before document-idle selection. Cross-browser, Tampermonkey/Violentmonkey and the final bundled userscript remain separate integration gates.

Final cleanup: stopped the harness/adapter, removed its temporary globals/DOM attribute, verified the browser-local quality preference was still absent, and deleted **only** `reddit-adapter-proof-20261113`. Existing user/other-agent sessions were not touched.
