const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/platforms/reddit.js'), 'utf8');

function element(tag, children = []) {
  return {
    tag, children, isConnected: true,
    matches(selector) { return selector === this.tag; },
    querySelectorAll(selector) {
      return this.children.flatMap(child => [
        ...(selector === '*' || child.tag === selector ? [child] : []),
        ...child.querySelectorAll(selector)
      ]);
    },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    getBoundingClientRect() {
      return this.rect || { top: 0, bottom: 100, left: 0, right: 100, width: 100, height: 100 };
    }
  };
}

function player(dimensions = [[1920, 1080], [3840, 2160], [7680, 4320]]) {
  const host = element('shreddit-player');
  const video = element('video');
  Object.assign(video, { paused: false, readyState: 4, videoWidth: 1920, videoHeight: 1080 });
  host.shadowRoot = element('root', [video]);
  host.shadowRoot.host = host;
  const permutations = dimensions.map(([width, height], index) => ({ source: {
    dimensions: { width, height }, bitrateBps: (index + 1) * 1000,
    videoCodec: 'H264', url: `https://v.redd.it/test/DASH_${index}.mp4`
  } }));
  const controller = {
    host, videoElement: video, playbackPermutations: permutations,
    current: permutations[0], getCurrentSource() { return this.current; }
  };
  host.calls = [];
  Object.assign(host, {
    isMp4: true, isHls: false, packagedMediaController: controller,
    currentQualityLevelIndex: -1,
    qualityLevels: dimensions.map((_, index) => ({ quality: 1080, mp4SourceIndex: index })),
    mediaActionsController: {
      host, videoElement: video,
      setQualityLevel(index) {
        host.calls.push(index);
        if (host.throwSetter) throw new Error('setter failed');
        if (host.ignoreSetter) return;
        controller.current = controller.playbackPermutations[index];
        host.currentQualityLevelIndex = index;
        if (!host.noDecode) {
          video.videoWidth = controller.current.source.dimensions.width;
          video.videoHeight = controller.current.source.dimensions.height;
        }
      }
    }
  });
  return host;
}

function harness(children = [], options = {}) {
  const document = element('document', children);
  const observers = [];
  const intervals = new Set();
  const timeouts = new Set();
  const events = new Map();
  const logs = [];
  let adapter;
  const api = {
    config: { maxHeight: 2160, debug: false },
    register(value) { adapter = value; },
    selectBest(levels, cap) {
      return levels.filter(l => Number.isFinite(l.width) && l.width > 0 &&
        Number.isFinite(l.height) && l.height > 0 && l.height <= cap)
        .sort((a, b) => b.height - a.height || b.width - a.width || b.bitrate - a.bitrate)[0] || null;
    },
    async waitFor(read) { return read() || null; },
    log(...args) { logs.push(args); }, warn(...args) { logs.push(args); },
    ...options
  };
  const context = {
    YT4K: api, document,
    window: {
      innerWidth: 1200, innerHeight: 800,
      addEventListener(event, callback) { events.set(event, callback); },
      removeEventListener(event) { events.delete(event); }
    },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe(root) { this.root = root; this.connected = true; }
      disconnect() { this.connected = false; }
    },
    setInterval(callback) { intervals.add(callback); return callback; },
    clearInterval(callback) { intervals.delete(callback); },
    setTimeout(callback) { timeouts.add(callback); return callback; },
    clearTimeout(callback) { timeouts.delete(callback); }
  };
  vm.runInNewContext(source, context);
  const cleanup = adapter.start(api);
  return {
    adapter, document, observers, intervals, timeouts, events, logs, cleanup,
    async tick() { for (const callback of intervals) callback(); await this.flush(); },
    async flush() { await Promise.resolve(); await Promise.resolve(); },
    async add(node, root = document) {
      root.children.push(node);
      observers.find(observer => observer.root === root && observer.connected)
        .callback([{ addedNodes: [node] }]);
      for (const callback of [...timeouts]) { timeouts.delete(callback); callback(); }
      await this.flush();
    }
  };
}

test('registers only the narrow www.reddit.com adapter', () => {
  const h = harness();
  assert.equal(h.adapter.id, 'reddit');
  assert.deepEqual(Array.from(h.adapter.hosts), ['www.reddit.com']);
  h.cleanup();
});

test('uses mapped source index and literal height, not bucket or menu index', async () => {
  const p = player([[714, 1280], [2160, 3840], [1200, 2160], [476, 854]]);
  p.qualityLevels = [{ quality: 540, mp4SourceIndex: 0 },
    { quality: 1080, mp4SourceIndex: 1 }, { quality: 720, mp4SourceIndex: 2 }];
  const h = harness([p]);
  await h.flush();
  assert.deepEqual(p.calls, [2]);
  assert.equal(h.logs.filter(x => x[0] === 'reddit effective').length, 1);
  await h.tick();
  assert.deepEqual(p.calls, [2]);
});

test('unknown, nonnumeric, above-cap and unmapped sources are not guessed', async () => {
  const p = player([[2000, 3000], [4000, 4000], [1920, '1080'], [500, NaN], [1920, 1080]]);
  p.qualityLevels.pop();
  const h = harness([p]);
  await h.tick();
  assert.deepEqual(p.calls, []);
});

