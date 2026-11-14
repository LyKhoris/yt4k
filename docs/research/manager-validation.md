# Installed userscript validation checklist

Status: **not yet executed in an installed userscript manager**. Early
page-world browser injection and real-wrapper harness tests are different
evidence. This checklist closes the remaining installation/CSP gap without
mistaking a console-injected adapter for a working installation.

## Setup

1. Build the local code with `npm run build`, then run `npm test` and
   `npm run check`.
2. Use the intended browser and Tampermonkey/Violentmonkey configuration.
   Record versions. Enable the browser/manager's required script permissions
   and site access using its normal prompts.
3. Install the **local generated file**, not the old GitHub raw version unless
   the changes have actually been published. Disable duplicate yt4k copies
   during the test; restore unrelated configuration afterward.
4. Temporarily enable `debug` in the installed script's `config`. Hard-reload
   the test page. Do not inject core/adapter code through DevTools, nonces,
   `addInitScript`, or a second extension: those would bypass the installation
   path this test is meant to validate. Read-only inspection is fine.

## Required acceptance checks

- **Startup and realm:** the installed copy runs after a normal hard reload
  and can access the recognized page-owned player. Merely seeing the manager's
  enabled badge is not proof of selection. Record skipped/private-API errors
  separately from missing manager execution.
- **YouTube:** on an ordinary landscape watch video, verify the real fixed
  Quality selection and eventual decoded height. Include a 60fps-labelled 4K
  video and a video whose best available quality is below 4K. Premium upgrade
  entries must not be clicked.
- **Reddit:** verify native packaged-MP4 feed and post playback with actual
  source dimensions, selected source identity and decoded dimensions. Repeat
  after scrolling, post navigation and Back/Forward. Compare the existing
  local quality preference before/after without printing other storage.
- **X:** test a fresh, unhovered player. Verify the owning HLS instance's
  `manualLevel`, `autoLevelEnabled === false`, and eventual decoded dimensions.
  The local menu may still display Auto; this is a known cosmetic mismatch,
  not an authoritative engine readback. No Settings/hover action should be
  necessary for the installed adapter to make its request.
- **Pornhub:** on a normally authorized desktop watch page, verify the keyed
  MGP 9.2.7 wrapper, actual offered dimensions, selected quality getter and
  eventual decoded height. HLS requires the recognized 1.6.15 library path.
  Confirm no stored quality preference is created/changed. Wait for ordinary
  content readiness rather than bypassing ads. Live site 4K and progressive
  playback are separate tests from the solid-colour wrapper harness.
- **Overrides/lifecycle:** change to a lower quality after successful automatic
  selection and confirm the same source is not repeatedly forced upward.
  Navigate to another video and confirm that new supported source is handled.
- **State preservation:** check playback position, playing/paused state, sound
  decoding, seeking and fullscreen transitions. Exercise normal buffering or
  player reset and record whether that path reinitializes or safely skips.

Only claim live 2160p/above-cap/portrait coverage when the actual player offers
those verified dimensions. An 8K title, a short-edge label, a successful click
or a passing Node fixture is not that evidence. Unknown/unsupported paths are
left unchanged; they are not guaranteed capped. Initial loading may precede
selection, so this never establishes a strict first-request ceiling.

## Matrix and report

Run the browser/manager combination actually used first. Chromium and Firefox,
and Tampermonkey and Violentmonkey, are separate coverage entries rather than
an implied universal pass. For each case record only:

- Browser/manager versions and whether the unmodified installed bundle ran.
- Supported player type and observed numeric rendition ladder.
- Requested, selected/engine-fixed, and eventual decoded dimensions.
- Lifecycle/override outcome and any unsupported or failed path.

Restore the debug setting and remove only temporary test installations. Keep
credentials, cookies, account data, signed media URLs and graphic media out
of the report.
