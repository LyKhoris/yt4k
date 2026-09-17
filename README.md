# yt4k

A userscript that automatically sets the YouTube player to the **highest available resolution, capped at 4K (2160p)**.

No more manually opening the settings gear and picking a quality on every video — `yt4k` detects the available levels and jumps to the best one that is 2160p or lower (it will not bump you to 8K).

## Features

- Automatically selects the best quality ≤ 2160p (4K cap).
- Two-tier strategy:
  1. Uses YouTube's internal player API (`getAvailableQualityLevels` / `setPlaybackQualityRange`).
  2. Falls back to driving the real settings menu when the API is ignored (which YouTube often does).
- Re-applies on every video change (`yt-navigate-finish`, `yt-page-data-updated`).
- Works on `www.youtube.com` and `m.youtube.com`; skipped on embeds.
- Zero dependencies, `@grant none`.

## Install

1. Install a userscript manager such as [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Open the raw userscript file:
   `https://raw.githubusercontent.com/LyKhoris/yt4k/main/yt4k-1.2.0.user.js`
3. Your manager should prompt you to install it. Confirm.

Or manually: create a new script in your manager and paste the contents of `yt4k-1.2.0.user.js`.

## Configuration

Edit the constants at the top of the script:

| Constant     | Default | Description                                            |
| ------------ | ------- | ------------------------------------------------------ |
| `DEBUG`      | `true`  | Logs diagnostics to the console with `[YT-AUTO-MAX]`.  |
| `MAX_HEIGHT` | `2160`  | Highest resolution allowed (4K cap). Lower it for 1080p.|

## How it works

1. Waits for `#movie_player` and for the quality levels to populate.
2. Tries the internal player API to set the best quality.
3. Verifies the change took effect; if it reports `auto`/unchanged, it opens the settings menu, chooses **Quality**, parses the listed resolutions, and clicks the highest one ≤ `MAX_HEIGHT`.

## Notes

- YouTube changes its DOM frequently. If the menu fallback breaks, the API path may still work, and vice versa.
- The script runs only once per video ID and re-runs on navigation.

## License

MIT