test('ties use actual width and bitrate while retaining original indices', async () => {
  const p = player([[1000, 1080], [1920, 1080], [1920, 1080]]);
  const h = harness([p]);
  await h.flush();
  assert.deepEqual(p.calls, [2]);
});

test('inaccessible controllers, HLS and ownership mismatches stay untouched', async () => {
  const a = player(), b = player(), c = player(), d = player();
  a.isMp4 = false;
  b.isHls = true;
  delete c.packagedMediaController;
  d.mediaActionsController.videoElement = {};
  const h = harness([a, b, c, d]);
  await h.tick();
  for (const p of [a, b, c, d]) assert.deepEqual(p.calls, []);
});

test('only the active codec and valid controller source objects are candidates', async () => {
  const p = player();
  p.packagedMediaController.playbackPermutations[1].source.videoCodec = 'VP9';
  const h = harness([p]);
  await h.flush();
  assert.deepEqual(p.calls, [0]);
});

test('independently discovers multiple players in newly inserted open roots', async () => {
  const h = harness();
  const a = player(), b = player([[640, 360], [1280, 720]]);
  const wrapper = element('wrapper');
  wrapper.shadowRoot = element('root', [a, b]);
  wrapper.shadowRoot.host = wrapper;
  await h.add(wrapper);
  assert.deepEqual(a.calls, [1]);
  assert.deepEqual(b.calls, [1]);
});

test('late player roots and late controllers are retried without history patches', async () => {
  const p = player();
  const q = player();
  const actions = q.mediaActionsController;
  delete q.mediaActionsController;
  const root = p.shadowRoot;
  delete p.shadowRoot;
  const h = harness([p, q]);
  assert.deepEqual(p.calls, []);
  assert.deepEqual(q.calls, []);
  p.shadowRoot = root;
  q.mediaActionsController = actions;
  await h.tick();
  assert.deepEqual(p.calls, [1]);
  assert.deepEqual(q.calls, [1]);
});

test('offscreen paused players wait until visible or playing', async () => {
  const p = player();
  p.shadowRoot.querySelector('video').paused = true;
  p.rect = { top: 2000, bottom: 2100, left: 0, right: 100, width: 100, height: 100 };
  const h = harness([p]);
  await h.tick();
  assert.deepEqual(p.calls, []);
  p.shadowRoot.querySelector('video').paused = false;
  await h.tick();
  assert.deepEqual(p.calls, [1]);
});

test('a recycled element is reapplied for a different media ladder', async () => {
  const p = player();
  const h = harness([p]);
  await h.flush();
  const replacement = player([[640, 360], [1280, 720]]);
  const c = p.packagedMediaController;
  c.playbackPermutations = replacement.packagedMediaController.playbackPermutations;
  c.current = c.playbackPermutations[0];
  p.currentQualityLevelIndex = -1;
  p.qualityLevels = replacement.qualityLevels;
  await h.tick();
  assert.deepEqual(p.calls, [1, 1]);
});

test('setter failures are bounded and decoded mismatch is not success', async () => {
  const a = player(), b = player();
  a.throwSetter = true;
  b.noDecode = true;
  const h = harness([a, b]);
  await h.flush();
  for (let i = 0; i < 8; i++) await h.tick();
  assert.equal(a.calls.length, 3);
  assert.equal(b.calls.length, 1); // already selected: verify again, not reload
  assert.equal(h.logs.filter(x => x[0] === 'reddit effective').length, 0);
  assert.equal(h.logs.filter(x => x[0] === 'reddit: requested rendition not verified').length, 3);
});

test('cleanup cancels pending verification, listeners, timers and observers', async () => {
  let read, resolve;
  const p = player();
  const h = harness([p], { waitFor(callback) {
    read = callback;
    return new Promise(done => { resolve = done; });
  } });
  h.cleanup();
  assert.equal(read(), 'cancelled');
  resolve(true);
  await h.flush();
  assert.equal(h.intervals.size, 0);
  assert.equal(h.timeouts.size, 0);
  assert.equal(h.events.size, 0);
  assert.ok(h.observers.every(o => !o.connected));
  assert.equal(h.logs.filter(x => x[0] === 'reddit effective').length, 0);
});

test('pending attempts are serialized and removal cancels effective verification', async () => {
  let read, resolve;
  const p = player();
  const h = harness([p], { waitFor(callback) {
    read = callback;
    return new Promise(done => { resolve = done; });
  } });
  await h.tick();
  await h.tick();
  assert.deepEqual(p.calls, [1]);
  p.isConnected = false;
  assert.equal(read(), 'cancelled');
  await h.tick();
  resolve(true);
  await h.flush();
  assert.equal(h.logs.filter(x => x[0] === 'reddit effective').length, 0);
  assert.ok(h.observers.filter(o => o.root.host === p).every(o => !o.connected));
});

test('a setter no-op is retried at most three times and never reported effective', async () => {
  const p = player();
  p.ignoreSetter = true;
  const h = harness([p]);
  for (let i = 0; i < 8; i++) await h.tick();
  assert.equal(p.calls.length, 3);
  assert.equal(h.logs.length, 0);
});
