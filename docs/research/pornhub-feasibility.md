# Pornhub quality-selection feasibility

> Current outcome: the exact four-platform generated bundle passed real
> desktop HLS automatic selection and decoded **1920×1080** playback, the
> tested site's maximum. The actual wrapper separately passed 2160p MP4/HLS
> harness tests. Earlier access blockers and harness-only limitations below
> are historical; userscript-manager delivery and live-site 4K remain untested.

Latest research: **2026-11-14**. **Verdict: the production adapter now automatically selects and verifies the highest offered quality on a REAL public Pornhub watch page: offered heights 240/480/720 → selected 720 → decoded 1280×720.** Both a real lower-to-high switch and document-start initialization were verified, with all page/video visuals hidden and audio muted. A production-only settings-redaction incompatibility was found and fixed through the site's own keyed `MGP.inspectOriginal(root.id)` API, with failing-then-passing regression tests. The earlier actual-wrapper harness separately proves MP4/HLS.js 3840×2160, not live-site 4K. The normal authorized age confirmation is complete; no human blocker remains. See the final real-site section for evidence and remaining boundaries. Parent still owns bundle integration and README support claims.

Earlier sections below are chronological research history, not the current access/API verdict. In particular, their no-manifest/no-wrapper-execution statements describe those earlier passes only. No strict first-byte cap is established.

Scope: read-only repository inspection and anonymous HTTP retrieval of help/technical pages and JavaScript source. After additional authorization, the final discovery pass also inspected only the HTML of an ordinary public watch link to assess its gate and technical references. No manifests, imagery, or video were fetched; no watch HTML/content identifiers were persisted, and no full site scripts were executed. A prior follow-up used a newly named browser session for technical search only, without adopting pre-existing tabs or changing account settings; it did not navigate to Pornhub. Small sanitized source excerpts were tested only against local stubs. No age, login, payment, consent, or geographical restriction was bypassed. The initial search tooling failed; a public code-search request returned 429 and a GitHub revision lookup returned 403, without retries or circumvention. See the follow-ups below for additional sources and source-only tests.

## Repository baseline — observed

- [README](../../README.md) promises highest available quality ≤2160p, API then menu, navigation handling, zero dependencies, and `@grant none`.
- [Userscript](../../yt4k-1.2.0.user.js) is entirely YouTube-specific: metadata matches only YouTube (lines 7–12), `#movie_player` and named YouTube methods (49–85), `.ytp-*` menus (94–164), query parameter `v`, and `yt-*` navigation events (176–224). Adding a host match alone cannot work. Reuse the numeric policy and bounded waiting, not these identifiers.
- Do not copy orchestration unchanged: it marks a video handled before success (179–181), rejects a single available API level (63), and verifies only non-`auto`, not equality with the target (199–207). Also, `waitFor(isOpen, ...)` returns a boolean which `tryMenu` then treats as an element (110–116); the advertised menu fallback has a static-code defect. These were not runtime-tested or changed.

## Evidence and uncertainty

| Area | Observed primary evidence | What remains unproven |
| --- | --- | --- |
| Page-world objects | Anonymous support HTML contains top-level `var playerObjList = {};` [S1]. Follow-up first-party consumers look up `MGP.players[id]`, call `isPlaying()`/`getCurrentTime()`, and use `VIDEO_SHOW.videoId` on desktop or `VIDEO_SHOW.playerId` otherwise [S13,S14]. | These are consumer call sites, not the player implementation or a live populated registry. Main-content association, lifetime, readiness, quality methods, and reachable engines remain unverified. No verified `setQuality`/`getQuality` contract was found. |
| Player UI/preferences | The support page's cookie allowlist includes `quality`; its local-storage allowlist includes `mgp_player` [S1]. | Preference schemas, legal values, effect on playback, persistence, current quality-menu markup, lock indicators, and mobile/localized variants. Do not write guessed cookie/storage values. |
| HLS | Support HTML declares `hlsLib` pointing to `hls-v1.5.14.min.js?cache=2026111202`; that public CDN asset was fetched and contains the version string `1.5.14` and quality-control symbols [S1,S2]. | This is not proof that every video/browser uses HLS.js, nor that its constructor or active instance is exposed on `window`. |
| Resolution/entitlements | Site help describes upload formats and recommends 2160p for VR; Premium help advertises additional content/high quality [S3,S4]. | Upload specifications do not establish playback variants. Neither page establishes a universal 4K offering or a current “4K requires Premium” rule. Account, content, device, and regional availability must be measured rather than assumed. |
| Access failures | Site help explicitly lists owner-imposed geo-blocking, pending verification, review, and removal as playback-failure causes [S5]. | Current jurisdiction-wide availability and account-specific resolution limits were not tested. Treat all gates and unavailable/locked options as unavailable, not problems to work around. |

**Secondary discovery lead, not current site proof:** yt-dlp's Pornhub extractor reads `flashvars_<digits>.mediaDefinitions` entries with `videoUrl`/`quality`, handles `/video/get_media` JSON, HLS `.m3u8`, DASH `.mpd`, and other file URLs [S10]. This is primary evidence of *yt-dlp's implementation*, not Pornhub's present player API. It suggests HLS and progressive/file variants should be investigated; do not execute the extractor or reproduce its access-handling techniques. No such endpoints or media were requested here.

## Quality semantics and the hard cap

- Define the target as `max(known, playable, authorized heights <= 2160)`. Exclude Auto, locked/disabled entries, unknown heights, and non-video variants. A lone eligible quality is valid. With no eligible option, report unsupported/unavailable rather than selecting an unknown or >2160 option. Do not infer height from bitrate or list position; treat marketing labels such as “4K” as unverified until mapped.
- HLS master playlists can describe multiple variants; `RESOLUTION` is optional and describes display width/height. A media playlist is a segment list, not necessarily a quality list [S6 §§2, 4.3.4.2]. Thus a single HLS `mediaDefinitions` entry need not mean one available resolution. MP4 can also be an HLS segment container, not necessarily a standalone progressive source [S6 §3.3; S7 README].
- **Conditional HLS.js path:** only if the existing authorized instance is positively associated with the content player, inspect `levels[].height` after manifest parsing and choose an explicit eligible level. Version 1.5.14 exposes `currentLevel`, `nextLevel`, and `loadLevel`: immediate switching flushes/rebuffers; the latter two have different deferred-switch behavior [S7 `hls.ts`, lines 502–560]. Prefer the site's wrapper over reaching into its engine.
- `autoLevelCapping` restricts automatic selection; it does **not** force the highest eligible quality or constrain manual choices. A maximum index is not inherently a height cap: 1.5.14 sorts by HDCP group before height. Every level in the allowed index prefix must be known and ≤2160 for that shortcut to be safe. `-1` means uncapped, not “no eligible level.” `loadSource()` resets the cap [S7 `hls.ts`, lines 397–409, 687–764; `level-controller.ts`, sorting and manual-level accessors].
- Distinguish **select best ≤2160 after readiness** from **never request/display >2160 from the first frame**. The current `document-idle` timing cannot establish the second guarantee: playback/buffering may already have started. Selection, buffering, error recovery, source replacement, and site preference restoration need verification. A late UI click is not network-level enforcement.
- Native HLS and progressive MP4 need the site's own switching control unless a separately evidenced API exists. Standard `videoHeight` is read-only; setting `video.height` only affects layout, not stream quality [S8]. Replacing `video.src` is not the recommended fallback: it invokes loading and can disrupt playback state, subtitles, ads, and site bookkeeping [S8].

