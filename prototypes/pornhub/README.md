# Pornhub technical evidence and non-explicit wrapper harness

`src/platforms/pornhub.js` now targets the actually discovered **desktop MGP
9.2.7** wrapper, using its real `player.quality.get({list:true})`,
`player.quality.set({quality,auto:false,manual:false})`, and getter readback.
The real, unmodified wrapper successfully selected and decoded **3840×2160**
generated solid-colour media in both progressive MP4 and HLS.js harness runs.
Separately, the real public watch-page HLS path is now verified: the actual
production adapter selected the highest offered 720 quality and independently
decoded **1280×720**, including a switch from an initially decoded 240 quality
and a document-start initialization run. This is live **720**, not live 4K.
All page/video visuals were hidden before media loading, with audio muted.

A later exact-generated-bundle smoke independently selected the real site's
maximum **1920×1080** from a 240/480/720/1080 ladder. These site results remain
distinct from the 2160p local harness; see `docs/research/pornhub-feasibility.md`.

`site-consumers.fixture.js` preserves the earlier time-reading consumer bodies.
`site-ladder.fixture.json` preserves only numeric source/manifest evidence from
an authorized public watch HTML inspection: no URL, identifier, title or token.
`real-site-observation.json` separately records sanitized real runtime results.

Run the Node checks (source consumers and adapter policy with explicit stubs):

```sh
node --test tests/pornhub.test.cjs
```

The fake registry, DOM lookup, and player methods in the Node tests are
**sanitized stubs**, not an observed live session. These checks confirm the
meaning and limitations of the retrieved consumer code:

- The footer looks up `MGP.players[firstRegistryKey]`, not the registry value.
- Its first-entry choice does not establish which player is main content;
  a stale first entry can hide a usable later entry.
- The flag-modal consumer instead uses `VIDEO_SHOW.videoId` on `pc`, and
  `VIDEO_SHOW.playerId` otherwise.
- Both consumers assume the MGP global exists; neither controls quality or
  establishes rendition dimensions, readiness, authorization, or engine type.

The original support-page consumer bundles were not executed. The full
**actual player wrapper** was subsequently executed in the safe local harness
below and then on the actual site with all visuals hidden. Do not confuse
source-only, harness and real-site evidence levels.

## Reproduce the real-wrapper harness

Requires existing Node, curl, sha256sum and ffmpeg; installs nothing:

```sh
bash prototypes/pornhub/prepare-harness.sh
node prototypes/pornhub/serve-harness.cjs
```

Open either local harness URL in an agent-owned browser session:

- `http://127.0.0.1:9034/view_video.php?format=mp4&auto=1`
- `http://127.0.0.1:9034/view_video.php?format=hls&auto=1`

**Before navigation**, allow only requests to `127.0.0.1`; abort everything
else, and block images. The unmodified wrapper includes telemetry; do not let
the harness send it. All media are locally generated solid colour, not site
media. No screenshots are needed. Read `harnessRead()` in the **page world**
(`page.evaluate(fn, null, undefined, false)` in browse). It reports numeric
qualities, requested/effective adapter events, decoded dimensions and time.
Wait for `pornhub effective`, then require height 2160 and width 3840. Do not
treat `quality.set()` returning (it returns undefined) as success.

The setup script downloads hash-pinned public JS/CSS/library assets only into
`/tmp/opencode`, not the repository. Changed hashes require fresh inspection,
not relaxing the check. The local server does not modify the wrapper or core.
Only the harness explicitly calls `YT4K.start('www.pornhub.com')` on loopback;
this is test registration, not evidence of a live site origin.

Boundaries: explicit dimensioned ladders only; desktop 9.2.7; HLS.js 1.6.15 or
positively matched progressive sources. Unknown/remote active ladders, native
HLS, other MSE formats, embeds and ads are skipped. It makes one attempt per
wrapper/video instance, respects later quality changes, and does not claim
same-wrapper source-generation recovery or a first-byte bandwidth cap.
The generated installable bundle is the parent session's responsibility.
See [the feasibility report](../../docs/research/pornhub-feasibility.md) for
exact source provenance, browser outcomes, and limitations.

## Real-site probe

`live-proof-tail.js` is appended to the **unchanged** current `src/core.js`
and `src/platforms/pornhub.js` inside a single page-world IIFE. It starts the
actual adapter on `location.hostname`, captures technical requested/effective
events, and exposes `__yt4kLiveRead()`. It does not provide an alternate setter
or media source. Its storage comparison exports only whether the existing
`mgp_player.quality` preference remained unchanged, never its value.

Before navigating an ordinary support-discovered watch link, install an early
document init script that keeps the root opacity at zero and video elements
hidden/transparent/muted (including later DOM insertions and style changes).
Start with non-document/script/style/font requests blocked. Inspect only keyed
MGP/root associations and numeric state; do not take a whole-page snapshot or
screenshot containing content. For authorized numeric playback testing, keep
the early visual protection in place and reload with images still blocked,
allowing normal player/ads/media requests. Do not skip ads or gates.

The live site redacts `settings().mainRoll.mediaDefinition` to an empty array.
The adapter now uses its public **keyed** `MGP.inspectOriginal(root.id)` only
for that specific empty-array case; missing/unknown original data fails closed.
Real 240 playback also exposed a one-pixel width discrepancy (426 declared,
427 observed), so verification permits at most one pixel in width while
requiring **exact height** and the selected quality getter. Effective logs
always record actual decoded width/height, not relabeled source metadata.
