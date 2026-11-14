# yt4k

A dependency-free userscript that automatically selects the **highest supported, exposed video resolution with a height of at most 2160 pixels**.

It selects a quality after the player is ready; it is **not a network filter** that prevents every above-cap startup request. Unknown or unsupported player paths are left unchanged, not treated as capped.

## Platform support

| Platform | Implemented path | Boundaries |
| --- | --- | --- |
| YouTube | Player API, then scoped Settings → Quality fallback | Landscape watch videos; English menu fallback; portrait/unknown dimensions and embeds skipped. |
| Reddit | Native packaged-MP4 players on `www.reddit.com`, using actual source dimensions and the player's own setter | Feed/post navigation and multiple players; HLS and inaccessible controllers skipped. No persistent Reddit quality preference is written. |
| X | Owned HLS player API, using actual variant dimensions; no hover/menu required | Recognized responsive-web players only. The local menu may still say Auto despite fixed engine selection. Other player shapes are skipped. |
| Pornhub | Desktop MGP 9.2.7's owned quality API on `www.pornhub.com/view_video.php` | Final bundle selected and decoded the live sample's 1080p maximum; real-wrapper MP4/HLS harness verified at 2160p. Unknown/remote ladders, other versions, native HLS, ads and embeds skipped. |

Reddit, X and Pornhub quality labels/IDs are not treated as actual heights. These adapters use verified rendition dimensions instead of trusting labels. The cap remains **literal height ≤2160**; a 2160×3840 portrait rendition is therefore excluded.

## Features

- Site-specific adapters with bounded retries and source-change handling.
- Verifies selection instead of treating a successful click as success.
- Leaves unknown, locked, above-cap and unsupported variants alone.
- Zero runtime dependencies or privileged GM APIs (`@grant none`).
- Reddit, X and Pornhub need page-world injection for their guarded player access. Metadata requests this explicitly; content-world fallback cannot provide that support.

## Install

1. Install a userscript manager such as [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Open the raw userscript file:
   `https://raw.githubusercontent.com/LyKhoris/yt4k/main/yt4k-1.2.0.user.js`
3. Your manager should prompt you to install it. Confirm.

Or manually: create a new script in your manager and paste the contents of `yt4k-1.2.0.user.js`.

## Configuration

Edit `config` near the beginning of the installed script:

| Constant     | Default | Description                                            |
| ------------ | ------- | ------------------------------------------------------ |
| `debug`      | `false` | Logs technical diagnostics to the console with `[yt4k]`. |
| `maxHeight`  | `2160`  | Highest selected rendition height. Set to `1080` for a lower ceiling. |

## Development

Requires Node.js 20+; no dependency installation is needed.

```sh
npm run build
npm test
npm run check
```

Edit `src/core.js` and `src/platforms/*.js`, then rebuild. The generated installable file retains the historical name `yt4k-1.2.0.user.js` so the existing installation URL stays valid; its metadata version is 1.3.0. Source configuration changes belong in `src/core.js`.

Live evidence and limitations: [bundled script](docs/research/bundle-validation.md), [YouTube](docs/research/youtube-validation.md), [Reddit](docs/research/reddit-feasibility.md), [X](docs/research/x-feasibility.md), [Pornhub](docs/research/pornhub-feasibility.md). Fixture tests are not evidence of live 4K playback on every platform.

Before a broad release, run the [installed-manager validation checklist](docs/research/manager-validation.md); browser-assisted page-world injection is not the same as an installed userscript test.

## Notes

- Site DOM and private APIs can change. Adapters intentionally stop selecting when ownership or dimensions cannot be verified.
- Forced maximum quality can increase bandwidth, battery usage and buffering.
- Browser tests do not establish all userscript-manager/browser combinations. Page-world injection must be allowed by the manager and site.
- Mobile, embeds, native HLS, error recovery and every fullscreen variant are not universally covered.

## License

MIT