## Least-invasive proposed strategy — not implemented

1. Preserve the YouTube behavior; isolate Pornhub discovery/selection/verification behind host-specific logic. Start with narrowly scoped, top-level watch-page matches; keep embeds excluded. Do not add every regional/Premium domain speculatively.
2. First prototype the **existing quality UI**, once actual markup is safely evidenced. Scope to the main content player, wait through normal initialization/ads without skipping them, enumerate enabled numeric options, and select the highest ≤2160. Do not click upgrades, consent/age gates, or login prompts. Restore only menus opened by the script and avoid stealing focus. DOM access avoids depending on page-world globals.
3. If a site-owned wrapper's getter/setter is subsequently confirmed from its code and behavior, prefer that narrow interface; retain UI fallback. HLS.js instance access is a conditional third option, not a reason to monkey-patch constructors, requests, manifests, or prototypes. No new HLS library, player replacement, media-URL harvesting, or cross-origin permissions are needed for the proposed UI path.
4. Use bounded retries and cancellation keyed to **content identity plus player/source generation**, marking success only after verification. Observe player replacement and metadata/source changes; handle normal page loads and back/forward. No Pornhub-specific SPA event was established. `popstate` alone is insufficient for `pushState` navigation [S9]; a scoped mutation observer with debounced URL/identity checks is less invasive than patching history. Clean up stale observers/listeners and respect subsequent manual user quality changes.
5. Verify selected UI state and, where available, engine playback-level events. `videoHeight`/`resize` provide an independent dimensions check, not proof of maximum availability or a historical hard cap [S8]. Account for already-buffered content before declaring failure. Log only technical numbers/state, never titles, media URLs, account data, or tokens.

### Sandbox / metadata implications

Tampermonkey documents `@grant none` as disabling the sandbox, but its `@sandbox` documentation also describes injection worlds and CSP-dependent fallback. Violentmonkey separately defaults `@inject-into` to `auto`, which may fall back from page to content context under CSP; DOM remains accessible, page JavaScript objects do not [S11,S12]. Therefore **do not equate `@grant none` with guaranteed page-global access in every manager/browser configuration**. Keep UI automation permission-free; test both managers. An API adapter would need explicit, manager-appropriate page-world access, feature detection, and a safe failure path. Adding GM grants later changes the assumptions; `unsafeWindow` is not a universal fix (notably Violentmonkey content mode).

## Prototype checks / open questions

These checks are proposed, **not performed**. Use an isolated test profile and lawful, non-explicit test content or sanitized fixtures; stop at restrictions. Do not use the user's session.

- Capture sanitized control markup and wrapper/engine method signatures: what is the actual quality getter/setter, and does UI selection disable ABR or merely set a preference? Is `playerObjList` populated and linked to the main player?
- Test fixtures for `[480,720,1080] →1080`, `[1080,2160,4320] →2160`, a single level, unsorted/duplicate levels, optional/unknown resolution, HDCP-group ordering, locked 2160, and all options above the cap. Establish a tie-break policy for equal-height codec/FPS variants.
- Exercise HLS.js, native HLS, progressive sources, delayed readiness, slow networks, failed switches, fullscreen, ad-to-content transitions, source replacement, next-video navigation, back/forward, and user overrides. Which of these modes actually exists on supported Pornhub pages remains open.
- Check Chromium/Firefox × Tampermonkey/Violentmonkey, localized UI, and mobile separately. Determine whether synthetic clicks are accepted and whether normal permitted account/region states expose different options, without acquiring entitlements or bypassing blocks.
- Decide whether the product promises best-quality selection or a strict first-byte cap. The latter is **not established by this approach** and may require a different design or an explicitly narrower guarantee.

## Sources

- **S1 — first party, inspected HTML:** <https://www.pornhub.com/support>, search literals `var playerObjList = {};`, `essentialCookiesListAll`, `essentialLocalStorageKeys`, `//HLS Lib v1.5.14`, and `var hlsLib`. The non-media technical page <https://www.pornhub.com/webmasters> also declares the registry and library URL; no embedded content was loaded.
- **S2 — first-party-served JavaScript:** <https://ei.phncdn.com/www-static/js/lib/hls/hls-v1.5.14.min.js?cache=2026111202>. Retrieved text SHA-256: `50252475b17d6021e059dca2cd9842caba7e80c74ac08d2120c9e761edc08ca0`. This is library evidence, not a verified Pornhub wrapper API.
- **S3 — first-party help, upload specifications:** <https://help.pornhub.com/hc/en-us/articles/4419859542419-Video-Specs>.
- **S4 — first-party help, Premium description:** <https://help.pornhub.com/hc/en-us/articles/4419884685459-What-features-do-I-get>.
- **S5 — first-party help, availability:** <https://help.pornhub.com/hc/en-us/articles/20404403877651-Why-are-some-videos-not-playing-on-Pornhub>.
- **S6 — HLS protocol:** <https://www.rfc-editor.org/rfc/rfc8216.html#section-4.3.4.2>, also §§2 and 3.3.
- **S7 — version-matched library owner source:** <https://github.com/video-dev/hls.js/blob/v1.5.14/src/hls.ts#L502-L560>, <https://github.com/video-dev/hls.js/blob/v1.5.14/src/hls.ts#L687-L764>, <https://github.com/video-dev/hls.js/blob/v1.5.14/src/controller/level-controller.ts#L274-L311>, and <https://github.com/video-dev/hls.js/blob/v1.5.14/README.md#compatibility>. Static source was read; upstream was not asserted byte-identical to the CDN build.
- **S8 — HTML Standard:** <https://html.spec.whatwg.org/multipage/media.html#dom-video-videoheight>, <https://html.spec.whatwg.org/multipage/media.html#location-of-the-media-resource>.
- **S9 — HTML Standard, navigation/history:** <https://html.spec.whatwg.org/multipage/nav-history-apis.html#dom-history-pushstate>.
- **S10 — secondary site-integration lead, inspected extractor source (mutable master):** <https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/pornhub.py>, `PornHubIE._real_extract`, `media_definitions`, and `add_format`. No extractor was run.
- **S11 — manager owner documentation:** <https://www.tampermonkey.net/documentation.php?q=grant> and <https://www.tampermonkey.net/documentation.php?q=sandbox>.
- **S12 — manager owner documentation:** <https://violentmonkey.github.io/api/metadata-block/#grant> and <https://violentmonkey.github.io/api/metadata-block/#inject-into>.

