const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/platforms/x.js'), 'utf8');
const coreSource = fs.readFileSync(path.join(__dirname, '../src/core.js'), 'utf8');

function fixture({ maxHeight = 2160, waitFor, actualCore = false } = {}) {
  const roots = [];
  const intervals = new Map();
  const timeouts = new Map();
  const listeners = new Map();
  const logs = [];
  let adapter;
  let observer;
  let nextTimer = 0;
  const document = {
    querySelectorAll(selector) {
      assert.equal(selector, '[data-testid="videoPlayer"] video', 'no global UI queries');
      return roots.flatMap(root => root.videos).filter(video => video.isConnected);
    },
    querySelector() { assert.fail('must not query Settings or dialogs'); },
    get activeElement() { assert.fail('must not inspect or steal focus'); },
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); },
  };
  const context = {
    YT4K: { register(value) { adapter = value; } }, document,
    console: { info: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; observer = this; }
      observe(target) { assert.equal(target, document); }
      disconnect() { this.disconnected = true; }
    },
    setInterval(fn) { const id = ++nextTimer; intervals.set(id, fn); return id; },
    clearInterval(id) { intervals.delete(id); },
    setTimeout(fn) { const id = ++nextTimer; timeouts.set(id, fn); return id; },
    clearTimeout(id) { timeouts.delete(id); },
  };
  vm.runInNewContext(actualCore ? `${coreSource}\n${source}\nglobalThis.actualApi = YT4K;` : source, context);
  const api = {
    config: { maxHeight, debug: false },
    selectBest(levels, cap) {
      return levels.filter(v => Number.isFinite(v.width) && v.width > 0 &&
        Number.isFinite(v.height) && v.height > 0 && v.height <= cap)
        .sort((a, b) => b.height - a.height || b.width - a.width || (b.bitrate || 0) - (a.bitrate || 0))[0] || null;
    },
    waitFor: waitFor || (async read => read() || null),
    sleep: async () => {},
    log: (...args) => logs.push(args), warn: (...args) => logs.push(args),
  };
  function add(levels = [{ width: 1280, height: 720 }]) {
    const calls = [];
    const video = {
      isConnected: true, readyState: 4, src: 'blob:fixture',
      getAttribute: () => video.src,
      closest(selector) { return selector.includes('videoComponent') ? component : root; },
    };
    const hls = { media: video, levels, url: 'https://video.twimg.com/master.m3u8', autoLevelEnabled: true, manualLevel: -1 };
    const component = {};
    const player = {
      video: { hlsJs: hls, videoTag: video },
      domElement: { contains: node => node === video },
      setQualityLevel(index) {
        calls.push(index);
        if (player.throws) throw new Error('private API changed');
        if (player.ignored) return;
        const engine = player.video.hlsJs;
        engine.autoLevelEnabled = false;
        engine.manualLevel = index;
      },
    };
    component.__reactFiber$fixture = { stateNode: { videoPlayer: player }, return: null };
    const root = {
      videos: [video], trigger: null,
      querySelectorAll: () => root.videos,
      querySelector() { assert.fail('must not depend on hover-mounted controls'); },
    };
    roots.push(root);
    return { root, video, component, player, hls, calls };
  }
  let cleanup;
  return {
    adapter, roots, add, logs, intervals, timeouts, listeners,
    get observer() { return observer; },
    start() {
      if (actualCore) return context.actualApi.start('x.com');
      cleanup = adapter.start(api);
      return cleanup;
    },
    stop() { cleanup(); },
    async settle() { for (let i = 0; i < 16; i++) await Promise.resolve(); },
    async tick() {
      for (const fn of [...intervals.values()]) fn();
      for (const [id, fn] of [...timeouts]) { timeouts.delete(id); fn(); }
      for (let i = 0; i < 16; i++) await Promise.resolve();
    },
    media(type, target) { listeners.get(type)?.({ type, target }); },
  };
}

