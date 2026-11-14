// Shared policy; site-specific discovery and switching live in platform adapters.
const YT4K = (() => {
  const config = { maxHeight: 2160, debug: false };
  const adapters = [];
  const started = new Set();
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const log = (...args) => config.debug && console.info('[yt4k]', ...args);
  const warn = (...args) => config.debug && console.warn('[yt4k]', ...args);

  function selectBest(levels, maxHeight = config.maxHeight) {
    if (!Array.isArray(levels) || !Number.isFinite(maxHeight) || maxHeight <= 0) return null;
    const bitrate = level => Number.isFinite(level.bitrate) ? level.bitrate : 0;
    return levels.filter(level => level && !level.disabled && !level.locked &&
      Number.isFinite(level.width) && level.width > 0 &&
      Number.isFinite(level.height) && level.height > 0 && level.height <= maxHeight)
      .reduce((best, level) => !best || level.height > best.height ||
        (level.height === best.height && (level.width > best.width ||
          (level.width === best.width && bitrate(level) > bitrate(best)))) ? level : best, null);
  }

  async function waitFor(read, timeoutMs = 5000, intervalMs = 100) {
    const deadline = Date.now() + timeoutMs;
    do {
      try {
        const value = read();
        if (value) return value;
      } catch (_) { /* Players may be disconnected during initialization. */ }
      if (Date.now() >= deadline) break;
      await sleep(Math.min(intervalMs, Math.max(0, deadline - Date.now())));
    } while (Date.now() <= deadline);
    return null;
  }

  const api = {
    config, sleep, log, warn, waitFor, selectBest,
    register(adapter) { adapters.push(adapter); },
    async start(hostname) {
      const adapter = adapters.find(candidate => candidate.hosts.includes(hostname));
      if (!adapter) return false;
      if (started.has(adapter.id)) return true;
      started.add(adapter.id);
      try {
        await adapter.start(api);
        return true;
      } catch (error) {
        started.delete(adapter.id);
        warn(adapter.id, 'initialization failed:', error.message);
        return false;
      }
    },
  };
  return api;
})();
