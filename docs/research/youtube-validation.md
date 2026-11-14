# YouTube regression validation

Tested 2026-11-14 UTC in a separate browse tab, Linux Chrome 157.
Public sample: <https://www.youtube.com/watch?v=aqz-KE-bpKQ>
(Blender Foundation's Big Buck Bunny).

## Automatic adapter test

Evaluated the actual `src/core.js` + `src/platforms/youtube.js` with the
normal `YT4K.start(location.hostname)` call, not a hardcoded quality command.
The browser tool's isolated execution world could not access YouTube's
page-owned player methods, so this exercised the DOM menu fallback.

1. Set 144p through the real menu. Decoded dimensions were **256×144**,
   playback active, time **79.287936**.
2. Injected the adapter. Without further quality clicks, decoded dimensions
   became **3840×2160**, time **79.511894**, still playing.
3. Waited for buffered playback: **3840×2160**, `readyState=4`,
   time **92.451604**, no media error, decoded audio bytes **202539**.
4. Independently reopened Settings → Quality: **2160p60 4K** had
   `aria-checked="true"`.

An earlier direct `applyMenu` test also preserved paused state and position
while switching from 854×480 to 3840×2160.

## Regressions caught

- The old fallback waited for a boolean then called `querySelectorAll` on it.
  The new fallback waits for the actual menu element.
- Initial integration testing exposed a new parser mistake: a word boundary
  after `p` excluded real labels such as `2160p60`, causing 480p selection.
  A failing regression test reproduced this, then the parser was corrected.
- Radio options are scoped by role, excluding the hidden parent menu's
  `Quality480p` text from the candidates.
- A second public sample (`L_LUpnjgPso`) exposed both ordinary 1080p and a
  Premium upsell option. The fallback now excludes Premium entries/badges;
  a failing upgrade-click regression test guards this. The generated bundled
  script then selected ordinary **1920×1080**, `readyState=4`, no media error,
  with **1080p HD** independently checked in the real menu. No subscription
  or payment action was performed.
- A non-Auto API result is no longer automatically considered success: the
  reported quality must equal the requested target or the menu is attempted.
- A single available quality is accepted; failed initialization does not mark
  a video permanently handled.

## Limits

This validates actual DOM switching and automatic orchestration on one
desktop player, not every browser, mobile layout, locale, userscript manager,
or an absolute pre-buffering network ceiling. The API path is covered by
logic tests, not live page-world evaluation. The tab had normal existing
browser extensions; their unrelated blocked telemetry/resource errors were
not treated as adapter failures. No signed URLs, account details or tokens
were stored. No autoplay/account-setting controls were changed.

The adapter deliberately waits for nonzero decoded dimensions and skips
portrait videos: named YouTube quality levels alone do not prove a portrait
rendition's literal vertical height. This conservative boundary is also
covered by the automatic-orchestration fixture. Landscape 2160p selection
is the verified live path above.
