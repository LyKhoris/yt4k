// X's responsive-web player is private. Fail closed when its shape or ownership changes.
YT4K.register({
  id: 'x',
  hosts: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
  start(api) {
    const records = new Map();
    let stopped = false;
    let timer;

    function fiberOf(element) {
      const key = Object.getOwnPropertyNames(element).find(name => name.startsWith('__reactFiber$'));
      return key && element[key];
    }

    function discover(video) {
      const root = video.closest('[data-testid="videoPlayer"]');
      const component = video.closest('[data-testid="videoComponent"]');
      if (!root || !component || root.querySelectorAll('video').length !== 1) return null;
      let fiber = fiberOf(component);
      // Inspect only the immediate component ancestry, not the application/store tree.
      for (let depth = 0; fiber && depth < 8; depth++, fiber = fiber.return) {
        const player = fiber.stateNode && fiber.stateNode.videoPlayer;
        const engine = player && player.video;
        const hls = engine && engine.hlsJs;
        if (hls && hls.media === video && engine.videoTag === video &&
            player.domElement && player.domElement.contains(video) &&
            typeof player.setQualityLevel === 'function' && Array.isArray(hls.levels)) {
          return { player, hls };
        }
      }
      return null;
    }

    function signature(video, hls) {
      return JSON.stringify([video.getAttribute('src'), hls.url,
        // Some engines update measured bitrate during playback; that is not a new source.
        hls.levels.map(level => [level.width, level.height])]);
    }

    function current(video, record) {
      if (stopped || !video.isConnected || records.get(video) !== record) return false;
      const found = discover(video);
      return found && found.player === record.player && found.hls === record.hls &&
        signature(video, found.hls) === record.signature;
    }

    async function apply(video, record) {
      record.busy = true;
      record.attempts++;
      try {
        // Preserve the original HLS index; never infer resolution from UI labels or URLs.
        const levels = record.hls.levels.map((level, index) => ({
          index, width: level.width, height: level.height, bitrate: level.bitrate,
        }));
        const target = api.selectBest(levels, api.config.maxHeight);
        if (!target) {
          record.done = true;
          api.log('X: no known eligible HLS level; skipped');
          return;
        }
        if (levels.some(level => !Number.isFinite(level.width) || level.width <= 0 ||
            !Number.isFinite(level.height) || level.height <= 0)) {
          record.done = true;
          api.log('X: unknown variant dimensions; skipped');
          return;
        }
        if (!current(video, record)) return;
        // Controls are hover-mounted. Use the owned player API without opening/faking UI.
        // This client's local menu may still display Auto; engine state is authoritative.
        record.player.setQualityLevel(target.index);
        const verified = await api.waitFor(() => !current(video, record) ||
          (!record.hls.autoLevelEnabled && record.hls.manualLevel === target.index), 2500, 100);
        if (!current(video, record)) return;
        if (verified) {
          // One preference per source generation. Do not fight subsequent user changes.
          record.done = true;
          api.log('X: fixed selection verified (player API; menu state not verified)',
            { width: target.width, height: target.height });
        } else {
          // A setter may have been ignored or a user may have overridden it: don't retry/fight.
          record.done = true;
          api.warn('X: fixed selection was not verified; not retrying');
        }
      } catch (error) {
        record.done = true;
        api.warn('X: private player API unavailable; skipped');
      } finally {
        record.busy = false;
      }
    }

    function scan() {
      if (stopped) return;
      for (const [video] of records) if (!video.isConnected) records.delete(video);
      for (const video of document.querySelectorAll('[data-testid="videoPlayer"] video')) {
        try {
          const found = discover(video);
          if (!found || !found.hls.levels.length || video.readyState === 0) {
            records.delete(video);
            continue;
          }
          const sourceSignature = signature(video, found.hls);
          let record = records.get(video);
          if (!record || record.hls !== found.hls || record.player !== found.player ||
              record.signature !== sourceSignature) {
            record = { ...found, signature: sourceSignature, busy: false, done: false, attempts: 0 };
            records.set(video, record);
          }
          if (!record.done && !record.busy && record.attempts < 1) void apply(video, record);
        } catch (error) {
          // Missing/inaccessible page-realm internals are an unsupported path, not a UI fallback.
        }
      }
    }

    function schedule() {
      if (stopped || timer) return;
      timer = setTimeout(() => { timer = null; scan(); }, 100);
    }
    const observer = new MutationObserver(schedule);
    observer.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    const events = ['loadedmetadata', 'emptied', 'play'];
    function mediaEvent(event) {
      if (event.type === 'emptied') records.delete(event.target);
      schedule();
    }
    for (const event of events) document.addEventListener(event, mediaEvent, true);
    // HLS initialization need not mutate DOM; polling discovers it without patching requests.
    const interval = setInterval(scan, 1000);
    scan();
    return () => {
      stopped = true;
      observer.disconnect();
      clearTimeout(timer);
      clearInterval(interval);
      for (const event of events) document.removeEventListener(event, mediaEvent, true);
      records.clear();
    };
  },
});
