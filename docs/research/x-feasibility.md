# X video quality: feasibility

> Current outcome: the shipped adapter is **API-only and no-hover**, with real
> 3840×2160 engine/decoded validation. See [the cold-load correction](#cold-loadno-hover-correction-2026-11-14-utc).
> Earlier menu-driven sections below are historical evidence, not the current implementation.

Initial research date: 2026-11-13. The initial report below was source-only. **The appended 2026-11-14 automatic-adapter validation supersedes that limitation for the explicitly tested responsive-web client and samples.** It does not establish universal X support or a startup/download ceiling.

**Latest implementation:** see **“Cold-load/no-hover correction”** below. The current adapter uses only the positively owned player's quality API. The earlier menu-coupled implementation had a real hover-dependent functional gap; its checked-menu results did not establish cold-load automatic behavior.

## Verdict

**Conditionally feasible as a separate X adapter; not a drop-in reuse of the YouTube adapter.** Public X source contains a real Settings → Quality menu, resolution-bearing HLS levels, and an internal `setQuality(levelId)` path that selects a fixed hls.js level. This supports a small UI-driven prototype. It does **not** establish a supported public player API, reliable access to controller instances, coverage of every X player, or a hard playback ceiling from the first frame. [X2–X4]

**Recommendation:** first verify a player-scoped menu adapter, preserving `@grant none`, without replacing streams or intercepting all network traffic. Require trustworthy variant dimensions before claiming the existing literal `MAX_HEIGHT = 2160` policy. If “never load/play above 2160” is mandatory, menu automation alone is insufficient: an early, fail-closed source/variant gate is a separate, more invasive project. Unknown dimensions must never be treated as eligible.

## Existing script constraints

The current [README](../../README.md) promises the highest available quality ≤2160p using YouTube API calls followed by menu automation. [`yt4k-1.2.0.user.js`](../../yt4k-1.2.0.user.js) matches only YouTube, runs at `document-idle`, uses `@grant none` and `@noframes`, finds one `#movie_player`, and keys execution on the URL's `v` parameter plus YouTube-specific navigation events (lines 7–12, 49–85, 176–224). Those selectors, APIs, quality identifiers, and orchestration cannot handle X. Keep YouTube behavior isolated; share only bounded retry/logging and dimension-based candidate selection where useful.

## Verified evidence and its boundaries

| Topic | Verified from primary sources | What remains unverified |
| --- | --- | --- |
| Current web implementation | Public `https://x.com/` HTML links a logged-out entry bundle. Its imports lead to `CNjd15tR.js` → `IB0Dz8p6.js` → `D_uhsxS3.js` (UI), and `DxAjY3tt.js` (engine). The engine dynamically imports `DOfrWPQ-.js`, whose version string is hls.js **1.7.4**. [X1–X4] | Which authenticated/A-B/legacy clients use these exact components. Do not assume historic webpack/Video.js recipes apply. |
| Menu and controller | UI function `so` renders Settings, Quality, a radio group, and calls `c.setQuality(Number(e))`; `auto` is a separate option. Engine `Fe` implements fixed selection with `p.currentLevel=e` and updates mode to `fixed`; controller `Sn` delegates `setQuality` to its HLS attachment. `MANIFEST_PARSED` records level IDs, width, height, bitrate and codecs; `LEVEL_SWITCHED` updates the selected ID. [X2, X3] | No stable documented page-global API or `video.hls` attachment was established. Controller/store references are internal to component/module closures; source existence does not mean a userscript can obtain them. React-internals traversal is a fragile hypothesis, not a recommended dependency. |
| Meaning of “2160p” | UI function `ro` labels a level with **`Math.min(width,height)`**, falling back to height; when dimensions are missing it falls back to the numeric level ID. [X2] | Labels alone cannot enforce literal height ≤2160: a hypothetical 2160×3840 portrait variant is labelled 2160p but has height 3840. A bare numeric label can be an ID, not pixels. |
| HLS versus native/file | `Dn` classifies HLS from hints/MPEGURL MIME or `.m3u8`. `Hn` uses `Fe` when `kind === 'hls' && (kn() || !On(video))`; `kn` checks `MediaSource`/`ManagedMediaSource`, `On` probes native HLS MIME support. Otherwise it assigns `video.src`. `Fe` checks `Hls.isSupported()`, then calls `loadSource`/`attachMedia`. [X3] | Do not equate Safari with native HLS or Chrome with one invariant path. This code prefers hls.js when the checked MSE APIs exist; actual platform paths need tests. Native fallback does not populate the HLS quality store in this inspected path. |
| MP4 variants | X API's Media dictionary explicitly documents multiple playback variants and gives a `video/mp4` example with `bit_rate`, `content_type`, and a `video.twimg.com/.../320x568/...mp4` URL. Top-level media width/height are separate fields. [X5] | API documentation is not proof of the current web GraphQL shape or per-variant dimensions. Do not apply original media dimensions to every encode, assume bitrate determines resolution, or assume the MP4 ladder equals the HLS ladder. No current X master playlist/MP4 bytes were retrieved in this research. |
| Feed and multiple videos | X Help documents autoplay in timelines/Explore and posts with multiple videos. Engine `VideoGroupProvider-xnMJFlsE` keeps a per-instance registry, visibility percentages and a leader, pausing other players. Engine `Mn` clears qualities on source changes. [X3, X6] | Feed, post detail, quoted posts and immersive viewer might mount, reuse, move, or replace elements/controllers differently. Full coverage was not observed. |
| Fullscreen | UI `so` listens for `fullscreenchange`, closes/repositions menus, and passes a fullscreen-aware container. Engine also tracks fullscreen/PiP and adjusts player-size capping for PiP. [X2, X3] | DOM fullscreen, X's immersive video route, and OS-native fullscreen are not interchangeable. Native controls may be outside script-addressable DOM. |

### HLS and media semantics that matter

- HLS `EXT-X-STREAM-INF` has required bandwidth information but **optional `RESOLUTION`**; resolution is width×height, not a bitrate proxy. Alternative audio/video renditions can reference separate playlists. Relative URIs resolve against the containing playlist. [H1 §§4.2, 4.3.4.1–2, 4.1]
- hls.js 1.7.4 `createVariant` copies `RESOLUTION` only when present; `Level` defaults missing width/height to **0**. Zero therefore means unknown, not safely small. [H2, H3]
- `autoLevelCapping` is an **index cap for automatic selection**, not a resolution whitelist and not a fixed-highest command. `currentLevel` selects manually and flushes buffers; `nextAutoLevel` is only a one-fragment override. `loadSource` resets the auto cap. X also supplies its own ABR/capping subclasses. Do not substitute a high bandwidth seed or assume setting one index handles unknown/disallowed entries elsewhere in the list. [H4; X3 `Ae`, `Te`, `Fe`]
- MSE lets JavaScript append media to `SourceBuffer`; a `blob:` current source need not reveal the original playlist or enumerate variants. Standard `HTMLVideoElement` has no general HLS quality-selection method. `videoWidth`/`videoHeight` report the current natural dimensions (0 when unknown), and `resize` reports changes—not all available encodes or a pre-load ceiling. [W1, W2]

## Least-invasive integration strategy (proposal, not validated)

1. **Separate site adapter.** Dispatch by hostname; add exact `https://x.com/*` matching if implemented. Add legacy Twitter host matches only if needed/tested. Keep embeds and other sites out of scope initially. Do not widen `@noframes` for a feed/post feature.
2. **Track actual players, not one URL ID.** Discover added/removed videos with a debounced `MutationObserver`; keep a `WeakMap` per element with source/content generation and cancellation. Reconsider on `loadedmetadata`, `emptied`, `play`, source replacement and fullscreen/viewer transitions. URL/history changes are supplementary: scrolling adds videos without navigation. X's source-reset behavior specifically requires invalidating prior quality state. [X3]
3. **Drive only the active player's real menu.** Find that player's Settings control; associate its portal menu via trigger/menu relationships and fullscreen container, not global text queries. Serialize menu operations, use roles/checked state, close only menus opened by the script, and avoid stealing a user's open menu/focus. Controls are conditionally mounted in `yo`; localized names, portal ownership and synthetic-click compatibility need inspection. [X2]
4. **Choose an explicit known-safe level.** Associate menu level IDs with dimensions from the actual player/manifest if a reliable read path can be demonstrated. Under the current policy, filter finite positive heights ≤2160 and select maximum height; use codec support and a deterministic same-height tie-break. Never select Auto, an unparseable ID, “highest” without dimensions, or an unknown variant. X's short-side labels alone require a narrower, explicitly different product promise. [X2, H2–H4]
5. **Verify, do not trust a click.** Re-read fixed/checked selection; where accessible compare controller level ID/dimensions and actual segment requests. Observe `videoHeight` after the switch as a secondary check. Reapply on genuine source/controller resets, with bounded attempts, not a continuous click fight. Respect explicit user overrides. Fixed maximum may stall on weak networks; falling back to Auto forfeits the cap unless its candidate set is separately restricted. [X3, H4]

**API optimization, only after discovery:** if a dependable per-player controller reference becomes available, `getState().qualities.levels` plus `setQuality(id)` is less disruptive than opening menus. Prefer X's wrapper over mutating its private HLS object so state and analytics remain consistent. The missing piece is safe discovery/lifecycle binding, not the existence of the setter. [X3]

**Not the default fallback:** replacing `video.src` with an MP4 or a child playlist, injecting a second HLS player, modifying React/webpack globals, or rewriting every `fetch`/XHR. Source replacement invokes media loading and can conflict with X's controller, prerolls, captions, time restoration, autoplay and reuse. A video-only HLS child may also lose separate audio. [W2; X3 `Hn`, preroll handling; H1 §4.3.4.2.1]

## Hard ceiling and unknown dimensions

There are two different guarantees:

- **Selection cap:** the adapter itself only requests verified levels ≤2160. A conservative menu adapter can aim for this after initialization.
- **Playback/download cap:** no >2160 rendition is loaded or played, including startup, recovery, advertisements and player replacement. An idle-time script cannot retroactively guarantee this. Even doing nothing on uncertainty leaves X's Auto playback uncontrolled.

For the second guarantee, **fail closed before first media load**: permit only verified safe variants, remove/block unknown and oversized video variants on every source generation, then explicitly select the highest eligible playable variant. If none is known, prevent playback and report unsupported/unknown—not Auto or “lowest bitrate.” A pause after `videoHeight >2160` is detection after loading, not proof of prevention. [H1–H4, W2]

Potential strict prototype: a narrowly scoped, early HLS loader/manifest adapter retaining X's existing player, with proper playlist parsing, rendition/audio preservation, URL resolution, reload handling and allowlisted video CDN requests. **Hypothesis only:** no reliable installation point was proved. Rewriting page `fetch`/XHR does not intercept browser-native HLS fetches and may miss preexisting/captured loaders; a native path needs an independently controlled safe source or explicit exclusion. `document-start` also is not universally guaranteed to precede page scripts. [X3, W1, U2]

Dimensions must come from trustworthy variant-specific metadata or a separate metadata/parser probe, not filename guessing. An unknown variant might be the true best safe rendition; excluding it preserves safety but cannot prove global optimality. Even declared manifest dimensions assume accurate metadata; adversarial/mislabeled streams or resolution changes within a rendition need media-level validation for an absolute decoded-dimension guarantee.

## Sandbox, permissions and risks

- DOM/menu automation needs no privileged GM API: retain `@grant none`. Tampermonkey and Violentmonkey document that it disables their sandbox, but injection world/CSP fallback still matters. Violentmonkey `auto` can fall back to content context, where DOM access works but page JS objects are inaccessible. Test actual manager/browser combinations; do not assume `@grant none` makes internal controllers global. [U1–U3]
- Page-level player/loader hooks require the page's JS realm and early execution. Adding GM grants changes sandbox assumptions; privileged cross-origin fetch would require deliberate grants/connection scope and does **not** automatically hook X's existing requests. Ordinary page fetch remains subject to browser cross-origin policy. Prefer no new privileges for the first prototype. [U1–U3, W2 §Security and privacy considerations]
- Main risks: changing bundles/DOM/localization; duplicate or ambiguous quality labels; unknown dimensions; absent quality UI; full/immersive/native mode differences; codec/HDR compatibility; source-reset races; multiple visible videos; focus disruption; fixed-highest bandwidth/CPU/power costs and stalls. Source inspection cannot establish available 4K renditions, account/region entitlements, or browser decoding support. X's upload guidance is not a promise of a 2160p playback ladder. [X2–X6, H4]

## Concrete prototype verification gates

These steps are **future work**, not tests performed here. Use an isolated test profile and authorized/public sample posts; stop at login/access restrictions rather than work around them.

1. Record browser, manager, X app/bundle version, feed/post/immersive/fullscreen mode, language, media/controller identity, current source kind and capability probes. Inspect actual roles and portal ownership before selecting controls.
2. Capture legitimately delivered media metadata and exact HLS master/child playlists; record status/CORS headers, `RESOLUTION`, codecs, bandwidth, audio/subtitle groups, relative URLs and absent dimensions. Compare MP4 and HLS ladders rather than assuming equivalence. Obtain a known 4K sample and, if available, an above-cap sample; missing samples must be reported.
3. Manually choose a menu quality and confirm the mapped controller level, requested rendition/segments, and eventual `videoWidth`/`videoHeight`. Verify fixed mode survives fullscreen, seek, replay, buffering recovery and resize. Establish whether internal API access is possible without framework spelunking.
4. Exercise feed scroll, two visible videos, multi-video/quoted posts, post-to-viewer transitions, back/forward, element reuse/replacement and preroll-to-content. Require no duplicate work, wrong-player menu clicks, playback restarts or lingering observers. Test native HLS and direct MP4 separately; mark unsupported paths explicitly.
5. Test selection with 1080/1440/2160/4320, portrait 2160×3840, duplicate-codec levels, audio-only variants, height 0/missing, unknown mixed among safe variants, unknown-only, no eligible level and unavailable codec. Local controlled manifests are valid algorithm tests, **not X live validation**.
6. For strict mode, instrument from first request on cold load/SPA insertion: no unsafe or unknown video segment may be requested, even on fallback/reload. Test missing metadata, denied CORS, early startup races and native playback. If this fails, ship only an accurately described selection preference—or do not claim strict support.

## Primary sources and reproducibility

All sources below were fetched during this research. Minified source references use exact function/symbol search anchors because line numbers are not useful. Public bundles may disappear/change; the inspected X homepage app version was `6cb4de35277fec64115cbb8cd5089663958ffae5`.

- **[X1]** [X homepage](https://x.com/), linked [logged-out entry](https://abs.twimg.com/x-web/x-web/entry-client-logged-out-55cOzWTe.js), [route/component bundle](https://abs.twimg.com/x-web/x-web/assets/CNjd15tR.js), [player UI entry](https://abs.twimg.com/x-web/x-web/assets/IB0Dz8p6.js). Follow imports, not guessed historic chunk names.
- **[X2]** [X player UI source `D_uhsxS3.js`](https://abs.twimg.com/x-web/x-web/assets/D_uhsxS3.js): `function ro()`, `function so(e)`, `function yo(e)`, `Math.min(r,n)`, `c.setQuality(Number(e))`, `fullscreenchange`.
- **[X3]** [X playback source `DxAjY3tt.js`](https://abs.twimg.com/x-web/x-web/assets/DxAjY3tt.js): `function Fe(e)`, `function Sn(`, `function Hn(e)`, `function Dn(e)`, `function On(e)`, `function kn()`, `function Mn(e,t,n)`, `VideoGroupProvider-xnMJFlsE`, `MANIFEST_PARSED`, `LEVEL_SWITCHED`.
- **[X4]** [X-delivered hls.js `DOfrWPQ-.js`](https://abs.twimg.com/x-web/x-web/assets/DOfrWPQ-.js): `Uc=\`1.7.4\``, `set currentLevel`, `get autoLevelCapping`, `RESOLUTION`.
- **[X5]** [X API data dictionary, Media](https://docs.x.com/x-api/fundamentals/data-dictionary#media): `variants`, width/height, MP4 example. Its authenticated API sample is documentation, not an API request performed here.
- **[X6]** [X Help: sharing/watching videos](https://help.x.com/en/using-x/x-videos): Watching videos, autoplay, video timestamps/multiple attachments, fullscreen and upload guidance.
- **[H1]** [RFC 8216](https://www.rfc-editor.org/rfc/rfc8216.html#section-4.3.4.2), especially §§2, 4.1–2, 4.3.4.1–2.1.
- **[H2]** [hls.js v1.7.4 `m3u8-parser.ts`](https://github.com/video-dev/hls.js/blob/v1.7.4/src/loader/m3u8-parser.ts): `createVariant`.
- **[H3]** [hls.js v1.7.4 `types/level.ts`](https://github.com/video-dev/hls.js/blob/v1.7.4/src/types/level.ts): `Level` constructor, optional parsed dimensions.
- **[H4]** [hls.js v1.7.4 `hls.ts`](https://github.com/video-dev/hls.js/blob/v1.7.4/src/hls.ts): `levels`, `currentLevel`, `autoLevelCapping`, `nextAutoLevel`, `loadSource`, `getMediaDecodingInfo`.
- **[W1]** [W3C MSE introduction and object-URL definition](https://www.w3.org/TR/media-source-2/#introduction) (working draft).
- **[W2]** [WHATWG HTML media specification](https://html.spec.whatwg.org/multipage/media.html#dom-video-videoheight): video dimensions/resize, media interfaces, changing `src`, security considerations.
- **[U1]** [Tampermonkey `@grant`](https://www.tampermonkey.net/documentation.php?q=grant).
- **[U2]** [Violentmonkey metadata](https://violentmonkey.github.io/api/metadata-block/): `@grant`, `@inject-into`, `@run-at`, `@noframes`.
- **[U3]** [Tampermonkey `@sandbox`](https://www.tampermonkey.net/documentation.php?q=sandbox).

**Access/validation limits:** the documented example post ID `1263145271946551300` returned HTTP 404 at the attempted `x.com/Twitter/status/...` and `x.com/TwitterDev/status/...` URLs; the unauthenticated [public syndication request](https://cdn.syndication.twimg.com/tweet-result?id=1263145271946551300&lang=en) returned `{}`. No token construction, login workaround or access-control bypass was attempted. No actual X manifest, live player DOM, menu click, playback, 4K rendition or end-to-end cap was validated.

**Open decisions:** literal vertical-height cap versus X-style short-side quality; selection preference versus absolute playback/download ceiling; treatment of manual user overrides; supported native/immersive/legacy clients; and a stable way to associate each visible menu with trustworthy per-variant dimensions. Resolve these before promising broad X support.

## Hands-on exploration

Run timestamps: **2026-11-14 UTC**, following the source-only report above. This section supersedes its “no live player/manifest validated” limitation **only for the sample and client below**.

### Environment and sample

- Used a newly created, separately named browser session/tab; every browser operation targeted that session explicitly. The browser already had an authenticated X session: **this is not logged-out validation**. No login, posting, likes, account-settings changes, CAPTCHA solving, or access-control workaround was performed. Only playback and that player's quality controls were changed. Deleted only this exploration's browser session when finished.
- Browser UA: Linux x86_64, Chrome **157.0.0.0**, English UI. The live client loaded `https://abs.twimg.com/responsive-web/client-web/main.73ebd7d6b601a4f8a.js` and `vendor.e49846c68002fabaa.js`, **not** the logged-out `x-web` bundles inspected above. Source-derived names/behavior must therefore not be assumed identical.
- Located a public video on the homepage, then opened its standalone post: <https://x.com/SigmaOS/status/2121358267083526532>. One video/player in post detail, duration **30.299999 s**, MSE-style `blob:` current source. This was an actual X player, not a fixture or replacement player. The initial homepage had multiple mounted video players, but no multi-player quality operation was attempted.
- Artifacts retain only public post/bundle identifiers and aggregate media metadata. No signed media URLs, cookies, tokens, account identity, feed contents, or raw network capture were saved.

### Verified controls, ownership, and metadata

| Item | Actual observation |
| --- | --- |
| Player scope | `[data-testid="videoPlayer"]` contains `video` and exactly one `button[aria-label="Video Settings"]` for this sample. Controls appeared asynchronously after initialization/playback. |
| Main quality item | Clicking that scoped button opens `[role="dialog"]`; within it, `getByRole('menuitem', {name: /^Video quality/})` was **“Video quality · Auto (720p)”** initially. |
| Quality choices | Within the dialog, `[data-testid="radioGroupquality_level"]`, also `getByRole('radiogroup', {name: 'Video quality'})`, contains native `input[type="radio"][name="quality_level"]`. Accessible names: Auto, 270p, 360p, 720p. `.checked` reflects the selection; each input's accessible label uses `aria-labelledby`. Inputs have no `value` attribute (their `.value` is `"on"`), so they do **not** expose level IDs. |
| Portal ownership | The dialog is outside the player, under `[data-testid="HoverCard"]`. The settings trigger has **no `aria-controls`, `aria-expanded`, or dialog ID association**, and the dialog has no ID/labelled-by association back to the player. No stable general multi-player ownership mapping was established. Single-player scope plus refusing any pre-existing dialog was sufficient for this probe, not proof for feeds. |
| Easily exposed API | `video.hls`, `video.player`, and `video.setQuality` were `undefined`; no enumerable window key matched `hls`, `videojs`, or `player`. No exposed controller was found by these narrow checks. Did not traverse framework internals, load private modules, or patch player/loaders. |
| Trustworthy dimensions | A read-only browser `page.on('response', listener)` observer, limited to `video.twimg.com`, captured the **actually delivered HTTP 200 HLS master/child response bodies** after a normal reload. The master advertised the table below. Browser automation's response observer is **not a manifest-discovery hook available to an ordinary userscript**. `performance.getEntriesByType('resource')` returned no entries in this environment; it was not a usable discovery path. |

| Master `RESOLUTION` | `AVERAGE-BANDWIDTH` | `BANDWIDTH` | `CODECS` | Matching live menu label |
| --- | ---: | ---: | --- | --- |
| 1042×720 | 1001616 | 1489043 | avc1.640020 | 720p |
| 520×360 | 333553 | 491312 | avc1.4D401F | 360p |
| 390×270 | 119751 | 161112 | avc1.4D401E | 270p |

All three had explicit dimensions, unique labels, and literal height ≤2160. The master had no audio rendition group or audio codec; `webkitAudioDecodedByteCount` stayed **0**. Observed child playlist URLs were associated in memory with their master entries by URL resolution, **not filename dimension guessing**. Both 390×270 and 1042×720 child playlists were observed. Media responses also included HTTP 200 MP4 initialization and `.m4s` segments. No MP4-source replacement was performed; this does not validate the separate direct-MP4 player path. Segment-to-rendition attribution for each individual quality click was not recorded.

### Actual switching and throwaway integration

1. Opened Settings → Video quality. **Auto was checked**, decoded video was 1042×720.
2. Requested **270p**, corresponding to the master entry **390×270**. Reopened the menu: **270p checked**, Auto unchecked. After buffering, `video.videoWidth/videoHeight` were **390×270**, `readyState === 4`, playback active.
3. Requested **720p**, the highest master-advertised literal height ≤2160 (**1042×720**). Reopened the menu: **720p checked**, Auto unchecked; decoded dimensions became **1042×720**, `readyState === 4`. This is a genuine fixed-selection result, although no controller's internal level ID was accessible.
4. Tested a userscript-like, untrusted DOM-click path with [`prototypes/x/menu-probe.js`](../../prototypes/x/menu-probe.js), not just Playwright mouse input. Loaded the file into the isolated page and supplied only `{width,height}` entries derived from the observed master. `window.__yt4kXMenuProbe(variants, 270)` requested **390×270** using `HTMLElement.click()` on the scoped trigger, menu item, and radio. Reopening showed **270p checked** and eventual decoded **390×270**. Then `window.__yt4kXMenuProbe(variants, 2160)` requested **1042×720 / 720p**; independently reopening showed **720p checked**, decoded **1042×720**, readyState 4. No source replacement, framework traversal, network interception, or controller mutation was needed.
5. Immediate dimensions sometimes remained at the **old** quality after the click; the prototype deliberately returns `selectionVerified: false`. Later reads verified the switch. A click or its immediate return value is not verification. One Playwright `.check()` attempt timed out after its click closed the menu, although later checked-state and playback reads proved that selection succeeded; ordinary `.click()` plus independent verification worked.

The throwaway probe deliberately supports **one player only**, rejects any pre-existing dialog, requires a fully known supplied ladder, filters on **literal height**, rejects duplicate short-side labels, and performs no manifest discovery or persistence. It is not installable integration, does not handle source changes/user overrides, and is not safe evidence for general portal ownership. `node --check prototypes/x/menu-probe.js` passed.

**Additional controls:** focusing `getByRole('slider', {name: 'Seek slider'})` and pressing `ArrowRight` advanced approximately five seconds (**11.7945 → 16.836199**); the player briefly reported readyState 1/seeking, then readyState **4**, `seeking === false`, decoded **1042×720**. Checked selection was not independently reopened immediately after seek, before the later switching tests. Clicking scoped **“Full screen”** briefly changed the control to **“Exit full screen”**, but `document.fullscreenElement` was null both immediately and on the fresh read, when the control reverted. **Durable DOM fullscreen was not verified**; concurrent browser activity/focus is a possible explanation, not an established cause. No native/OS fullscreen or immersive route claim follows. Audio continuity could not be tested: this sample advertised no audio and decoded no audio bytes; the presence of Mute/Unmute controls is not proof of audio.

### Reproduction and controlled guard checks

For this specific public sample/client:

1. Open the post in a new tab with normal authorized access; stop if a login/access gate appears. Wait for a video and scoped Video Settings control. Inspect the page before acting.
2. Before a normal reload, attach a browser response observer that accepts only `video.twimg.com` HLS responses. Read master `#EXT-X-STREAM-INF` `RESOLUTION`, resolve its following child URI against that master's URL, and retain URLs only in memory. Export only dimensions/codecs/bandwidth, not signed URLs. Verify the ladder against the live menu; never infer dimensions from `270p` alone.
3. Load the throwaway probe into that isolated page. With this delivered ladder, call `__yt4kXMenuProbe([{width:1042,height:720},{width:520,height:360},{width:390,height:270}], 270)`, verify checked state and eventual video dimensions independently, close only the probe's menu, then repeat with cap `2160`. These hardcoded values are a **reproduction of this observed ladder**, not a fallback for another source. A fresh source requires fresh metadata.
4. Reopen the scoped menu with `player.getByRole('button', {name:'Video Settings', exact:true})`, then the dialog's Video quality menu item; verify `getByRole('radio', {name:'720p', exact:true})` is checked and the same player's decoded dimensions are 1042×720 after buffering. Snapshot refs change; the observed role/label selectors above are the reproducible selectors, not saved ref IDs.

Synthetic argument checks were also run against the probe in the browser: `{width:0,height:0}` rejected as unknown; 7680×4320 rejected with no eligible variant; **2160×3840 rejected** with no eligible variant despite its short side being 2160; 1920×1080 together with 1080×1920 rejected as an ambiguous `1080p` label. These are **controlled selector-policy checks, not live above-cap/portrait stream validation**. The portrait short-side policy has not been adopted: literal vertical height ≤2160 remains the rule.

### Updated verdict and next gate

**Worked:** real X HLS playback, actual master dimensions, player-scoped Settings → Video quality automation, synthetic DOM clicks, independently checked fixed selections and effective decoded 270p/720p dimensions, and successful seeking at 1042×720. This establishes a narrow **single-player menu integration hook** on the authenticated responsive-web client, not merely source-level feasibility.

**Not established:** a userscript-accessible trustworthy ladder/controller path; stable menu ownership with multiple players; logged-out playback; 1080p/1440p/2160p/above-cap live variants; live portrait/unknown/duplicate-codec ladders; audio continuity; durable fullscreen; native HLS/direct MP4; immersive/feed/source-reuse/reset/preroll/recovery behavior; actual userscript-manager/CSP execution; or a strict startup/download ceiling. No login/access gate blocked this sample, but no alternate client entitlement or anonymous-access claim is justified.

**Recommended next gate:** on this evidenced client, obtain a minimally invasive, per-player, userscript-accessible master/dimension association and prove portal ownership with two mounted players; then repeat the checked-state/decoded-dimension test on an audio-bearing 2160p sample and an above-cap or portrait sample. Do not ship label-only selection, claim 4K validation, or promise a hard cap from this 720p-only experiment. Keep the production YouTube script unchanged until that metadata/ownership gate passes.

## Earlier menu-coupled adapter validation (2026-11-14 UTC; superseded)

**Historical evidence, not the current implementation.** Parent cold-load bundle QA subsequently showed this adapter waited indefinitely for hover-mounted Settings controls. The no-hover correction below supersedes its implementation description and support boundary. Successful menu/4K observations here remain observations, but must not be used as proof of automatic no-hover selection.

### Outcome and implementation boundary

**The userscript-accessible metadata/ownership gate now passes narrowly on the authenticated English responsive-web client:** [`src/platforms/x.js`](../../src/platforms/x.js) automatically discovers a player's actual HLS dimensions and original level indexes, selects the highest eligible level under the literal vertical-height cap, and verifies fixed engine selection. Live 720p and **3840×2160** playback were verified, not just labels. No ladder was supplied to this adapter and no browser response observer was used for its decisions.

This is a **best-effort selection preference**, not a strict first-request or first-frame cap. Unknown or unsupported paths leave X's original playback unchanged; they do not block Auto playback. The adapter deliberately waits for metadata and player controls. A userscript running in an isolated/content world without access to page objects safely does nothing.

### Actual private API and ownership checks

The tested client still loaded `main.73ebd7d6b601a4f8a.js` and `vendor.e49846c68002fabaa.js`, Chrome 157 / Linux, English, with an already-authenticated session. A new named browser session was used exclusively for these tests. No login, posting, account-settings changes, likes, follows, access-control workaround, or CAPTCHA solving was performed. Public profile/post playback and per-player quality controls were the only X interactions.

Unlike the logged-out `x-web` source, this responsive-web player can be found by a **bounded, read-only React ancestry lookup**:

1. The actual video must have a nearest `[data-testid="videoComponent"]` inside `[data-testid="videoPlayer"]`, with exactly one video in that player root.
2. Read the component element's own `__reactFiber$…` property; inspect at most eight immediate ancestors for `stateNode.videoPlayer`. No application-wide store traversal, private-module loading, or React mutation is used.
3. Require **all three ownership identities**: `player.video.hlsJs.media === video`, `player.video.videoTag === video`, and `player.domElement.contains(video)`. Require X's `setQualityLevel` function and an actual HLS levels array.
4. Read variant-specific `width`, `height`, and `bitrate` from that owned HLS instance. Preserve original array indexes. Do not use filenames, current decoded dimensions, top-level upload dimensions, or UI labels as the resolution source.
5. For the Settings trigger and its out-of-tree dialog, require a bounded React ancestry match on **`memoizedProps.playerApi === that exact player`**. This establishes portal ownership even with multiple mounted players. Refuse any pre-existing dialog, serialize menu work, and stop the operation on trusted keyboard/pointer input.

This is a deliberately private/version-sensitive integration, not a stable X API. If the shape, realm access, player identity, or English controls differ, skip. Native HLS, direct MP4, the logged-out `x-web` implementation, and unproven legacy Twitter clients are unsupported by this implementation; hostname matching alone is not validation.

### Switching details discovered by testing

- `player.setQualityLevel(index)` delegates through X's own store to its HLS controller; it sets a fixed `manualLevel` and turns `autoLevelEnabled` off. However, using this wrapper alone left the tested Settings menu's local radio state showing **Auto**, even while HLS and store state were fixed.
- Conversely, the quality group's observed UI handler has a keyboard-navigation branch that can update its local selected radio **without requesting an engine switch**. This produced a real failed intermediate test: **720p checked while HLS remained fixed at index 0**. It is not counted as successful switching.
- The final adapter therefore selects the real owned radio **and requests that same metadata-verified original index through X's wrapper**, then waits for `manualLevel === target.index && !autoLevelEnabled`. Independent reopening verifies the menu too. It rejects the entire ladder if any variant has unknown dimensions, or if the target's short-side label is duplicated, including codec duplicates or portrait/landscape collisions. There is no label-only fallback.
- Clicking the Settings trigger again during the radio's dismissal transition reopened a menu in an intermediate test. Final cleanup instead invokes the matched owning component's existing `onDismiss` callback, which was observed as setting `showVideoSettings: false`. It never closes a pre-existing user dialog or clicks an unrelated portal.
- One preference is applied per element/HLS/source/dimension-ladder generation, not continuously. Later manual changes are not fought. Source/HLS replacements and `emptied` invalidate the record; metadata must be ready before reapplying. Measured bitrate changes alone are not treated as source changes. Same-source recovery paths that do not expose any reset remain unproven.
- No fetch/XHR replacement, network/manifest rewriting, extra player, stream replacement, new privilege, or hardcoded ladder is involved.

### Live outcomes

| Test | Independently observed result |
| --- | --- |
| Public SigmaOS post from the earlier probe | Actual adapter discovered its own 390×270 / 520×360 / 1042×720 HLS levels. After a lower-quality preparation, automatic cap-2160 selection produced **720p checked, Auto unchecked**, eventual **1042×720**, readyState 4. Immediately after selection old decoded dimensions sometimes remained 390×270; only later reads established effective switching. |
| SpaceX profile, several mounted players | Initial document had five players; scrolling mounted more. Player identity checks distinguished each actual HLS/media pair. On one fresh aggregate read, the VODs at public posts **2121434583178875245**, **2121394268652839309**, and **2121387537235406928** each had **manual index 4, Auto disabled, decoded 3840×2160, readyState 4**. Other mounted players without initialized controls remained Auto/untouched. The active 19-second VOD had decoded audio bytes **480351**; the other two had **38376 / 30697**. This proves independent ownership and automatic application in a multi-player document, not exhaustive feed coverage or simultaneous audible playback. |
| SpaceX live broadcast **2121316300702056595** | Owned live HLS levels were 848×480 (1.2 Mb/s), 1280×720 (2.75 Mb/s), 1920×1080 (5.5 Mb/s), 3840×2160 (16 Mb/s). Automatic fixed **index 3**, Auto off. Independently opened menu: **2160p checked / Auto unchecked**. Decoded **3840×2160**, readyState 4, playback active; audio bytes increased from **525647** to **965674** across reads. This is an observed live path, not a promise for every broadcast or DVR mode. |
| **Actual shared core + final adapter**, public <https://x.com/SpaceX/status/2121434583178875245> | Concatenated the unmodified **`src/core.js`** and final adapter inside one IIFE and called **`YT4K.start(location.hostname)`**, using default `{maxHeight:2160, debug:false}`. No stub policy or supplied ladder in this run. A normal fresh navigation also exercised early main-world injection before player initialization. The old prototype shim was stopped before actual-core startup. Actual core reported started, then the real player went from Auto / current index 3 to **manual/current index 4, Auto disabled**. Independently reopened menu: **2160p checked**, all other radios including Auto unchecked. Decoded dimensions transitioned from **1920×1080** to **3840×2160**, readyState 4. Audio decoding increased from **4429** through **11321** to **20708** bytes; playback active. |

The 19-second VOD's owned ladder was **480×270, 640×360, 1280×720, 1920×1080, 3840×2160**, with advertised bandwidths **112497, 316905, 928529, 3311749, 8702200** bit/s. It was not inferred from its menu. A separate actual-core run also switched a prepared fixed index 0 to index 4, with decoded 480×270 initially and eventual 3840×2160, **2160p checked**, audio bytes **1128809**, readyState 4. Neither run rewrote the media source.

Audio-byte growth proves continued decoding of an audio-bearing stream, **not an audible listening test**: playback remained muted and audio settings were not changed. The silent SigmaOS sample remains unsuitable for audio continuity claims. No above-2160 live rendition, live portrait ladder, unknown-dimension stream, durable fullscreen/native fullscreen, preroll transition, buffering-recovery guarantee, or logged-out flow was validated. The literal-height rule remains unchanged; no short-side portrait proposal was adopted.

After the final actual-core 4K selection, a standard `video.currentTime = 5` seek produced readyState 1 / `seeking: true`, then a fresh read showed **time 5, 3840×2160, readyState 4, `seeking: false`, playback active**, decoded audio bytes **34117** (up from 25945 at seek). The still-open independently inspected Settings summary continued to show **Video quality · 2160p**. A prior slider/ArrowRight attempt did not establish an actual seek and is not counted as evidence.

### Injection, CSP, and reproducibility limits

Browser evaluation in this environment uses an isolated world by default: DOM control worked there, but React expandos were inaccessible and Performance resource discovery was not useful. A plain inline main-world script element was **blocked by X's CSP**. For controlled tests, a script element using the page's existing nonce did run in the main world. Browser `addInitScript` also ran the real core/adapter before player initialization; the tool explicitly warns that this is document-interception-based automation and visible to pages. **Neither technique proves a particular installed userscript manager's injection world/CSP behavior.** Production code does not extract/reuse nonces or inject a second script.

For reproduction, use an authorized browser and stop on any login/access/challenge gate. Inject **`src/core.js` + `src/platforms/x.js` + `YT4K.start(location.hostname)`** inside a single page-world IIFE, or test the built userscript in the intended manager. Start before player initialization when possible, then allow normal playback controls to initialize. Open the real Settings → Video quality menu independently and compare checked state, the exact owning HLS instance's `manualLevel/autoLevelEnabled`, and eventual decoded dimensions. Never supply a captured ladder to the automatic adapter. [`prototypes/x/automatic-harness.js`](../../prototypes/x/automatic-harness.js) is the earlier core-compatible shim used for exploratory iterations only; the actual-core tests above did not use it.

All network observation for automatic decisions was eliminated. No signed media URLs, credentials, tokens, account identity, raw capture, or private feed contents were written to repository artifacts. Some Playwright mouse/locator operations failed due control remounts/layer transitions; inspected DOM `.click()` plus fresh independent reads were used instead. An attempted foreground operation was refused by the browser tool and was not retried or worked around. No interactive challenge or access-denied page was encountered.

### Controlled tests and remaining human dependency

`node --test tests/x.test.cjs` passes **27 tests** using built-in `node:test`/`vm`, without dependencies. Coverage includes original HLS index selection, literal-height rejection of 2160×3840 portrait/4320p, eligible 1080×1920 portrait selection, missing/non-numeric/unknown dimensions, duplicate labels/codecs, exact media/tag/container/trigger ownership, two serialized players, document-start/no-DOM/delayed controls, source/HLS replacements, same-source `emptied` reset, measured-bitrate churn, respecting manual overrides and existing dialogs, ignored setters, trusted versus synthetic input, cancellation races, and cleanup. These are controlled lifecycle/policy tests, not substitutes for the live evidence above.

**Remaining human-dependent validation:** install/enable the final userscript in the intended Tampermonkey/Violentmonkey + browser combination and confirm actual page-world execution under X's CSP. This work intentionally did not install extensions, change account settings, or bypass browser foreground restrictions. If injection falls back to an isolated world, X safely skips instead of selecting by label. Obtain authorized above-cap/portrait samples before claiming live rejection of those streams; the current proof is safe controlled rejection plus real 720p/4K selection, not a universal or strict download cap.

## Cold-load/no-hover correction (2026-11-14 UTC)

### Reproduction and fix

Parent testing of the built userscript on two fresh X loads established that a ready, metadata-bearing player mounts **only Mute/Unmute, not Video Settings**, until pointer hover. The menu-coupled adapter's trigger guard therefore prevented the actual quality request. Hover immediately enabled its remaining path. **This was a functional bug, not a CSP/user-action blocker**, and invalidated the earlier conclusion that initialization alone was sufficient.

Before changing production code, the regression command `node --test --test-name-pattern='NO Settings' tests/x.test.cjs` failed: expected the highest safe original index `[1]`, actually requested `[]`. The fixture supplied a ready, positively owned HLS player with no Settings trigger—the exact failing seam.

The current [`src/platforms/x.js`](../../src/platforms/x.js) is **API-only, universally**, rather than a hover-dependent API fallback:

- Retain bounded player discovery and all media/videoTag/container ownership guards. Require ready metadata and a known, finite, positive-dimension ladder. Select the highest literal height ≤2160 through the actual shared core, retaining its original HLS index and width/bitrate tie-breaks.
- Request `player.setQualityLevel(target.index)` directly; verify **`manualLevel === target.index && autoLevelEnabled === false`** with bounded waiting. Later decoded dimensions are independently verified in live testing; the adapter's engine-verification log alone does not claim buffering/decoding completed.
- **Never inspect/open/close a menu, synthesize hover, move focus, mutate React state, or require Settings controls.** No global pointer/keyboard listener is needed. Multiple owned players can apply independently without portal serialization.
- Perform one bounded request per source generation. Do not fight a later manual/API override. Source/HLS/dimension-ladder replacement or `emptied` permits a fresh request after metadata is ready. A source change during verification cannot be reported as stale success; cleanup prevents further work.
- UI label collisions are no longer selection ambiguities: the API uses exact HLS indexes, not labels. Known duplicate-codec dimensions can now select the highest-bitrate original index safely. Unknown-dimension ladders remain conservatively skipped. Portrait variants use literal vertical height, never short-side labels.

**UI caveat:** X's private wrapper can leave the locally stored menu radio/summary displaying **Auto** despite a verified fixed engine index. The current adapter intentionally does not synchronize that cosmetic state. Its result is **engine-verified, not menu/UI-verified**. Historical checked-radio observations from the menu-coupled version are not claims about this version. The English label selectors and 64-fiber portal traversal were removed from production; the same private responsive-web player shape and page-world access are still required.

### Actual-core cold-load live proof, without hover

Used a separate newly named session, **`yt4k-x-nohover-20261114`**, never the parent's diagnostic session. Installed **unmodified `src/core.js` + current adapter + `YT4K.start(location.hostname)`** in one early page-world IIFE on a fresh public <https://x.com/SpaceX/status/2121434583178875245> navigation. The actual core retained its defaults `{maxHeight:2160, debug:false}`. No stub policy, supplied ladder, API/method interception, manifest/network observer, Settings click, Playwright hover, synthetic hover, or focus action was used.

[`prototypes/x/no-hover-observer.js`](../../prototypes/x/no-hover-observer.js) is a read-only test observer. It records owned HLS state, actual dimensions, readiness, playback-button presence, and pointer-over events; it never changes quality or playback. It keeps URLs and account metadata out of its evidence. Its timeline showed, with **Settings button count 0 and player pointer-over event count 0 throughout**:

| Stage | Actual primary player state |
| --- | --- |
| Initial master parsed, before metadata | Auto on, manual −1, current −1, readyState 0, decoded 0×0. The owned ladder was 480×270, 640×360, 1280×720, 1920×1080, 3840×2160. |
| Metadata ready | Auto on, manual −1, current 3, readyState 4, decoded **1920×1080**; only the Play Video overlay existed. |
| Adapter request, without hover or Settings | **Auto off, manual/current 4**, readyState 4. Old decoded 1920×1080 briefly remained, as expected while buffered frames were retained. |
| Ordinary playback | Called only the native `video.play()` to start playback. The immediate return had readyState 4, decoded 1920×1080, **no Settings button**. No quality/variant was supplied by this action. |
| After buffering | **Auto off, manual/current 4, decoded 3840×2160, readyState 4, playback active**, time **5.63862 s**, decoded audio bytes **101865**. The only mounted primary playback button was **Mute**; Settings count and pointer-over count were still **0**. |

The same unhovered post document also mounted an independently owned portrait reply player, whose actual ladder was **320×568, 480×852, 720×1280, 1080×1920**. It automatically reached fixed **index 3 / Auto off**, with zero Settings controls. Its paused decoded image was still 720×1280, so that observation proves its independently owned **engine preference**, not effective 1080×1920 playback. An unrelated media element with no matching owned HLS controller was skipped. No above-cap portrait claim follows.

Audio-byte growth demonstrates decoding, not a human listening test. No audio/mute control was changed by the adapter or test; the main player's native state in this run was unmuted (Mute button), unlike the earlier muted-playback tests.

**Independent second cold load:** navigated freshly to <https://x.com/SpaceX/status/2121394268652839309>, still with the exact same actual-core/API-only init script and no hover/Settings/focus action. Its owned ladder was **480×270 / 640×360 / 1280×720 / 1920×1080 / 3840×2160**, bandwidths **98036 / 284256 / 617995 / 3063330 / 8598997** bit/s. The observer saw initial Auto/manual −1, then **manual 4 / Auto off while the player was still paused behind its Play Video overlay**, without any Settings button. Native `video.play()` returned decoded **3840×2160**, readyState 4, Settings count 0. A fresh later read showed **manual/current 4, Auto off, 3840×2160, readyState 4, playback active, time 15.35872 s, audio bytes 255765**, only an Unmute control, **Settings count 0 and pointer-over count 0**. Other media elements without an owned HLS controller remained untouched. This independently repeats the exact no-hover success on a different real stream.

**Manual-override check, separate from the no-hover proof:** after the first post's successful 4K snapshot, requested fixed index 0 through that same real player's normal `setQualityLevel(0)` wrapper as a simulated manual override. **53.640 seconds later** the adapter had not fought it: manual/current **0**, Auto off, decoded **480×270**, readyState 4, playback active. Later pointer-over events were present by that diagnostic read (62), so this later manual-override observation is **not** counted as an additional zero-pointer proof; the earlier effective-4K snapshot and independent second cold-load snapshot both explicitly had zero pointer events. No Playwright/synthetic hover, Settings click, or focus action was used in either no-hover run.

### Current regression coverage and remaining limits

`node --test tests/x.test.cjs` now passes **27 revised API-only tests**, including the previously failing **ready HLS + no Settings/no hover** case and an **actual shared-core** integration test. Tests reject any unexpected global UI query or focus inspection. Coverage includes original indexes; literal portrait/above-cap rejection; unknown dimensions; duplicate-codec bitrate and same-height width ties; independent players; document-start/delayed metadata; source/HLS/`emptied` resets; measured-bitrate stability; missing/mismatched player ownership; missing/ignored/throwing setters; cleanup and stale-verification races; and respecting manual overrides both during and after verification. Old menu-lifecycle tests were replaced rather than retained as misleading coverage of code no longer shipped.

The remaining manager/CSP validation is separate from this now-fixed no-hover bug. Production does not inject another script or extract a nonce. Browser-assisted early page-world execution is not a guarantee of a particular userscript-manager configuration. Private-client version changes, native HLS/direct MP4, logged-out clients, and unobserved reset/recovery paths still skip or remain unproven. This remains a **selection preference**, not a first-request/first-frame/download ceiling. No unknown/above-cap live stream or universal support claim is justified.