## Hands-on exploration

Date: 2026-11-13. **Worked: anonymous first-party HTML/script inspection and negative source-discovery checks. Not tested: quality selection on a real player.** No verified quality getter, setter, menu selector, populated registry entry, or player-to-video association was established. The adapter remains blocked on safe player evidence; the shared scripts below must not be presented as the actual content-player bundle.

### Surfaces and observed interfaces

- Re-read the repository instructions, README, and current userscript. The existing cap remains **literal rendition height ≤2160**, not a portrait short-edge policy. No production code or README changes were made.
- Retrieved [the first-party webmasters HTML](https://www.pornhub.com/webmasters) anonymously, without a browser, cookies from the user's profile, or script execution. It again contains `var playerObjList = {};`, but only one textual occurrence of `playerObjList`; no population or consumer was found there. This establishes an empty declaration in source, **not the shape of any runtime player instance**.
- Enumerated its external script references and fetched four first-party-served shared scripts, listed below. None supplied an evidenced quality-control path. In particular, `generated-lib.js` had no occurrences of the exact strings `playerObjList`, `mgp`, `setQuality`, `getQuality`, `player.js`, `qualityItems`, or `videoQuality` (case-insensitive searches). The other three had no `playerObjList`, `mgp_player`, `player.js`, `player.min.js`, `quality`, or `playerSrc`. These are bounded negative searches, not proof that some differently named implementation cannot exist.
- This HTML also includes lazy preview-video markup outside a content player. A technical page is therefore **not automatically a non-explicit playback demo**. No preview URL was followed and no browser rendering was attempted. No actual first-party content-player bundle was observed loading/executing; the earlier HLS-library evidence does not close that gap.
- Tested only missing-content routes, with redirect following disabled: `/embed/` returned 301 to `/embed`; the normalized `/embed` returned 404. `/embed/yt4k-nonexistent-test` returned a 404 body with no external `phncdn.com` script references and no `playerObjList`/`MGP` match. `/view_video.php` without a content key returned 301; its target was not followed. These were unsuccessful discovery probes, **not safe demo players or evidence about a valid video's controls**. No valid content identifier was requested.

### Inspected first-party script sources

All four are references from the inspected webmasters HTML, retrieved as text without executing them. SHA-256 values identify the retrieved UTF-8 text; they are not claims about future deployments.

| Source | SHA-256 |
| --- | --- |
| [utils/mg_utils-2.0.0.js](https://ei.phncdn.com/www-static/js/lib/utils/mg_utils-2.0.0.js?cache=2026111202) | `824c7445e0fa7aa38865cb6856d599c58d7bc0a1674209fd37759b9900096e77` |
| [atlasbundle.min.js](https://ei.phncdn.com/www-static/js/lib/atlasbundle.min.js?cache=2026111202) | `d9b65df9d6d99f621729625864580ab4b935e7f3f07022af4bd63c7cfe56beab` |
| [ph-functions.js](https://ei.phncdn.com/www-static/js/lib/ph-functions.js?cache=2026111202) | `8ab1df81bbf0025276777a4876a0ea7f3537ea4f137209e3f880bf12c493c8e0` |
| [generated-lib.js](https://ei.phncdn.com/www-static/js/lib/generated-lib.js?cache=2026111202) | `b8f71094b1c650ea803dc7ef8724015685333b4d909916c58af94c54a7ecdcdd` |

### Test outcomes and verification limits

| Check | Outcome |
| --- | --- |
| HTML script inventory and registry-reference search | Performed; declaration only, no instance association. |
| Shared-script text searches and hashing | Performed; no usable getter/setter/quality selector discovered. |
| Missing-content HTTP routes | Performed; redirects/404s, no content-player source found. |
| Requested quality / selected quality / effective decoded height | **None / not observed / not observed.** No quality request or media playback occurred. |
| Authorized available heights, locked entries, ≤2160 choice | Not observed; no actual option list. |
| Sanitized fixture exercising a discovered player function | Not created: there is no discovered wrapper function/selector to exercise honestly. A fabricated setter or a generic HLS fixture would not establish Pornhub interoperability. |
| Real browser, manager injection, ad-to-content transitions, navigation, manual override | Not tested. No browse session was created or adopted. |

No age/login/geo/paywall/challenge gate was encountered on these technical/missing-content HTTP requests; **no human gate was passed or bypassed**. The blocker here is the absence of a positively identified, lawful non-explicit test player, not evidence that Pornhub itself is inaccessible. A technical web-search request failed; it was not retry-looped. No account/global preference was touched, and no screenshot, video, manifest, or media endpoint was fetched. Raw HTML was not retained as a repository artifact; only sanitized technical findings are recorded here.

**Next gate:** obtain an explicitly non-explicit, authorized first-party demo/test URL (or an owner-provided sanitized capture of a lawful player session). Inspect its actually loaded first-party wrapper bundle and player-scoped controls; establish the registry entry's element association and real method signatures before writing a fixture. Then record available numeric literal heights, the requested target, selected-state readback, and independent effective-height evidence. If that surface presents an age/login/region/consent gate, stop for the human rather than changing domains, fabricating state, or replaying media URLs. Until then, neither an API adapter nor an end-to-end ≤2160 result is verified.

## Follow-up: referenced scripts and source-only consumer tests

Date: 2026-11-13 (session date). **Still blocked for quality implementation, but no longer limited to an empty-registry observation.** No `src/platforms/pornhub.js` was created: the two newly evidenced hooks read playback time, not quality.

### What was actually retrieved

Re-read `/support` and `/webmasters` anonymously as HTML, without executing them or following media links. Expanded the source inventory to both external `script src` references and quoted, deferred JavaScript URLs. Read all **29 distinct `ei.phncdn.com/www-static/js/` script URLs** found in the support HTML after excluding the separately understood HLS, Vue, jQuery, and Babel libraries (normalizing its duplicated `/js//playlist/` reference). Third-party advertising/chat/analytics script hosts were also excluded. All 29 returned 200; previously retrieved successful assets could be reused locally. Account/payment/captcha-related scripts were read only as static text, never executed or used to submit requests.

The 29 filenames, relative to `/www-static/js/`, were:

```text
google-sso-init.js
header.js
lib/atlasbundle.min.js
lib/generated-lib.js
lib/generated/front-support-pc.js
lib/interval-helper.js
lib/networkbar-6.0.0.js
lib/ph-functions.js
lib/probiller-common.min.js
lib/user-clogs.js
lib/utils/mg_utils-1.0.0.js
lib/utils/mg_utils-2.0.0.js
mg_modal-1.0.0.js
mg_modal-2.0.0.js
onboardingModalFlow/widgets-onboardingModalFlow.js
ph-footer.js
phub.js
playlist/playlist-basic.js
pornhubX/purchase_pornhubX.js
premium/premium-modals.js
v-flag-modal.js
v-recaptcha.js
vmobile/auth-shared-mixin.js
vmobile/connection-modal.js
vmobile/login-form.js
vmobile/signup-form.js
vmobile/sso-enter-email.js
widgets-live-popup.js
wysiwyg-link-tracking.js
```

All use `?cache=2026111202`. Case-insensitive literal searches of those sources found **zero `quality`, `setQuality`, or `getQuality` occurrences**. `MGP.players` occurs only in the two consumers below. This bounded result does not rule out a differently named, separately loaded player implementation. Other quoted `.js` strings in the inspected shared code concerned analytics, logging, checkout, or captcha, not an identified player bundle; they were not followed.

| Source | New evidence | SHA-256 of retrieved bytes |
| --- | --- | --- |
| **S13** — [ph-footer.js](https://ei.phncdn.com/www-static/js/ph-footer.js?cache=2026111202) | `Object.keys(playerObjList)[0]` → `MGP.players[id]`, guarded by a matching `document.getElementById(id)`; calls `isPlaying()` then `getCurrentTime()`. Registry values are not used. This telemetry consumer's first-key heuristic is **not** a verified main-content selector. | `f984479cb2c5a980761964f55370a935cb9904a83f4a44f5f15ccb4870bc6e2f` |
| **S14** — [v-flag-modal.js](https://ei.phncdn.com/www-static/js/v-flag-modal.js?cache=2026111202) | `setTimestamp` looks up `MGP.players[VIDEO_SHOW.videoId]` when `this.platform === "pc"`, or `MGP.players[VIDEO_SHOW.playerId]` otherwise, then calls `getCurrentTime()`. This is a second, keyed consumer contract, not evidence that either ID exists on a live safe player. | `c8be58c7d26cc6f3f3d6dee4bc69571f9f32e3a24464960f7eb14637f8f26f23` |
| [phub.js](https://ei.phncdn.com/www-static/js/phub.js?cache=2026111202) | Has an `.mgp_overlayText.mgp_link .mgp_text-label` consumer unrelated to quality; no MGP implementation or quality path. | `3b6432595e05e2b53a793968260d4e02aff145936f25d18075067ba1b5368ecc` |
| [front-support-pc.js](https://ei.phncdn.com/www-static/js/lib/generated/front-support-pc.js?cache=2026111202) | Support-specific generated code; no player/quality hook found. | `24af084d84ffa91aab5cb76fd2b3859bc17607ad942a107ce5046c39cd64a453` |

### Further discovery, without access circumvention

- The web-search integration failed again. A new named browse session (`yt4k-pornhub-technical-20261113`) was used only for technical Google searches, with no existing tabs adopted. Image/media requests were blocked in that session before the Pornhub-specific searches. No Pornhub page was rendered and no screenshot was taken. Search summaries/AI overviews were **not** treated as API evidence. The session was deleted after the checks.
- Search returned [a third-party userscript discussion](https://sleazyfork.org/pt/scripts/428267-better-pornhub-com/discussions/121186). Its static HTML mentions `MGP.players[player_key].settings().events["buttons.expand"]()`. This is an unverified, historical expand-button anecdote, not a quality setter; none of it was executed or added to production.
- Two discovered CheckPhish technical DOM captures returned **403** over anonymous HTTP. They were not retried in the browser or via alternate domains. A GitHub contents request for a discovered integration repository also returned **403** and was not worked around. An initially guessed source path returned 404, yielding no evidence.
- A discovered ANY.RUN technical report returned 200 as text but contained no referenced `phncdn.com` JavaScript URL in the returned HTML. No report screenshots, attachments, media, or sandbox execution were requested.
- In that pass, no first-party non-explicit player demo, actual wrapper implementation URL, populated player, quality UI, or authoritative quality API documentation was found. Valid video identifiers, embed dumps, media endpoints, and manifests were not requested in that pass. The subsequently authorized ordinary-watch route is assessed below. There is still no justified native-HLS, HLS.js, progressive, or UI-quality path to implement yet.

### Executed tests — deliberately not quality validation

Added [sanitized first-party consumer excerpts](../../prototypes/pornhub/site-consumers.fixture.js), [scope notes](../../prototypes/pornhub/README.md), and [Node tests](../../tests/pornhub.test.cjs). Only the small time-reading function bodies are executed in a VM against explicit fake objects. The full site scripts, tracking/reporting code, and player are never executed. Run:

```sh
node --test tests/pornhub.test.cjs
```

The 12 cases cover empty/missing/stale registries, matching-element guards, playing/stopped wrappers, key-vs-value lookup, ambiguous multiple players, desktop/non-desktop keyed lookup, missing `VIDEO_SHOW`, and the consumers' unsafe assumption that the MGP global exists. These checks establish what the observed call sites mean, including why copying the footer's first-player heuristic would be unsafe. **They do not validate quality control, automatic quality operation, or live Pornhub interoperability.** No dimensions were fabricated, no generic HLS test was relabeled as a Pornhub test, and no unsupported adapter was registered.

Observed test result: **12 passed, 0 failed, 0 skipped**. A separate local comparison confirmed both fixture function bodies occur exactly in the retrieved, hash-identified source files. The saved temporary inventory was also checked for 29 successful sources and zero matches for the three quality search literals. Those provenance checks do not add live-player coverage.

## Authorized ordinary-watch HTML assessment

The user subsequently authorized normal public watch-page **technical source inspection**, superseding the earlier conservative no-valid-ID scope. This route was assessed before requesting any demo or wrapper URL from the human.

**S15 — first-party source:** obtained a normal `www.pornhub.com/view_video.php?viewkey=<redacted>` link directly from the anonymous [support HTML](https://www.pornhub.com/support). No identifier was fabricated, printed, or stored. Requested HTML only, with redirect following disabled, no browser execution, no cookie jar/profile, and no subresource requests. The response was **200 `text/html; charset=UTF-8`**, about 1.58 million characters. Three bounded HTML reads assessed broad gate markers and then their technical context; none was a retry after an HTTP refusal, and no alternative domain or identifier was selected to evade a gate. Watch HTML, content strings, configuration values, and identifiers were processed only in memory and discarded.

### Actual gate evidence, not just keyword matches

The HTML includes this sanitized DOM structure:

```text
body.logged-out
  div#js-ageDisclaimerModal.modalWrapper
    div.ageDisclaimerButtons.isPc
      button.gtm-event-age-verification.js-closeAgeModal.js-av-cta.buttonOver18.greyButton
      button.gtm-event-age-verification.greyButton.ageDisclaimerExit.js-av-cta.buttonUnder18
  div#cookieBanner
```

The page's inline initialization constructs the age-disclaimer `MG_Modal` with **`closeButton: false` and `closeDocument: false`**, and branches on **`!getCookieAdvanced(...)`** for prior confirmation. The anonymous HTTP inspection supplied no confirmation cookie. Its normal enter-site handler closes that modal; no handler was run here. This is specific evidence of a site-owned **age-confirmation flow**, rather than a guessed unavailable-video condition. Because scripts were intentionally not executed, the modal was not rendered and no live visible-state claim is made.

The page also declares `isGlobalCookieBanner = 1`, includes `#cookieBanner`, and contains cookie-choice initialization. This establishes a consent UI surface, **not proof that consent is an additional blocking gate in this unexecuted response**. A broad `geo_block` keyword match occurred inside an inline script/template and does not establish a geographical denial. Captcha-related widget strings likewise do not establish that an active challenge was presented. The response did not show an HTTP refusal or confirmed geo/login/paywall failure.

**Stopped at the age-confirmation evidence, as instructed.** Did not press an over/under-age control, write/replay a cookie, accept/reject consent, follow a media URL, execute the player, or fetch a wrapper past this gate. No images, screenshots, video, or manifests were fetched; tool results and repository artifacts contain no titles or explicit text. No new browse session was needed. Therefore the quality enumeration/setter/readback, literal dimensions, and all automatic quality paths remain unverified; no production adapter was added. The existing 12 source-consumer tests are unchanged and do not imply any watch-page playback validation; they were rerun after this assessment and all 12 passed.

### True remaining human dependency

**The human must complete the site's ordinary age-confirmation flow themselves, only if legally eligible and permitted in their region.** If the normal site also requires a cookie-consent choice, login, or stronger verification, the human must handle that ordinary flow themselves; stop rather than bypass it. Do not send cookies, tokens, account data, content identifiers, screenshots, or media.

After the human confirms that the normal gate is completed in their browser, autonomous discovery can resume in a **new agent-owned session** using the ordinarily authorized browser state, with image/media/network blocking established before any navigation—or static HTML retrieval in that authorized context without executing scripts. The agent should discover the actually referenced wrapper URL itself; **the human is not currently being asked to find or supply that URL**. Do not adopt the human's existing tab, synthesize gate state, switch domains, or infer that permission to inspect HTML authorizes explicit playback.

A public authorized non-explicit demo or sanitized wrapper capture remains an optional alternative, not the prematurely required dependency. Once the source interface is discovered, test actual source functions or an authorized non-explicit harness before registering any adapter. Live automatic quality confirmation still needs authorized non-explicit material and measured eligible `{width,height}` options, requested target, selected-state readback, and settled decoded dimensions; source fixtures alone cannot establish that result.

### Browser confirmation of the human gate

Parent validation on 2026-11-14 opened only `/support` in a new agent-owned
browser tab, with image/media and other non-document/script/style/font
requests blocked before navigation. The snapshot showed the normal over/under
age controls. A fresh CSS/layout read independently confirmed the active
cloned controls were visible, each **296×50**, inside a visible
`[role="dialog"]` labelled `Modal window`. The original
`#js-ageDisclaimerModal` template was hidden: its visibility alone is not a
valid gate check because the modal system clones/moves its contents.

The browser handoff asked the eligible human to complete only the normal
age/consent flow; it timed out without acknowledgment. A fresh read still
found the visible cloned confirmation controls. No age button was clicked
and no cookie/gate state was synthesized. The tab was retained solely for
this requested human step; no watch page or media was loaded.

## Authorized age confirmation and actual-wrapper validation — 2026-11-14

### Access and privacy boundaries

The user explicitly stated they are 22 and authorized the ordinary **“I am
18 or older - Enter”** self-attestation. Created a new, agent-owned browse
session, `yt4k-pornhub-wrapper-20261114`; no user tab was adopted. Images and
media were blocked before loading `/support`. No screenshot or explicit frame
was requested, displayed, or saved. No optional cookie/tracking consent was
accepted. No mandatory consent, login, payment, region restriction, identity
verification or CAPTCHA was encountered.

An ordinary Playwright click failed while scrolling with “Target page,
context or browser has been closed”, as it had in the parent session. This
was **not** treated as success. `browse doctor` reported a reachable 0.0.15
relay and protocol-compatible 0.0.16 extension, no crashed targets or process
faults. `browse status` showed the original agent-owned support tab still
present but its session detached. Reattached **only that same owned tab**,
took a fresh snapshot, focused the visible authorized button and pressed
Enter through the keyboard. A subsequent fresh read found **no visible age
button and no active dialog**, not merely the hidden original template.
Another ordinary `/support` load later again had zero visible age controls.
No confirmation cookie or gate state was fabricated, read out, or replayed.

Fetched public watch HTML through same-origin browser `fetch`, taking its
ordinary link from the support DOM. Only HTML was loaded, not a rendered
watch page. The first response was 200 with roughly 1.31 million characters.
Raw HTML, configuration values, identifiers and URLs were processed in memory
and not retained in repository artifacts. Repository artifacts contain no
account data, cookies, tokens, content identifiers or titles. All final saved
fixtures contain technical numbers and synthetic test names only.

### Newly identified first-party implementation

The actual watch HTML references **S16**:
<https://ep.phncdn.com/prod/9.2.7/desktop-player.min.js>.
Retrieved size: 472,767 bytes; SHA-256:
`40340f0ce9623729dab1b08d48a97611190a5d943a4bd7922bca03a2d2692cd9`.
Unlike the earlier support consumers, this is the player implementation.

Observed interfaces and associations:

- Site initialization calls `MGP.createPlayer(playerContainerId, config)`.
  `playerContainerId` is `'playerDiv_' + embedId`; its element has class
  `.playerFlvContainer` inside `.original.mainPlayerDiv`. Configuration maps
  `mainRoll.mediaDefinition` directly from `flashvars.mediaDefinitions`.
- `MGP.players[root.id]` is the wrapper for that root; its cached
  `settings().playerId` is the same root ID. The actual video class is
  `video.mgp_videoElement`. This is a keyed root association, not the old
  footer's first-entry heuristic.
- `player.quality.get({list:true})` returns numeric offered source qualities;
  `player.quality.get()` reads the current **requested/selected** quality,
  not necessarily the currently decoded dimensions.
- The real setter is
  `player.quality.set({quality: number, auto: false, manual: false})`.
  It returns **undefined**, not a boolean/promise confirming playback.
- The setter forwards to the wrapper's global `hVL` event with its own
  `playerId`; `manual` becomes `isManual`. The source controller calls
  `Le({quality,auto}, null, isManual)`. Its quality-preference writer `Me`
  returns without writing when `isManual` is false. This avoids deliberately
  changing the user's stored quality preference; the unmodified player may
  still maintain its own unrelated adaptive/runtime state.
- `isSourceReady()` and `getCurrentState().adRollReady` allow waiting for
  content readiness and declining ads. The source setter itself chooses the
  existing progressive/HLS source and preserves player bookkeeping. No
  `video.src` replacement, constructor hook, fetch interception, framework
  patch or new production media library is used.
- The desktop wrapper's HLS library version is **1.6.15**, despite the older
  shared support-page `hlsLib` reference to 1.5.14. Do not confuse those
  sources. `MGP.buildInfo` exposes the desktop/player/library versions.

Related source assets used in the safe local harness:

| First-party public asset | SHA-256 |
| --- | --- |
| <https://ep.phncdn.com/prod/9.2.7/desktop-player.min.css> | `659c4c88554357d4464ab7d0c8cde19747cd9031caedb02694ec2dc2c155a3f2` |
| <https://ep.phncdn.com/prod/9.2.7/external-libraries/hls.light.min.js> | `1fba6f24e9a8d916465219dcf25348940815529cc8b2b25ed75db3caebdf0b64` |

These public library assets live only under `/tmp/opencode`. They are not
copied into the repository or production userscript.

### Authorized site rendition evidence — source/manifest only

The first inspected watch response declared explicit HLS sources
426×240, 852×480 and 1280×720, plus a remote MP4 ladder. A later ordinary
support-linked response exposed the fuller ladder preserved in
[`site-ladder.fixture.json`](../../prototypes/pornhub/site-ladder.fixture.json).
These are separate anonymous responses; the support page's first link is not
assumed to be a stable content identity.

For the latter response, read **only its referenced HLS master text** through
normal browser fetch, using the original in-memory source references. No
segment, child media playlist, frame or explicit video was fetched. All four
masters returned 200, each with a single `RESOLUTION`:

| Quality key | Site definition dimensions | Master dimensions |
| --- | --- | --- |
| 1080 | 1920×1080 | 1920×1080 |
| 240 | 426×240 | 427×240 |
| 480 | 852×480 | 853×480 |
| 720 | 1280×720 | 1280×720 |

The maximum known authorized height in this response was **1080**, not 2160.
The one-pixel lower-rendition width discrepancy is recorded, not hidden:
neither metadata source is decoded-width evidence. The adapter conservatively
requires exact decoded dimensions for a positive effective-quality report;
a mismatch does not produce a success claim or endless retries. No live-site
4K entitlement or playback claim follows from these reads.

### Actual unmodified-wrapper playback — local non-explicit harness

[`wrapper-harness.html`](../../prototypes/pornhub/wrapper-harness.html) and
[`serve-harness.cjs`](../../prototypes/pornhub/serve-harness.cjs) use the full
hash-identified wrapper **without modification**, the site's demonstrated
configuration shape, and locally generated solid-colour 426×240, 1280×720
and 3840×2160 media. Source definitions have actual measured test-media
dimensions, not fabricated 4K labels on a small clip. HLS playlists/segments
were generated from those same clips. No site media is used in the harness.

Before navigation, browser routing allowed only `127.0.0.1`, blocking images
and all nonlocal requests, including the unmodified wrapper's attempted
telemetry. This harness-only privacy boundary is **not** a production network
filter. No optional tracking choice was accepted.

Manual API discovery first established that the setter returned undefined,
the numeric getter changed before decoding settled, and subsequent actual
decoded dimensions became 3840×2160. Then ran the **production adapter and
shared core automatically**, with no direct quality-setting call by the test
driver:

| Harness URL parameters | Offered numeric qualities | Automatic requested target | Selected readback | Settled decoded dimensions | Adapter event |
| --- | --- | --- | --- | --- | --- |
| `format=mp4&auto=1` | 2160, 720, 240 | 2160 | 2160 | 3840×2160, readyState 4 | `pornhub effective`, format mp4 |
| `format=hls&auto=1` | 2160, 720, 240 | 2160 | 2160 | 3840×2160, readyState 4 | `pornhub effective`, format hls |
| `format=hls&auto=1&cap=720` | 2160, 720, 240 | 720 | 720 | 1280×720, readyState 4 | `pornhub effective`, format hls |

All three reached media time 8 seconds. HLS used the actual 1.6.15 light library.
After the HLS automatic result, explicitly changed the harness quality to
240 through the real wrapper. A later read remained selected 240, decoded
426×240, with only the original one requested/effective adapter event pair:
the adapter did not fight this later override.

**Evidence distinction:** this proves API interoperability and decoded
non-explicit playback with the actual wrapper. It does **not** prove a live
site player was populated, live site ads transitioned, site preference
restoration worked, or a userscript manager injected into the live site.
The public HTML and master reads establish site integration/source evidence,
not live automatic player or decoded site-media verification.

### Implementation and checks

Added [`src/platforms/pornhub.js`](../../src/platforms/pornhub.js), registered
only for `www.pornhub.com`. It checks top-level `/view_video.php`, desktop
MGP 9.2.7, exact root/settings ownership, one content video, content readiness,
and the public quality getter/setter. It maps numeric offered IDs to positive
explicit source dimensions and applies the shared literal-height policy.
It fails closed for unknown dimensions/IDs, active remote/master-only
ladders, other MSE formats, native HLS, ads, embeds, ambiguous dimensions and
unrecognized versions. The HLS path additionally requires the observed
HLS.js 1.6.15 wrapper build information; progressive sources must match the
actual current source. All quality changes use the wrapper's own setter.

One bounded verification attempt per wrapper/video instance; no repeat
forcing after an ignored switch or later user change. Wrapper/video
replacement can be discovered on later scans. Same-wrapper source-generation
recovery is intentionally **not claimed**. No first-byte/initial-buffer cap,
all-browser support, Premium/regional/mobile support, or menu fallback claim.

Reproduction commands are documented in
[`prototypes/pornhub/README.md`](../../prototypes/pornhub/README.md).
The dependency-free preparation script only downloads the hash-identified
public technical assets and invokes an already-installed ffmpeg; it does not
install dependencies. Node tests separately exercise real adapter code with
explicit stubs and retain the earlier 12 source-consumer checks. Those Node
stubs are not relabeled as live or decoded playback.

No parent-owned core/build/README/bundle/bundle-test file was edited. The
installable bundle is deliberately not regenerated by this worker: the parent
must decide the appropriate support wording, update its old no-Pornhub-match
assertion if integrating, and rebuild/revalidate its final bundle.

Executed final checks:

```text
bash prototypes/pornhub/prepare-harness.sh
  Three pinned asset SHA-256 checks: OK (existing generated media reused).
node --check src/platforms/pornhub.js
  Passed.
node --check prototypes/pornhub/serve-harness.cjs
  Passed.
node --test tests/pornhub.test.cjs
  45 passed, 0 failed, 0 skipped.
npm test
  99 passed, 0 failed, 0 skipped (including the still-unmodified old bundle).
npm run check
  Expected exit 1: Userscript is stale; run npm run build.
  The new source adapter is not yet in the parent-owned generated bundle.
```

The local server was launched with
`node prototypes/pornhub/serve-harness.cjs`. Both automatic 2160 runs, the
720-cap run and the override readback above used the real connected browser,
not Node stubs. Browser session and local server are cleaned up after this
worker's verification; no human handoff is pending.

## REAL public watch-page integration and decoded playback — 2026-11-14

**The real-site gap is closed for the observed desktop HLS.js path.** This
follow-up is not the local wrapper harness: it used the ordinary, actual
public watch page discovered from the site's support DOM, in a new own named
browse session, `yt4k-pornhub-real-runtime-20261114`. No user tab was adopted.
The previously authorized ordinary age confirmation persisted. No stronger
gate or human dependency was encountered.

### Visual protection and normal playback

Before navigation, installed an early document-init observer keeping the
whole document root at `opacity:0 !important` and every video/image/canvas/
picture hidden and transparent, including later insertions. Before playback,
strengthened it to reassert protection after inline-style changes and mute
video/audio on insertion and volume changes. Every reported playback read
independently confirmed page opacity zero, video visibility hidden, video
opacity zero, and muted true. There was no screenshot, frame read/capture,
explicit description or title output. Artifacts contain no content ID, media
URL, signed reference, cookie/token, account data or preference value.

Initial discovery allowed only documents/scripts/styles/fonts; all other
requests, including HLS fetch/XHR media, were blocked. After confirming the
actual populated wrapper and hidden DOM, performed an ordinary reload with
early visual protection still installed, images still blocked, and ordinary
player/media/ads requests allowed. No ad was skipped and no ad control was
clicked. Observed content state had `adRollReady:false` and
`adRollStarted:false`; this does not establish ad-transition coverage.
The real player subsequently reached readyState 4 and advancing media time
without any frame being visually displayed.

### Actual runtime incompatibility found, then fixed test-first

Observed one MGP registry entry and one content root/video. The real root
keyed `MGP.players[root.id]`, `settings().playerId === root.id`, and root/video
containment all matched. Runtime build was desktop **9.2.7**, HLS.js (full
`hlsjs`, not the harness's light build) **1.6.15**. Offered numeric qualities
were **720, 480, 240**. Source readiness was false with media blocked, then
true after the normal protected reload.

Crucially, `player.settings().mainRoll.mediaDefinition` was **empty on the
production host**, unlike the loopback harness. The retrieved implementation
redacts that cached settings clone outside its development/CDN host list.
No hostname, site guard or script was patched to disable that behavior.
The same real implementation already exposes public
`MGP.inspectOriginal(root.id)`, returning the original configuration captured
by `createPlayer(root.id, config)`. Its **keyed** result held the actual
426×240, 852×480, 1280×720 HLS definitions and the unrelated remote MP4 entry.
The original input has no generated `playerId`; ownership remains checked
against the actual keyed wrapper and its processed settings ID.

Added a regression requiring selection with redacted settings plus the keyed
public original: **47 passed / 1 failed** before the fix, then **48 passed**.
`definitionsFor()` now uses that API only when processed sources are
specifically an empty array. It does not override nonempty unknown settings,
enumerate unrelated originals, fabricate dimensions, or add a media API.
Verification checks the same original-definition object identity.

A real 240 test precondition also decoded **427×240** despite source width
426; another settled 240 run decoded **426×240**. Added a one-pixel-width
regression: **49 passed / 1 failed**, then **50 passed** after allowing at
most one pixel of decoded width discrepancy. Selected getter and **exact
literal height** remain required; larger width discrepancies still fail.
Effective logs record the actual decoded dimensions. No height tolerance or
above-cap allowance was added.

### Requested / selected / decoded — REAL site, not fixtures

Injected the actual current `src/core.js` and production adapter inside one
page-world IIFE; a separate technical observation tail captures logs and
compares the quality preference in memory. It does not replace or wrap the
site setter, source, framework, HLS constructor, fetch or storage methods.
Final probe source is [`live-proof-tail.js`](../../prototypes/pornhub/live-proof-tail.js).
Sanitized observations are in
[`real-site-observation.json`](../../prototypes/pornhub/real-site-observation.json).

| Real-site run | Offered heights | Config cap | Automatic requested / getter selected | Decoded result |
| --- | --- | --- | --- | --- |
| From an explicitly prepared, nonpersistent 240 selection, decoded 427×240 | 240/480/720 | 2160 | 720 / 720 | 1280×720, readyState 4, playing, time 17.743449 |
| Early document-start injection before normal player readiness | 240/480/720 | 2160 | 720 / 720 | 1280×720, readyState 4, playing, time 8.245692 |
| Final adapter with a lower configured height cap | 240/480/720 | 240 | 240 / 240 | 426×240, readyState 4, playing, time 59.478405 |
| Final current adapter, default cap, switching back from decoded 240 | 240/480/720 | 2160 | 720 / 720 | 1280×720, readyState 4, playing, time 115.334037 |

Each automatic run produced a genuine `pornhub requested` followed by
`pornhub effective` event. Initially, the setter/getter changed while decoded
dimensions reset to zero; **that was not accepted as success**. The later
positive reads required the independent video dimensions above. The main
player remained source-ready, root-owned, hidden and muted. Highest live
authorized height was 720; no live-site 4K claim is made.

After the early automatic run, deliberately set 480 through the normal
wrapper with `manual:false` to avoid persisting a test preference. A later
read remained selected 480, decoded **852×480**, time 51.266084, with no new
automatic request: the adapter respected the subsequent override.

For every run, the existing `mgp_player.quality` field was readable, absent
before the adapter and still absent afterward. Only equality/presence flags
were exported; no value was saved. Combined with the observed setter's
`manual:false` path skipping its quality-preference writer, this verifies
that the test did not create/change a stored quality preference. It does
**not** claim the whole site's storage or adaptive/runtime bookkeeping was
unchanged.

### Final checks, cleanup, and remaining boundaries

```text
node --test tests/pornhub.test.cjs  → 50 passed, 0 failed, 0 skipped
npm test                         → 104 passed, 0 failed, 0 skipped
node --check src/platforms/pornhub.js                → passed
node --check prototypes/pornhub/live-proof-tail.js  → passed
git diff --check                 → passed
JSON parse of real-site-observation.json            → passed
```

Deleted the own named browse session after the final real playback read;
there is no retained playback tab or pending handoff. Parent-owned core,
build, generated bundle, README and bundle assertion were not edited.
The existing build is still intentionally stale until the parent integrates
the new source and updates its old exclusion assertion.

Remaining limits are **not** access blockers: live MP4/native HLS, 4K site
entitlement, mobile/regional/Premium variants, ad transitions, same-wrapper
source-generation recovery, and actual userscript-manager delivery were not
universally tested. The narrow real desktop HLS quality selection itself is
now verified; local-wrapper 2160 playback remains a separate stronger-height
test, not a substitute or a live 4K claim. No strict first-byte cap is claimed.

## FINAL generated four-adapter bundle — REAL site smoke, 2026-11-14

**Passed with the exact generated `yt4k-1.2.0.user.js`: offered maximum
1080 → selected 1080 → decoded 1920×1080, readyState 4 and playing.** This
supersedes the earlier worker note that the bundle was intentionally stale:
the parent has now integrated all four adapters and rebuilt it.

Exact tested file: **29,208 bytes**, SHA-256:

```text
23a14e4ea13b4d21eed99f303b3225d76a32447baa4ca3eb61ff9309e8e6bb47
```

Copied the generated file byte-for-byte to `/tmp/opencode` for injection.
Both files' SHA-256 values matched before and after the browser check; the
browser execution additionally hashed the actual injection string before
installing it. Injected that entire unchanged file with `page.addInitScript`
before the site's player initialized, including its existing four adapter
registrations, IIFE and terminal `YT4K.start(location.hostname)` call.
**No implementation/configuration changes, log overrides, direct adapter
start, or alternate quality setter were used.** Defaults remained
`maxHeight:2160` and `debug:false`. A separate read-only observer inspected
numeric public getters/dimensions and compared preference presence/equality;
it did not wrap the player, storage, network, or bundle APIs.

Used a new own session, `yt4k-pornhub-bundle-final-20261114`, and discovered
the ordinary watch link from `/support` without exporting its identifier or
URL. Normal age confirmation persisted; active age controls/dialogs were
zero. Initial discovery blocked all non-document/script/style/font requests.
The controlled reload retained early whole-page opacity zero, hidden video
elements, mute enforcement and image blocking, while allowing ordinary
player/ads/media requests. There was no gate bypass, ad skip, screenshot,
frame capture or content/title output.

This independently discovered public watch page offered a higher maximum
than the earlier 720 test page:

| Offered quality | Source dimensions | Enabled/unlocked |
| --- | --- | --- |
| 1080 | 1920×1080 | Yes |
| 720 | 1280×720 | Yes |
| 480 | 854×480 | Yes |
| 240 | 426×240 | Yes |

Before source readiness, its ordinary selected getter was **720**, decoded
dimensions 0×0. After the **unchanged bundle's normal host dispatch**, the
independent getter read **1080**, exactly the highest known eligible height
under the default cap. Only after buffering/readiness settled did the video
report **1920×1080**, readyState **4**, paused **false**, media time
**16.516703**. No direct quality-control call was made by this smoke driver.
The observer was initialized before `window.MGP` existed, confirming early
injection rather than a late fixture pretending to be startup.

The actual runtime was desktop MGP **9.2.7**, full **hlsjs 1.6.15**, with one
registry entry and one root-owned content video; keyed wrapper lookup and
settings/root ID equality both held. Its processed settings sources were
redacted, exercising the production `inspectOriginal(root.id)` path in the
final bundle. Source readiness was true; `adRollReady` and `adRollStarted`
were false. Whole-page opacity zero, hidden/transparent video and muted true
were rechecked with the positive decoded read. The stored quality preference
was absent before and remained absent/unchanged afterward; no preference
value was exported.

Sanitized numbers and hash are appended under `finalBundleSmoke` in
[`real-site-observation.json`](../../prototypes/pornhub/real-site-observation.json).
The own browser session was deleted immediately after verification. No
production/module/test or parent-owned file was changed for this smoke.
Parent retains responsibility for final build/104-test checks. Limits:
this proves the actual generated bundle's observed desktop HLS path at
**1080**, not live 4K, native HLS/MP4, ad transitions, every source-generation
case or userscript-manager installation/delivery. No first-byte cap is claimed.
