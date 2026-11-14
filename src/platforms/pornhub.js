// Verified desktop MGP 9.2.7 wrapper only. Explicit, dimensioned renditions;
// no native HLS, master-only/remote ladders, embeds, or speculative menu fallback.
YT4K.register({
  id: 'pornhub',
  hosts: ['www.pornhub.com'],
  start(api) {
    const records = new Map();
    let stopped = false;

    function definitionsFor(mgp, root, settings) {
      const sources = settings.mainRoll?.mediaDefinition;
      // On production hosts MGP deliberately redacts this cached settings
      // clone. Its public keyed inspectOriginal() retains the configuration
      // supplied to createPlayer(root.id, config). Never enumerate other IDs.
      if (Array.isArray(sources) && sources.length === 0 &&
          typeof mgp.inspectOriginal === 'function') {
        return mgp.inspectOriginal(root.id)?.mainRoll?.mediaDefinition;
      }
      return sources;
    }

    function decodedMatches(video, best) {
      // Real site source metadata declares 426px while its 240p rendition
      // can decode at 427px. Height remains exact: never relax the
      // literal-height cap. Larger width mismatches still fail verification.
      return video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight === best.height &&
        Math.abs(video.videoWidth - best.width) <= 1;
    }

    function inspect(root) {
      const mgp = window.MGP;
      if (mgp?.buildInfo?.playerName !== 'desktop' ||
          mgp.buildInfo.playerVersion !== '9.2.7') return null;
      const player = mgp.players?.[root.id];
      if (!player || typeof player.settings !== 'function' ||
          typeof player.isSourceReady !== 'function' || !player.isSourceReady() ||
          typeof player.getCurrentState !== 'function' || player.getCurrentState().adRollReady !== false ||
          typeof player.quality?.get !== 'function' || typeof player.quality?.set !== 'function') return null;
      const videos = root.querySelectorAll('video.mgp_videoElement');
      if (videos.length !== 1) return null;
      const video = videos[0];
      if (video.readyState < 2) return null;
      const settings = player.settings();
      if (settings.playerId !== root.id) return null;
      const definitions = definitionsFor(mgp, root, settings);
      const offered = player.quality.get({ list: true });
      if (!Array.isArray(definitions) ||
          !Array.isArray(offered) || !offered.length) return null;

      // MGP's current HLS.js path uses a MediaSource blob. Reject other MSE
      // formats and native HLS rather than guessing the active source model.
      const format = video.currentSrc.startsWith('blob:') ? 'hls' : 'mp4';
      if (format === 'hls' && (mgp.buildInfo.libraryVersion !== '1.6.15' ||
          !['hlsjs', 'hlsjs.light'].includes(mgp.buildInfo.libraryName) ||
          definitions.some(source => !['hls', 'mp4'].includes(source.format)))) return null;
      const sources = definitions.filter(source => source.format === format);
      if (!sources.length || sources.some(source => source.remote || source.disabled || source.locked ||
          !Number.isFinite(source.width) || source.width <= 0 ||
          !Number.isFinite(source.height) || source.height <= 0 ||
          !/^[1-9]\d*$/.test(String(source.quality)) ||
          typeof source.videoUrl !== 'string' || !source.videoUrl)) return null;
      if (format === 'mp4' && !sources.some(source => source.videoUrl === video.currentSrc)) return null;

      const levels = [];
      for (const quality of offered) {
        // Auto is not a rendition. All numeric entries must map unambiguously
        // to real dimensions; a label is never treated as a pixel height.
        if (quality === 'auto') continue;
        if (!Number.isFinite(quality) || quality <= 0) return null;
        const matches = sources.filter(source => Number(source.quality) === quality);
        if (!matches.length || matches.some(source => source.width !== matches[0].width ||
            source.height !== matches[0].height)) return null;
        levels.push({ quality, width: matches[0].width, height: matches[0].height });
      }
      const best = api.selectBest(levels, api.config.maxHeight);
      if (!best) return null;
      return { player, video, best, definitions, format };
    }

    async function apply(root, info) {
      const { player, video, best, definitions, format } = info;
      const record = { player, video };
      records.set(root, record);
      const current = () => !stopped && root.isConnected && records.get(root) === record &&
        window.MGP?.players?.[root.id] === player && root.contains(video) &&
        definitionsFor(window.MGP, root, player.settings()) === definitions &&
        player.getCurrentState().adRollReady === false;
      try {
        if (!current()) return;
        // manual:false avoids MGP's persistent quality preference. The setter
        // returns undefined, NOT a success flag. Always verify the readback.
        player.quality.set({ quality: best.quality, auto: false, manual: false });
        api.log('pornhub requested', { width: best.width, height: best.height });
        const verified = await api.waitFor(() => !current() ||
          (player.quality.get() === best.quality && decodedMatches(video, best)), 5000, 100);
        if (!current()) return;
        if (verified && player.quality.get() === best.quality &&
            decodedMatches(video, best)) {
          api.log('pornhub effective', { width: video.videoWidth, height: video.videoHeight, format });
        } else api.warn('pornhub: selected rendition not verified; not retrying');
      } catch (_) {
        api.warn('pornhub: wrapper unavailable; skipped');
      }
      // One attempt per wrapper/video instance. Do not fight a subsequent user
      // override, or reuse cached configuration after a same-wrapper source change.
    }

    function scan() {
      if (stopped || window.location.pathname !== '/view_video.php' || window.top !== window.self) return;
      for (const [root] of records) if (!root.isConnected) records.delete(root);
      for (const root of document.querySelectorAll('.original.mainPlayerDiv .playerFlvContainer[id^="playerDiv_"]')) {
        try {
          const info = inspect(root);
          if (!info) continue;
          const record = records.get(root);
          if (record?.player === info.player && record.video === info.video) continue;
          void apply(root, info);
        } catch (_) { /* Private wrapper changes fail closed. */ }
      }
    }

    scan();
    const timer = setInterval(scan, 1000);
    window.addEventListener('pageshow', scan);
    return () => {
      stopped = true;
      clearInterval(timer);
      records.clear();
      window.removeEventListener('pageshow', scan);
    };
  },
});
