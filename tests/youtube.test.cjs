const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function adapter(globals = {}) {
  let result;
  vm.runInNewContext(fs.readFileSync('src/platforms/youtube.js', 'utf8'), {
    YT4K: { register(value) { result = value; } },
    ...globals,
  });
  return result;
}

test('YouTube handles a lone level and ignores auto/8K/unknown', () => {
  const youtube = adapter();
  assert.equal(youtube.bestLevel(['hd720'], 2160), 'hd720');
  assert.equal(youtube.bestLevel(['auto', 'highres', 'hd2160', 'hd1080'], 2160), 'hd2160');
  assert.equal(youtube.bestLevel(['auto', 'highres', 'new-level'], 2160), null);
  assert.equal(youtube.bestLevel(['hd2160', 'hd1080'], 1080), 'hd1080');
});

test('menu fallback waits for a real menu node and verifies target quality', async () => {
  const youtube = adapter();
  let open = false;
  let submenu = false;
  let effective = 'medium';
  const entry = (height, quality) => ({
    textContent: `${height}p${height >= 720 ? '60' : ''}`,
    getAttribute(name) {
      if (name === 'role') return 'menuitemradio';
      return name === 'aria-checked' && effective === quality ? 'true' : null;
    },
    click() { effective = quality; open = false; },
  });
  const choices = [entry(4320, 'highres'), {
    ...entry(2160, 'premium'), textContent: '2160p Premium Enhanced bitrate',
    click() { assert.fail('must not open an upgrade prompt'); },
  }, entry(2160, 'hd2160'), entry(1080, 'hd1080')];
  const menu = {
    style: { get display() { return open ? '' : 'none'; } },
    getClientRects: () => open ? [{}] : [],
    querySelectorAll: () => submenu ? choices : [{
      textContent: 'Quality Auto', querySelector: () => ({ textContent: 'Quality' }),
      getAttribute: () => 'menuitem',
      click() { submenu = true; },
    }],
  };
  const player = {
    querySelector(selector) {
      return selector === '.ytp-settings-button' ? { click() { open = !open; } } : menu;
    },
    getPlaybackQuality: () => effective,
  };
  const api = { config: { maxHeight: 2160 }, waitFor: async read => read() || null };
  assert.equal(await youtube.applyMenu(player, api), true);
  assert.equal(effective, 'hd2160');
  assert.equal(open, false);
});

test('does not hijack an already open settings menu', async () => {
  const youtube = adapter();
  const player = { querySelector(selector) {
    return selector === '.ytp-settings-button' ? { click() { assert.fail('viewer menu clicked'); } } :
      { style: {}, getClientRects: () => [{}] };
  } };
  assert.equal(await youtube.applyMenu(player, {}), false);
});

test('automatic API path applies once per video and re-runs on navigation', async () => {
  const timers = [];
  const listeners = new Map();
  const location = { href: 'https://www.youtube.com/watch?v=first' };
  let quality = 'medium';
  let requested = 0;
  let ads = true;
  let dimensions = { videoWidth: 1920, videoHeight: 1080 };
  const player = {
    classList: { contains: () => ads },
    querySelector: () => dimensions,
    getAvailableQualityLevels: () => ['hd720', 'hd2160', 'highres'],
    getPlaybackQuality: () => quality,
    setPlaybackQualityRange(target) { quality = target; requested++; },
  };
  const document = {
    querySelector: () => player,
    addEventListener: () => {}, removeEventListener: () => {},
  };
  const window = {
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name) { listeners.delete(name); },
  };
  const youtube = adapter({
    document, window, location, URL,
    setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {},
  });
  const cleanup = youtube.start({
    config: { maxHeight: 2160 }, waitFor: async read => read() || null, log() {}, warn() {},
  });
  for (let adPoll = 0; adPoll < 8; adPoll++) await timers.shift()();
  assert.equal(requested, 0);
  ads = false;
  await timers.shift()();
  assert.equal(quality, 'hd2160');
  assert.equal(requested, 1);
  listeners.get('yt-page-data-updated')();
  await timers.shift()();
  assert.equal(requested, 1);
  location.href = 'https://www.youtube.com/watch?v=second';
  quality = 'medium';
  listeners.get('yt-navigate-finish')();
  await timers.shift()();
  assert.equal(requested, 2);
  assert.equal(quality, 'hd2160');
  location.href = 'https://www.youtube.com/watch?v=portrait';
  dimensions = { videoWidth: 720, videoHeight: 1280 };
  listeners.get('yt-navigate-finish')();
  await timers.shift()();
  assert.equal(requested, 2, 'portrait labels do not prove literal vertical height');
  cleanup();
  assert.equal(listeners.size, 0);
});

test('a stale asynchronous YouTube run cannot change the next video', async () => {
  const timers = [];
  const events = new Map();
  const location = { href: 'https://www.youtube.com/watch?v=old' };
  const requests = [];
  let effective = 'medium';
  let release;
  let deferFirstLadder = true;
  const player = {
    classList: { contains: () => false },
    querySelector: () => ({ videoWidth: 1920, videoHeight: 1080 }),
    getAvailableQualityLevels: () => ['hd720', 'hd2160'],
    getPlaybackQuality: () => effective,
    setPlaybackQualityRange(target) { requests.push(location.href); effective = target; },
  };
  const youtube = adapter({
    URL, location,
    setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {},
    document: { querySelector: () => player, addEventListener() {}, removeEventListener() {} },
    window: { addEventListener: (name, fn) => events.set(name, fn), removeEventListener() {} },
  });
  const cleanup = youtube.start({
    config: { maxHeight: 2160 }, log() {}, warn() {},
    async waitFor(read) {
      const value = read();
      if (Array.isArray(value) && deferFirstLadder) {
        deferFirstLadder = false;
        return new Promise(resolve => { release = () => resolve(value); });
      }
      return value || null;
    },
  });
  const oldRun = timers.shift()();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(typeof release, 'function');
  location.href = 'https://www.youtube.com/watch?v=new';
  events.get('yt-navigate-finish')();
  await timers.shift()();
  release();
  await oldRun;
  assert.deepEqual(requests, ['https://www.youtube.com/watch?v=new']);
  cleanup();
});
