// Live-test shim for the actual src/platforms/x.js adapter, NOT an installable script.
// Concatenate this and the adapter inside one IIFE in the page's JS realm.
// No supplied variants, browser response observer, network interception, or source replacement.
// Exposes cleanup and writes only aggregate selection diagnostics, never media URLs.
window.__yt4kXAutomaticCleanup?.();
const YT4K = {
  register(adapter) {
    const record = (...args) => document.documentElement.setAttribute('data-yt4k-x-automatic', JSON.stringify(args));
    window.__yt4kXAutomaticCleanup = adapter.start({
      config: { maxHeight: 2160, debug: true },
      sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
      async waitFor(read, timeoutMs = 5000, intervalMs = 100) {
        const end = Date.now() + timeoutMs;
        do {
          const value = read();
          if (value) return value;
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        } while (Date.now() < end);
        return null;
      },
      selectBest(levels, maxHeight) {
        return levels.filter(level => Number.isFinite(level.width) && level.width > 0 &&
          Number.isFinite(level.height) && level.height > 0 && level.height <= maxHeight)
          .sort((a, b) => b.height - a.height || b.width - a.width ||
            (b.bitrate || 0) - (a.bitrate || 0))[0] || null;
      },
      log: record,
      warn: record,
    });
  },
};
