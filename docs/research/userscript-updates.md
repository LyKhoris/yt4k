# Tampermonkey updates for yt4k

Researched 2026-11-14. Recommendation only: no build, script, README,
installation, or browser settings were changed.

## Answer and current state

**GitHub is sufficient; Greasy Fork or another registry is not required.**
Tampermonkey explicitly supports installing GitHub scripts through their raw
view [1]. This repository's stable raw URL returned HTTP 200 during research:

`https://raw.githubusercontent.com/LyKhoris/yt4k/main/yt4k-1.2.0.user.js`

Local `README.md`, `scripts/build.mjs`, and the generated bundle currently use
that historical filename, metadata version `1.3.0`, name `yt4k`, and namespace
`https://localhost/yt-auto-max-quality`. Neither update URL tag is generated.
The local bundle already includes YouTube, Reddit, X/Twitter, and Pornhub
matches; publishing updates does not itself implement platform support.
Publication check: commit `1d8bb72c5877e885134df4c279751b80fddb03a6`
serves version `1.3.0` (29,208 characters) at its public commit-pinned raw URL
[14]. Immediately after publication, the canonical `main` raw URL still served
`1.2.0` (6,635 characters); both responses advertised `Cache-Control:
max-age=300`. This is observed raw cache/propagation lag, not proof the push
failed or a guaranteed five-minute convergence time. Verify the moving URL
before migration. **Do not use the commit-pinned verification URL as the update
channel:** it cannot advance to later commits.

A pasted/imported copy cannot be assumed to know its GitHub source. Publishing
new metadata alone cannot teach an offline installed copy where to check;
bootstrap its existing installation once.

## Verified update behavior

- `@updateURL` specifies the check URL; a `@version` is required.
  `@downloadURL` supplies the full script after an update is detected;
  `@downloadURL none` disables checking [2]. Increase `@version` for each
  update [3]; the filename's `1.2.0` does not control version comparison.
- Checks are periodic and their frequency is configurable; manual checks are
  also available [4]. A GitHub Release is not an update notification sent to
  Tampermonkey: the manager checks the configured URL and metadata version.
- **Detection does not guarantee a confirmation prompt.** Tampermonkey can
  automatically install updates [4]. Its 5.5.0 changelog explicitly says:
  “Decoupled update checks from the actual update process; set ‘Automatic
  installation’ as needed” [5]. For approval-before-installation, keep checking
  enabled but disable automatic installation in the installed version's UI;
  this supports user-controlled installation, not a guaranteed per-release
  modal prompt.
  Older versions may expose “Don't ask me for simple script updates” instead;
  these labels appear in first-party translations [6]. Do not promise a popup
  or desktop notification on every update; behavior depends on version/settings.
- Local source edits matter: the 5.0.0 changelog says locally modified scripts
  are not automatically updated, but can be reverted by manual update and
  confirmation [5]. Current translations also warn that updating overwrites
  local changes [6]. Editing metadata in the manager can therefore require a
  subsequent explicit manual update; merely adding URLs is not a complete test.
- Keep `@name` and `@namespace` unchanged during migration. Official metadata
  docs define both [7], and the 3.7.13 changelog confirms that different
  namespaces allow identical names and mentions UUID-based distinction [5].
  This supports preserving identity, not a universal guarantee that importing
  the same name/namespace always merges entries or preserves every setting.

## Recommended publication workflow — not implemented

Add these lines to the generated metadata **in `scripts/build.mjs`**, not just
to the generated artifact, in a separately authorized change:

```js
// @updateURL    https://raw.githubusercontent.com/LyKhoris/yt4k/main/yt4k-1.2.0.user.js
// @downloadURL  https://raw.githubusercontent.com/LyKhoris/yt4k/main/yt4k-1.2.0.user.js
```

Using the same complete `.user.js` for both is the simple recommendation for
this small bundle. Optionally generate a matching metadata-only `.meta.js`
and use that for `@updateURL` to reduce check traffic; it must stay in sync
with the downloadable script. It is an optimization, not a prerequisite [2].

