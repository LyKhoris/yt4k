# yt4k

A dependency-free userscript that automatically selects the **highest supported, exposed video resolution with a height of at most 2160 pixels**.

It selects a quality after the player is ready; it is **not a network filter** that prevents every above-cap startup request. Unknown or unsupported player paths are left unchanged, not treated as capped.

**[Install yt4k in Tampermonkey](https://raw.githubusercontent.com/LyKhoris/yt4k/main/yt4k-1.2.0.user.js)** · [Installation and updates](#install)

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

### 1. Remove an old local copy, if present

If you previously pasted/imported yt4k manually, start clean for this installation test:

1. Back up any custom code/configuration you want to keep (Tampermonkey Dashboard → Utilities → Export).
2. Open Tampermonkey → **Dashboard → Installed userscripts**.
3. Find **yt4k**, choose its trash/delete action, and confirm. Delete **only yt4k**, not Tampermonkey or unrelated scripts. This removes the browser-installed copy, not this GitHub repository.

### 2. Install from the hosted URL

1. Install/enable [Tampermonkey](https://www.tampermonkey.net/) if necessary. Follow its normal browser permission prompts; Chromium may require **Allow User Scripts** or Developer Mode ([official instructions](https://www.tampermonkey.net/faq.php?locale=en&q=Q209)).
2. Click **[Install yt4k](https://raw.githubusercontent.com/LyKhoris/yt4k/main/yt4k-1.2.0.user.js)**. Use this hosted link rather than creating another manually pasted script.
3. Review the version and supported-site permissions in Tampermonkey's installer, then choose **Install**. The current version is in [`package.json`](package.json); the filename's historical `1.2.0` does not determine the installed version.
4. Confirm there is **exactly one enabled yt4k** entry in the dashboard. Reload any already-open supported video pages.

If the link shows JavaScript instead of the installer, first check that Tampermonkey is enabled and has the necessary browser/site permissions. GitHub's raw cache can take a few minutes to reflect a new push; compare the header's `@version` with `package.json` before installing.

### 3. Enable update detection and choose approval behavior

The generated script contains both `@updateURL` and `@downloadURL`, pointing to the same stable hosted URL above. Tampermonkey checks its `@version` periodically and can retrieve a newer script automatically. No extra hosting, GitHub Release, or custom updater is required.

In Tampermonkey's script/global settings:

- Keep **update checking enabled** and choose a non-disabled check interval.
- If you want to approve updates, disable **Automatic installation** while leaving checks enabled. Exact labels/settings vary by version; additional settings may require a different Config mode.
- A popup/desktop notification for every update is **not guaranteed**. Use Tampermonkey's **Check for updates** action to check immediately, then review/install an available update.

Do not edit the installed source during the installation/update test: local edits can disable automatic updates and can be overwritten when an update is accepted. See [Tampermonkey's update documentation](https://www.tampermonkey.net/documentation.php?locale=en&q=update_url).

### Test an actual update

First install the current hosted version and verify playback. An update-detection test then needs a **later, higher `@version`** published at the same URL. After that release, choose **Check for updates** (or wait for the configured interval) and verify the newer version is offered/installed according to your settings. Checking against the same installed version should correctly report no update; do not lower/edit the local version to simulate an update.

## Configuration

Edit `config` near the beginning of the installed script if you need customization. Source edits can interfere with automatic updates or be overwritten; leave defaults unchanged for the initial update test.

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

Edit `src/core.js` and `src/platforms/*.js`, then rebuild. The generated installable file retains the historical name `yt4k-1.2.0.user.js` so the existing installation/update URL stays valid; its metadata version comes from `package.json`. Source configuration changes belong in `src/core.js`.

To publish an update: increase `package.json`'s version, rebuild, run the checks above, then commit and push the source and generated script to `main`. Keep the download URL, `@name`, and `@namespace` stable. Tampermonkey follows version bumps on `main`, not GitHub Release notifications.

Live evidence and limitations: [bundled script](docs/research/bundle-validation.md), [YouTube](docs/research/youtube-validation.md), [Reddit](docs/research/reddit-feasibility.md), [X](docs/research/x-feasibility.md), [Pornhub](docs/research/pornhub-feasibility.md). Fixture tests are not evidence of live 4K playback on every platform.

Before a broad release, run the [installed-manager validation checklist](docs/research/manager-validation.md); browser-assisted page-world injection is not the same as an installed userscript test.

## Notes

- Site DOM and private APIs can change. Adapters intentionally stop selecting when ownership or dimensions cannot be verified.
- Forced maximum quality can increase bandwidth, battery usage and buffering.
- Browser tests do not establish all userscript-manager/browser combinations. Page-world injection must be allowed by the manager and site.
- Mobile, embeds, native HLS, error recovery and every fullscreen variant are not universally covered.

## License

MIT
