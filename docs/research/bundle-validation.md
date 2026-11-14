# Bundled userscript validation

2026-11-14 UTC; Linux Chrome 157. Separate agent-owned tabs in the connected
browser, not fresh browser profiles. No userscript manager was installed or
reconfigured. Production source is bundled by `npm run build` into
`yt4k-1.2.0.user.js` (metadata version 1.3.0).

Update-enabled release **1.3.1** changes only the generated metadata/version,
not the runtime body tested below. A direct comparison against the preceding
Git revision verified the body after `==/UserScript==` is byte-for-byte
unchanged. The new stable update/download metadata and preserved name/namespace
have a regression test: **110 tests pass**; build consistency, syntax and diff
checks pass. Native Tampermonkey installation/update detection remains the
user's separate test, not a result claimed by these checks.

## Actual generated script, not a supplied quality command

The generated file was copied to `/tmp/opencode`, read by the browser tool,
and executed without altering its adapter/core logic.

| Platform/test | Result |
| --- | --- |
| YouTube, final landscape-guarded bundle on `aqz-KE-bpKQ` | **256×144 → 3840×2160**, time **6.338797 → 6.399673**, playing, `readyState=4`, no error. This used the generated file with normal automatic startup. |
| YouTube, isolated-world execution on `L_LUpnjgPso` | Automatically selected ordinary **1920×1080**, `readyState=4`, playing, no media error. Independently reopened Quality: **1080p HD** checked; Premium entry was not selected. |
| Reddit, normal inline page-world script on `1xvewbj` | Started at **218×392**, time **1.163869**. Bundle automatically selected **714×1280**, time **1.954456**, playing, `readyState=4`, no error. No supplied/manual target ladder was passed to the script. |
| X, final API-only bundle on `2121434583178875245` | Automatically fixed **manual/current index 4**, **Auto off**, decoded **3840×2160**, `readyState=4`, time **3.904405**, audio bytes **68826**, playing. **Settings controls 0, pointer-over events 0**. Only normal native `video.play()` started playback; no quality was supplied by the test. |
| Pornhub, exact final four-platform bundle on an authorized desktop watch page | Offered **240/480/720/1080**. Selected **720 → 1080** automatically; decoded **1920×1080**, `readyState=4`, playing. Stored quality preference unchanged. All visuals hidden and audio muted; no content identifiers or media saved. |

The exact final four-platform file used for the Pornhub smoke has SHA-256
`23a14e4ea13b4d21eed99f303b3225d76a32447baa4ca3eb61ff9309e8e6bb47`.
It was injected before player initialization without modifying the script,
its default height cap (2160), or its debug setting (false).

YouTube's actual source/core was also independently verified automatically switching
**256×144 → 3840×2160**, with the real **2160p60 4K** option checked and decoded
audio continuing. See [YouTube validation](youtube-validation.md).
Reddit's source adapter additionally passed real feed/SPA/Back/Forward,
virtualization and lower-cap tests without writing a persistent quality
preference; see [Reddit validation](reddit-feasibility.md).

## X cold-load regression caught before completion

Initial whole-bundle tests exposed a dependency missed by the warm menu
experiments: Settings controls do not mount before hover. A targeted failing
test reproduced ready HLS + absent controls. The corrected production adapter
uses only the positively owned player API, with no menu/focus/hover dependency.
The final generated file was then loaded before a fresh X navigation, with a
read-only observer; the 4K/no-hover row above confirms the bundled correction.
X's local quality menu can remain cosmetically at Auto; this version verifies
the actual HLS fixed level, not that stale UI. See the current
[no-hover validation](x-feasibility.md#cold-loadno-hover-correction-2026-11-14-utc).

X's early page-world test used the browser tool's `addInitScript`, which
intercepts the document and is visible to the page. No production nonce
extraction, script injection, request rewriting or supplied ladder is used.
This proves bundled logic in that execution world, not a particular installed
userscript manager's CSP/injection behavior.

## Reproducible repository checks

```sh
npm run build
npm test
npm run check
node --check yt4k-1.2.0.user.js
git diff --check
```

The earlier three-platform run after the no-hover correction passed 66 tests.
After integrating Pornhub and adding actual-bundle host-dispatch/isolation tests,
**109 tests passed, 0 failed**; source/bundle consistency, generated JavaScript
syntax and diff checks passed. Twelve tests remain explicitly Pornhub
**source-consumer fixtures**, not live quality evidence. Additional adapter
policy tests and the separate real-site/wrapper experiments establish their
respective coverage.

Tests exercise actual adapter code with controlled player fixtures. Cases
cover unknown/above-cap/portrait dimensions, player ownership, late discovery,
source changes, bounded retries, verification and stale asynchronous work.
Pornhub's explicitly source-only fixture tests do **not** establish a quality
adapter by themselves. Its enabled path is backed separately by real desktop
HLS selection/decoded playback at observed site maxima of 720p and 1080p, plus
3840×2160 MP4/HLS playback with the actual unmodified wrapper in a local
solid-colour harness. See [the real-site report](pornhub-feasibility.md#real-public-watch-page-integration-and-decoded-playback--2026-11-14).

## What this does not prove

No universal browser/manager/CSP compatibility, every platform player mode,
Reddit 2160p/above-cap playback, X above-cap playback, Pornhub live-site 4K,
or no-above-cap startup download guarantee is claimed. A title advertising
8K is not evidence of an exposed
4320p rendition: the inspected LG Redwoods sample `EJr3uAQwGek` exposed a
maximum of 2160p in this browser. Fixture ceiling checks are distinguished
from live high-resolution availability. Full platform-specific boundaries
are recorded in the corresponding research reports.
