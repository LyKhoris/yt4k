// ==UserScript==
// @name         yt4k
// @namespace    https://localhost/yt-auto-max-quality
// @version      1.2.0
// @description  Automatically sets the YouTube player to the highest available resolution, capped at 4K.
// @author       you
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @exclude      https://www.youtube.com/embed/*
// @grant        none
// @run-at       document-idle
// @noframes     true
// ==/UserScript==

(function () {
  'use strict';

  const DEBUG = true; // set to false once everything works
  const MAX_HEIGHT = 2160; // 4K cap — never go above this (e.g. 8K)
  const log = (...a) => DEBUG && console.info('[YT-AUTO-MAX]', ...a);
  const warn = (...a) => DEBUG && console.warn('[YT-AUTO-MAX]', ...a);

  const QUALITY_HEIGHT = {
    highres: 4320,
    hd2160: 2160,
    hd1440: 1440,
    hd1080: 1080,
    hd720: 720,
    large: 480,
    medium: 360,
    small: 240,
    tiny: 144,
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function waitFor(fn, timeoutMs, intervalMs = 250) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const v = fn();
        if (v) return v;
      } catch (_) {}
      await sleep(intervalMs);
    }
    return null;
  }

  function getPlayer() {
    return document.querySelector('#movie_player');
  }

  /* ---------- Strategy 1: internal player API ---------- */

  function tryApi(player) {
    try {
      if (typeof player.getAvailableQualityLevels !== 'function') {
        warn('getAvailableQualityLevels missing from player');
        return false;
      }
      const levels = player.getAvailableQualityLevels();
      log('API: available levels:', levels);
      if (!levels || levels.length < 2) return false;

      const candidates = levels.filter(
        (q) =>
          q !== 'auto' &&
          q !== 'unknown' &&
          QUALITY_HEIGHT[q] &&
          QUALITY_HEIGHT[q] <= MAX_HEIGHT
      );
      if (!candidates.length) return false;

      const best = candidates.reduce((a, b) =>
        QUALITY_HEIGHT[b] > QUALITY_HEIGHT[a] ? b : a
      );
      const before =
        typeof player.getPlaybackQuality === 'function'
          ? player.getPlaybackQuality()
          : '?';

      player.setPlaybackQualityRange && player.setPlaybackQualityRange(best, best);
      player.setPlaybackQuality && player.setPlaybackQuality(best);
      log('API: requested', before, '->', best);
      return true;
    } catch (e) {
      warn('API error:', e);
      return false;
    }
  }

  /* ---------- Strategy 2: click the real settings menu ---------- */

  async function tryMenu(player) {
    try {
      const settingsBtn = document.querySelector('.ytp-settings-button');
      if (!settingsBtn) {
        warn('MENU: settings button not found');
        return false;
      }

      const popup = () => document.querySelector('.ytp-popup.ytp-settings-menu');
      const isOpen = () => {
        const p = popup();
        return !!p && p.style.display !== 'none';
      };

      if (!isOpen()) settingsBtn.click();

      const menu = await waitFor(isOpen, 3000);
      if (!menu) {
        warn('MENU: never opened');
        return false;
      }

      const items = Array.from(menu.querySelectorAll('.ytp-panel-menu .ytp-menuitem'));
      log(
        'MENU: items:',
        items.map((i) => i.textContent.trim().replace(/\s+/g, ' ').slice(0, 40))
      );

      const qualityItem = items.find((i) => /quality|auto\b/i.test(i.textContent));
      if (!qualityItem) {
        warn('MENU: no Quality entry found');
        settingsBtn.click();
        return false;
      }
      qualityItem.click();

      // Submenu with the quality list replaces the main panel
      await sleep(500);

      const entries = Array.from(menu.querySelectorAll('.ytp-panel-menu .ytp-menuitem'));
      log(
        'MENU: quality options:',
        entries.map((e) => e.textContent.trim().replace(/\s+/g, ' '))
      );
      if (!entries.length) {
        warn('MENU: quality list empty');
        settingsBtn.click();
        return false;
      }

      const parsed = entries
        .map((el) => {
          const m = el.textContent.match(/(\d{3,4})\s*p/);
          return { el, h: m ? parseInt(m[1], 10) : -1, isAuto: /auto/i.test(el.textContent) };
        })
        .filter((p) => !p.isAuto && p.h > 0 && p.h <= MAX_HEIGHT)
        .sort((a, b) => b.h - a.h);

      const target = parsed[0];
      if (!target || target.h <= 0) {
        warn('MENU: could not parse resolutions');
        settingsBtn.click();
        return false;
      }

      log('MENU: clicking', target.el.textContent.trim().replace(/\s+/g, ' '));
      target.el.click();

      await sleep(400);
      if (isOpen()) settingsBtn.click(); // close if still open
      return true;
    } catch (e) {
      warn('MENU error:', e);
      try {
        document.querySelector('.ytp-settings-button')?.click();
      } catch (_) {}
      return false;
    }
  }

  /* ---------- Orchestration ---------- */

  let lastVideoId = null;

  async function runForCurrentVideo() {
    const videoId = new URLSearchParams(location.search).get('v');
    if (!videoId || videoId === lastVideoId) return;
    lastVideoId = videoId;

    log('=== new video:', videoId);

    const player = await waitFor(getPlayer, 15000);
    if (!player) {
      warn('#movie_player never appeared');
      return;
    }
    log('player found');

    await waitFor(() => {
      const l = player.getAvailableQualityLevels && player.getAvailableQualityLevels();
      return l && l.length > 1 ? l : null;
    }, 10000);

    const applied = tryApi(player);

    // Verify the API actually took effect; YouTube often ignores it
    await sleep(1500);
    const effective =
      typeof player.getPlaybackQuality === 'function'
        ? player.getPlaybackQuality()
        : null;
    log('quality after API attempt:', effective);

    if (!applied || !effective || effective === 'auto') {
      log('API ignored -> falling back to settings menu');
      const menuOk = await tryMenu(player);
      log('menu fallback result:', menuOk);
    }

    log('=== done. final quality:',
      player.getPlaybackQuality && player.getPlaybackQuality());
  }

  window.addEventListener('yt-navigate-finish', runForCurrentVideo, true);
  window.addEventListener('yt-page-data-updated', runForCurrentVideo, true);

  if (document.readyState === 'complete') {
    runForCurrentVideo();
  } else {
    window.addEventListener('load', runForCurrentVideo);
  }

  log('script loaded (yt4k v1.2.0)');
})();