For each published update: increase `package.json`'s version above the installed
version, rebuild, run the repository checks, and publish the generated file at
the stable URL. Verify the raw response contains the intended version/URLs.
No GitHub Release is necessary for this **main-branch channel**: a newer
version pushed to `main` becomes eligible, even without a release or tag.

If only deliberate releases should ship, use a separately maintained stable
branch, or attach the same-named asset to each GitHub Release and use a moving
`releases/latest/download/yt4k-1.2.0.user.js` URL [8]. A URL pinned to a specific
tag/commit stays on that version and cannot discover later tags by itself.

## One-time migration of the existing local installation

1. **Back up first:** export through Dashboard → Utilities [9], including
   script storage/settings where offered [10]. Separately save the current
   source and record custom matches, exclusions, enabled state, and inline
   `config` edits. yt4k currently stores `maxHeight`/`debug` in its source, not
   GM preference storage; replacing the source does not preserve those edits.
2. After the update-aware bundle is published, work on the **existing yt4k
   entry**, not “Add a new script.” Set its update/source URL to the stable raw
   URL where the installed manager permits, then explicitly run its manual
   update and review any local-change warning. Alternatively, open the raw URL
   and proceed only if the install screen identifies the existing copy as the
   update/replacement target; cancel if it would create a second entry.
3. Keep the name/namespace above. Do not uninstall first. If URL controls or
   matching are unclear, stop and inspect the installed version rather than
   deleting the old entry. In-place editor replacement is a fallback, but may
   leave the script locally modified and need explicit manual reconciliation.
   If the hosted version is equal to or below a local development version,
   ordinary newer-version detection is not a useful migration test.
4. Verify there is exactly one enabled yt4k entry, the intended version, saved
   update URL(s), and retained manager overrides. Enable per-script checking
   and a non-disabled periodic interval; choose automatic installation versus
   manual approval separately. “Config mode” can reveal additional settings
   [11]. Exact tabs, labels, defaults, and notification delivery were not tested
   in an installed manager. Verify again with a later higher-version release.
5. Do not blindly reapply inline customizations while expecting unattended
   updates: source edits can disable them [5]. Keep a backup and update manually
   if such edits are essential; moving preferences outside source is a separate
   possible feature, not part of this recommendation.

Browser access is separate from script metadata. Restricted extension host
permissions can block updates to the GitHub raw host or execution on newly
matched sites [12]. Older YouTube-only installs should review the expanded
matches before replacement. Supported Chromium configurations also require
“Allow User Scripts” or Developer Mode [13]. These are user-controlled checks,
not permission changes performed by this research.

## Primary sources

1. Tampermonkey installation FAQ: https://www.tampermonkey.net/faq.php?locale=en&q=Q102
2. Update/download metadata: https://www.tampermonkey.net/documentation.php?locale=en&q=update_url
3. Version comparison: https://www.tampermonkey.net/documentation.php?locale=en&q=version
4. Features, “Easy Script Access” / “Automatic Script Update”: https://www.tampermonkey.net/index.php?locale=en
5. Official changelog (5.5.0 automatic installation; 5.0.0 local changes; 3.7.13 identity): https://www.tampermonkey.net/changelog.php?locale=en&more=true&show=dhdg
6. First-party English UI strings, linked translation repository from changelog: https://raw.githubusercontent.com/derjanb/tampermonkey-i18n/master/en/messages.json
7. Name/namespace metadata: https://www.tampermonkey.net/documentation.php?locale=en&q=name
8. GitHub moving release-asset URLs: https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases
9. Tampermonkey export/import: https://www.tampermonkey.net/faq.php?locale=en&q=Q106
10. Export options including storage/settings: https://www.tampermonkey.net/documentation.php?locale=en&q=deploying#deployment:json
11. Dashboard/configuration modes: https://www.tampermonkey.net/faq.php?locale=en&q=Q101
12. Host-permission limitations: https://www.tampermonkey.net/faq.php?locale=en&q=Q306
13. Chromium userscript permission: https://www.tampermonkey.net/faq.php?locale=en&q=Q209
14. Published bundle, immutable verification snapshot only: https://raw.githubusercontent.com/LyKhoris/yt4k/1d8bb72c5877e885134df4c279751b80fddb03a6/yt4k-1.2.0.user.js
