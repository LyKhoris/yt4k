// Read-only live-test observer. Run in the page realm before the actual core/adapter.
// Does not play, hover, focus, open menus, change quality, or intercept any request/API.
// Keeps only aggregate metadata/dimensions in memory and a DOM test attribute.
(() => {
  const history = [];
  let pointerEvents = 0;
  let last = '';
  function notePointer(event) {
    if (event.target.closest?.('[data-testid="videoPlayer"]')) pointerEvents++;
  }
  document.addEventListener('pointerover', notePointer, true);
  document.addEventListener('mouseover', notePointer, true);
  function sample() {
    const players = [...document.querySelectorAll('[data-testid="videoPlayer"]')].map(root => {
      const video = root.querySelector('video');
      const component = video?.closest('[data-testid="videoComponent"]');
      const key = component && Object.getOwnPropertyNames(component).find(name => name.startsWith('__reactFiber$'));
      let fiber = key && component[key];
      let player;
      for (let depth = 0; fiber && depth < 8; depth++, fiber = fiber.return) {
        if (fiber.stateNode?.videoPlayer) { player = fiber.stateNode.videoPlayer; break; }
      }
      const hls = player?.video?.hlsJs;
      return {
        settingsButtons: root.querySelectorAll('button[aria-label="Video Settings"]').length,
        buttons: [...root.querySelectorAll('button')].map(button => button.getAttribute('aria-label')),
        owned: !!hls && hls.media === video && player.video.videoTag === video && player.domElement.contains(video),
        manual: hls?.manualLevel, current: hls?.currentLevel, auto: hls?.autoLevelEnabled,
        levels: hls?.levels.map(level => ({ width: level.width, height: level.height, bitrate: level.bitrate })),
        width: video?.videoWidth, height: video?.videoHeight, ready: video?.readyState,
        time: video?.currentTime, paused: video?.paused, audioBytes: video?.webkitAudioDecodedByteCount,
      };
    });
    const result = { pointerEvents, players };
    // Do not fill history with every time/audio-byte tick.
    const signature = JSON.stringify(result, (key, value) => ['time', 'audioBytes'].includes(key) ? undefined : value);
    if (signature !== last && history.length < 40) { history.push(result); last = signature; }
    document.documentElement?.setAttribute('data-yt4k-x-no-hover', JSON.stringify({ ...result, history }));
    return { ...result, history };
  }
  const interval = setInterval(sample, 200);
  window.__yt4kXNoHoverObserver = {
    sample,
    stop() {
      clearInterval(interval);
      document.removeEventListener('pointerover', notePointer, true);
      document.removeEventListener('mouseover', notePointer, true);
    },
  };
})();
