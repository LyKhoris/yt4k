// Reddit's packaged-MP4 controller only. HLS, embeds and inaccessible page
// objects intentionally have no menu/source-replacement fallback.
YT4K.register({
  id: 'reddit',
  hosts: ['www.reddit.com'],
  start(api) {
    const players = new Set();
    const roots = new Map();
    const states = new WeakMap();
    let stopped = false;
    let scheduled = null;

    function discover(node) {
      if (!node || stopped) return;
      if (node.matches?.('shreddit-player')) players.add(node);
      if (node.shadowRoot) observe(node.shadowRoot);
      for (const element of node.querySelectorAll?.('*') || []) {
        if (element.matches('shreddit-player')) players.add(element);
        if (element.shadowRoot) observe(element.shadowRoot);
      }
    }

    function observe(root) {
      if (roots.has(root)) return;
      const observer = new MutationObserver(records => {
        for (const record of records) {
          for (const node of record.addedNodes) discover(node);
        }
        schedule();
      });
      roots.set(root, observer);
      observer.observe(root, { childList: true, subtree: true });
      discover(root);
    }

    function schedule() {
      if (stopped || scheduled !== null) return;
      scheduled = setTimeout(() => {
        scheduled = null;
        tick();
      }, 100);
    }

    function inspect(player) {
      if (player.isMp4 !== true || player.isHls !== false) return null;
      const controller = player.packagedMediaController;
      const actions = player.mediaActionsController;
      const video = player.shadowRoot?.querySelector('video');
      if (!video || controller?.host !== player || controller.videoElement !== video ||
          actions?.host !== player || actions.videoElement !== video ||
          typeof actions.setQualityLevel !== 'function' ||
          typeof controller.getCurrentSource !== 'function' ||
          !Array.isArray(controller.playbackPermutations) ||
          !Array.isArray(player.qualityLevels)) return null;

      // qualityLevels carries source indices, NOT indices into the menu. Labels
      // describe bucketed short edges and must never be used as actual heights.
      const permutations = controller.playbackPermutations;
      if (!permutations.includes(controller.getCurrentSource())) return null;
      const levels = [];
      for (const level of player.qualityLevels) {
        const index = level.mp4SourceIndex;
        if (!Number.isInteger(index) || index < 0) continue;
        const permutation = permutations[index];
        const source = permutation?.source;
        if (!source || typeof source.url !== 'string' || !source.url ||
            !['H264', 'VP9'].includes(source.videoCodec)) continue;
        const { width, height } = source.dimensions || {};
        if (!Number.isFinite(width) || width <= 0 ||
            !Number.isFinite(height) || height <= 0) continue;
        // Only the active controller's already chosen codec ladder is used.
        if (source.videoCodec !== controller.getCurrentSource()?.source?.videoCodec) continue;
        levels.push({ width, height, bitrate: source.bitrateBps, index, permutation });
      }
      const best = api.selectBest(levels, api.config.maxHeight);
      if (!best) return null;
      const identity = JSON.stringify(levels.map(level => [level.index,
        level.width, level.height, level.bitrate, level.permutation.source.url]));
      return { controller, actions, video, best, identity };
    }

    async function apply(player) {
      let info;
      try { info = inspect(player); } catch { return; }
      if (!info) return;
      const { controller, actions, video, best, identity } = info;
      let state = states.get(player);
      if (!state || state.identity !== identity || state.controller !== controller || state.video !== video) {
        state = { identity, controller, video, attempts: 0, pending: false, done: false };
        states.set(player, state);
      }
      if (state.pending || state.done || state.attempts >= 3) return;
      // Do not force-load dozens of paused/offscreen comment/feed videos.
      const rect = player.getBoundingClientRect();
      if (video.paused && !(rect.width > 0 && rect.height > 0 &&
          rect.bottom > 0 && rect.top < window.innerHeight &&
          rect.right > 0 && rect.left < window.innerWidth)) return;
      state.pending = true;
      state.attempts++;
      const current = () => !stopped && player.isConnected && states.get(player) === state &&
        controller.playbackPermutations[best.index] === best.permutation &&
        controller.videoElement === video;
      try {
        if (!current()) return;
        if (player.currentQualityLevelIndex !== best.index || controller.getCurrentSource() !== best.permutation) {
          // Unlike the settings UI, this actual per-player setter does NOT write
          // @reddit/shreddit-player-media-quality or any account preference.
          actions.setQualityLevel(best.index);
        }
        if (!current() || player.currentQualityLevelIndex !== best.index ||
            controller.getCurrentSource() !== best.permutation) return;
        api.log('reddit requested', { width: best.width, height: best.height });
        const decoded = await api.waitFor(() => {
          if (!current()) return 'cancelled';
          return video.readyState >= 2 && video.videoWidth === best.width &&
            video.videoHeight === best.height;
        }, 5000, 100);
        if (!current()) return;
        if (decoded === true && player.currentQualityLevelIndex === best.index &&
            controller.getCurrentSource() === best.permutation) {
          state.done = true;
          api.log('reddit effective', { width: video.videoWidth, height: video.videoHeight });
        } else {
          api.warn('reddit: requested rendition not verified');
        }
      } catch (error) {
        api.warn('reddit: packaged-player selection failed', error);
      } finally {
        state.pending = false;
      }
    }

    function tick() {
      if (stopped) return;
      // Custom elements can attach a shadow root without a document mutation.
      for (const player of players) {
        if (!player.isConnected) {
          players.delete(player);
          states.delete(player);
          continue;
        }
        if (player.shadowRoot) observe(player.shadowRoot);
        void apply(player);
      }
      for (const [root, observer] of roots) {
        if (root !== document && !root.host?.isConnected) {
          observer.disconnect();
          roots.delete(root);
        }
      }
    }

    observe(document);
    tick();
    const timer = setInterval(tick, 1000);
    window.addEventListener('pageshow', schedule);
    window.addEventListener('popstate', schedule);
    return () => {
      stopped = true;
      clearInterval(timer);
      if (scheduled !== null) clearTimeout(scheduled);
      for (const observer of roots.values()) observer.disconnect();
      roots.clear();
      players.clear();
      window.removeEventListener('pageshow', schedule);
      window.removeEventListener('popstate', schedule);
    };
  }
});