test('registers only X and Twitter hosts', () => {
  const f = fixture();
  assert.equal(f.adapter.id, 'x');
  assert.deepEqual(Array.from(f.adapter.hosts), ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com']);
});

test('ready owned HLS selects highest safe index with NO Settings trigger or hover', async () => {
  const f = fixture();
  const p = f.add([{ width: 1280, height: 720 }, { width: 3840, height: 2160 }]);
  assert.equal(p.root.trigger, null);
  f.start(); await f.settle(); await f.tick();
  assert.deepEqual(p.calls, [1]);
  assert.equal(p.hls.manualLevel, 1);
  assert.equal(p.hls.autoLevelEnabled, false);
  assert.ok(f.logs.some(args => args[0].includes('selection verified')));
});

test('actual shared core automatically fixes a no-controls player', async () => {
  const f = fixture({ actualCore: true });
  const p = f.add([{ width: 7680, height: 4320 }, { width: 3840, height: 2160 }, { width: 1280, height: 720 }]);
  assert.equal(await f.start(), true);
  await f.settle();
  assert.deepEqual(p.calls, [1]);
  assert.equal(p.hls.autoLevelEnabled, false);
  await f.start(); await f.tick();
  assert.deepEqual(p.calls, [1], 'actual core starts the adapter once');
});

test('selects by literal height and original index, not ambiguous short-side labels', async () => {
  const f = fixture();
  const p = f.add([
    { width: 7680, height: 4320 }, { width: 3840, height: 2160 },
    { width: 1920, height: 1080 }, { width: 2160, height: 3840 },
  ]);
  f.start(); await f.settle();
  assert.deepEqual(p.calls, [1]);
});

for (const [name, levels] of [
  ['portrait above literal cap', [{ width: 2160, height: 3840 }]],
  ['above cap', [{ width: 7680, height: 4320 }]],
  ['unknown dimensions', [{ width: 0, height: 0 }]],
  ['unknown alongside safe', [{ width: 1280, height: 720 }, { width: 0, height: 0 }]],
  ['non-numeric dimensions', [{ width: '1280', height: '720' }]],
  ['missing dimensions', [{}]],
]) test(`skips ${name}`, async () => {
  const f = fixture(); const p = f.add(levels);
  f.start(); await f.settle(); await f.tick();
  assert.deepEqual(p.calls, []);
});

test('duplicate-codec dimensions choose the highest-bitrate original API index', async () => {
  const f = fixture();
  const p = f.add([{ width: 1920, height: 1080, bitrate: 10 }, { width: 1920, height: 1080, bitrate: 20 }]);
  f.start(); await f.settle(); assert.deepEqual(p.calls, [1]);
});

test('eligible portrait and same-height width tie use dimensions, not labels', async () => {
  const f = fixture();
  const p = f.add([{ width: 1080, height: 1920 }, { width: 1440, height: 1920 }]);
  f.start(); await f.settle(); assert.deepEqual(p.calls, [1]);
});

test('two no-controls players independently use their own metadata and API', async () => {
  const f = fixture();
  const a = f.add([{ width: 640, height: 360 }, { width: 1280, height: 720 }]);
  const b = f.add([{ width: 1920, height: 1080 }, { width: 640, height: 360 }]);
  f.start(); await f.settle();
  assert.deepEqual(a.calls, [1]); assert.deepEqual(b.calls, [0]);
});

test('source changes and HLS replacement reapply; manual override and measured bitrate do not', async () => {
  const f = fixture(); const p = f.add();
  f.start(); await f.settle();
  p.hls.autoLevelEnabled = true; p.hls.manualLevel = -1; p.hls.levels[0].bitrate = 123456;
  await f.tick(); assert.deepEqual(p.calls, [0]);
  p.hls.url = 'https://video.twimg.com/new-master.m3u8';
  await f.tick(); assert.deepEqual(p.calls, [0, 0]);
  p.player.video.hlsJs = { ...p.hls };
  await f.tick(); assert.deepEqual(p.calls, [0, 0, 0]);
});

test('document-start empty DOM and delayed metadata initialize without controls', async () => {
  const f = fixture(); f.start(); await f.settle();
  const p = f.add([]); await f.tick(); assert.deepEqual(p.calls, []);
  p.hls.levels = [{ width: 1280, height: 720 }]; p.video.readyState = 0;
  await f.tick(); assert.deepEqual(p.calls, []);
  p.video.readyState = 4; await f.tick(); assert.deepEqual(p.calls, [0]);
});

test('same-source emptied/reset waits for metadata, then reapplies', async () => {
  const f = fixture(); const p = f.add();
  f.start(); await f.settle();
  p.hls.autoLevelEnabled = true; p.hls.manualLevel = -1; p.video.readyState = 0;
  f.media('emptied', p.video); await f.tick(); assert.deepEqual(p.calls, [0]);
  p.video.readyState = 4;
  f.media('loadedmetadata', p.video); await f.tick(); assert.deepEqual(p.calls, [0, 0]);
});

for (const broken of ['fiber', 'media', 'tag', 'container', 'multiple', 'setter']) {
  test(`rejects uncertain ownership/API: ${broken}`, async () => {
    const f = fixture(); const p = f.add();
    if (broken === 'fiber') delete p.component.__reactFiber$fixture;
    if (broken === 'media') p.hls.media = {};
    if (broken === 'tag') p.player.video.videoTag = {};
    if (broken === 'container') p.player.domElement.contains = () => false;
    if (broken === 'multiple') p.root.videos.push({ ...p.video });
    if (broken === 'setter') p.player.setQualityLevel = undefined;
    f.start(); await f.settle(); assert.deepEqual(p.calls, []);
  });
}

for (const failure of ['ignored', 'throws']) test(`${failure} setter is bounded and never reported verified`, async () => {
  const f = fixture(); const p = f.add(); p.player[failure] = true;
  f.start(); await f.settle(); await f.tick();
  assert.deepEqual(p.calls, [0]);
  assert.ok(!f.logs.some(args => args[0].includes('selection verified')));
});

test('cleanup cancels pending verification and removes every listener/timer', async () => {
  let release;
  const f = fixture({ waitFor: read => new Promise(resolve => { release = () => resolve(read()); }) });
  const p = f.add(); f.start(); f.stop(); release(); await f.settle();
  assert.deepEqual(p.calls, [0], 'request was synchronous before cleanup; never reissued');
  assert.equal(f.observer.disconnected, true);
  assert.equal(f.listeners.size, 0); assert.equal(f.intervals.size, 0); assert.equal(f.timeouts.size, 0);
  assert.ok(!f.logs.some(args => args[0].includes('selection verified')));
});

test('source replacement during verification cannot claim stale selection success', async () => {
  let release;
  const f = fixture({ waitFor: read => new Promise(resolve => { release = () => resolve(read()); }) });
  const p = f.add(); f.start(); p.hls.url = 'https://video.twimg.com/replaced.m3u8';
  release(); await f.settle();
  assert.deepEqual(p.calls, [0]);
  assert.ok(!f.logs.some(args => args[0].includes('selection verified')));
});

test('manual override during verification is not fought or reported as success', async () => {
  let release;
  const f = fixture({ waitFor: read => new Promise(resolve => { release = () => resolve(read()); }) });
  const p = f.add(); f.start();
  p.hls.manualLevel = -1; p.hls.autoLevelEnabled = true;
  release(); await f.settle(); await f.tick();
  assert.deepEqual(p.calls, [0]);
  assert.ok(!f.logs.some(args => args[0].includes('selection verified')));
});
