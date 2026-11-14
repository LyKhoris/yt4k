const youtubeAdapter = (() => {
  const heights = {
    hd2160: 2160, hd1440: 1440, hd1080: 1080, hd720: 720,
    large: 480, medium: 360, small: 240, tiny: 144,
  };

  function bestLevel(levels, cap) {
    return (Array.isArray(levels) ? levels : []).filter(id => heights[id] && heights[id] <= cap)
      .sort((a, b) => heights[b] - heights[a])[0] || null;
  }

  function openMenu(player) {
    const menu = player.querySelector('.ytp-popup.ytp-settings-menu');
    return menu && menu.style.display !== 'none' && menu.getClientRects().length ? menu : null;
  }

  async function applyMenu(player, api, current = () => true) {
    const button = player.querySelector('.ytp-settings-button');
    // Do not commandeer a menu the viewer is already using.
    if (!button || openMenu(player) || !current()) return false;
    button.click();
    try {
      const menu = await api.waitFor(() => openMenu(player), 2000);
      if (!menu || !current()) return false;
      const items = () => [...menu.querySelectorAll('.ytp-panel-menu .ytp-menuitem')];
      const options = () => items().filter(item => item.getAttribute('role') === 'menuitemradio');
      const quality = items().find(item => /quality/i.test(
        item.querySelector('.ytp-menuitem-label')?.textContent || item.textContent));
      if (!quality) return false;
      quality.click();
      let entries = await api.waitFor(() => {
        const choices = options();
        return choices.some(item => /\d{3,4}\s*p/.test(item.textContent)) && choices;
      }, 2000);
      if (!entries && current()) {
        const advanced = items().find(item => /advanced/i.test(item.textContent));
        if (advanced) {
          advanced.click();
          entries = await api.waitFor(() => {
            const choices = options();
            return choices.some(item => /\d{3,4}\s*p/.test(item.textContent)) && choices;
          }, 2000);
        }
      }
      if (!entries || !current()) return false;
      const target = entries.map(element => ({ element,
        height: Number(element.textContent.match(/(\d{3,4})\s*p/)?.[1]),
      })).filter(level => level.height > 0 && level.height <= api.config.maxHeight &&
        !/auto|premium/i.test(level.element.textContent) &&
        !level.element.querySelector?.('[class*="premium"]') &&
        level.element.getAttribute('aria-disabled') !== 'true')
        .sort((a, b) => b.height - a.height)[0];
      if (!target) return false;
      target.element.click();
      const verified = await api.waitFor(() => current() && (
        target.element.getAttribute('aria-checked') === 'true' ||
        heights[player.getPlaybackQuality?.()] === target.height), 4000);
      return !!verified;
    } finally {
      if (current() && openMenu(player)) button.click();
    }
  }

  function start(api) {
    let state = null;
    let timer;
    let stopped = false;
    const id = () => new URL(location.href).searchParams.get('v');
    const schedule = () => {
      clearTimeout(timer);
      if (!stopped) timer = setTimeout(run, 250);
    };
    async function run() {
      const videoId = id();
      if (!videoId || stopped) return;
      if (!state || state.id !== videoId) state = { id: videoId, busy: false, done: false, attempts: 0 };
      const own = state;
      if (own.busy || own.done || own.attempts >= 6) return;
      own.busy = true;
      const current = () => !stopped && state === own && id() === own.id;
      try {
        const player = await api.waitFor(() => document.querySelector('#movie_player'), 10000);
        if (!current()) return;
        if (!player) { own.attempts++; return; }
        // Waiting for an ad is not a failed content-quality attempt.
        if (player.classList.contains('ad-showing')) return;
        own.attempts++;
        const video = await api.waitFor(() => {
          const element = player.querySelector('video');
          return element?.videoWidth > 0 && element.videoHeight > 0 && element;
        }, 5000);
        // YouTube's named levels/menu labels alone cannot establish a portrait
        // rendition's vertical height. Leave that unverified path untouched.
        if (!video || !current() || video.videoWidth < video.videoHeight) return;
        const levels = typeof player.getAvailableQualityLevels === 'function' ? await api.waitFor(() => {
          const available = player.getAvailableQualityLevels?.();
          return available?.length && available;
        }, 8000) : null;
        if (!current()) return;
        const target = bestLevel(levels, api.config.maxHeight);
        if (target) {
          let requested = false;
          try {
            if (typeof player.setPlaybackQualityRange === 'function') {
              player.setPlaybackQualityRange(target, target);
              requested = true;
            }
            if (typeof player.setPlaybackQuality === 'function') {
              player.setPlaybackQuality(target);
              requested = true;
            }
          } catch (_) { /* Try the real menu below. */ }
          own.done = requested && !!await api.waitFor(() => current() && player.getPlaybackQuality?.() === target, 2000);
        }
        if (!own.done && current()) own.done = await applyMenu(player, api, current);
        if (own.done) api.log('youtube', 'quality selected', target || 'menu');
      } catch (error) {
        api.warn('youtube', error.message);
      } finally {
        own.busy = false;
        if (current() && !own.done && own.attempts < 6) timer = setTimeout(run, 2000);
      }
    }
    const events = ['yt-navigate-finish', 'yt-page-data-updated', 'pageshow'];
    events.forEach(event => window.addEventListener(event, schedule, true));
    document.addEventListener('loadedmetadata', schedule, true);
    schedule();
    return () => {
      stopped = true;
      clearTimeout(timer);
      events.forEach(event => window.removeEventListener(event, schedule, true));
      document.removeEventListener('loadedmetadata', schedule, true);
    };
  }
  return { id: 'youtube', hosts: ['www.youtube.com', 'm.youtube.com'], start, bestLevel, applyMenu };
})();
YT4K.register(youtubeAdapter);
