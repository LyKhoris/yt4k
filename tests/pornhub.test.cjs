'use strict';

// Source-consumer checks plus fail-closed adapter policy. Browser-wrapper
// playback evidence is recorded separately; these stubs are not a live site.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '../prototypes/pornhub/site-consumers.fixture.js'),
  'utf8',
);

function fixture({ registry = {}, players = {}, elements = [], videoShow } = {}) {
  const context = {
    playerObjList: registry,
    MGP: { players },
    document: { getElementById: id => elements.includes(id) ? { id } : null },
  };
  if (videoShow !== undefined) context.VIDEO_SHOW = videoShow;
  vm.createContext(context);
  vm.runInContext(source, context, { timeout: 1000 });
  return context;
}

test('source-only footer consumer: empty registry has no observed time', () => {
  const context = fixture();
  assert.equal(context.n(), undefined);
  assert.deepEqual(Array.from(context.e), []);
});

test('source-only footer consumer: key maps to MGP, registry value is ignored', () => {
  const context = fixture({
    registry: { content: { notAnMgpPlayer: true } },
    players: { content: { isPlaying: () => true, getCurrentTime: () => 12.9 } },
    elements: ['content'],
  });
  assert.deepEqual(Array.from(context.n()), [10]);
});

test('source-only footer consumer: element association is required', () => {
  let reads = 0;
  const context = fixture({
    registry: { content: {} },
    players: { content: { isPlaying: () => true, getCurrentTime: () => ++reads } },
  });
  assert.equal(context.n(), undefined);
  assert.equal(reads, 0);
});

test('source-only footer consumer: missing wrapper is ignored', () => {
  const context = fixture({ registry: { content: {} }, elements: ['content'] });
  assert.equal(context.n(), undefined);
});

test('source-only footer consumer: non-playing wrapper is ignored', () => {
  const context = fixture({
    registry: { content: {} },
    players: {
      content: {
        isPlaying: () => false,
        getCurrentTime: () => assert.fail('must not read stopped player'),
      },
    },
    elements: ['content'],
  });
  assert.equal(context.n(), undefined);
});

test('source-only footer consumer: first entry is not evidence of main content', () => {
  const context = fixture({
    registry: { incidental: {}, main: {} },
    players: {
      incidental: { isPlaying: () => true, getCurrentTime: () => 7 },
      main: { isPlaying: () => true, getCurrentTime: () => 27 },
    },
    elements: ['incidental', 'main'],
  });
  assert.deepEqual(Array.from(context.n()), [5]);
});

test('source-only footer consumer: stale first entry hides later usable player', () => {
  const context = fixture({
    registry: { stale: {}, main: {} },
    players: { main: { isPlaying: () => true, getCurrentTime: () => 27 } },
    elements: ['main'],
  });
  assert.equal(context.n(), undefined);
});

test('source-only flag consumer: pc uses VIDEO_SHOW.videoId', () => {
  const context = fixture({
    videoShow: { videoId: 'desktop', playerId: 'mobile' },
    players: {
      desktop: { getCurrentTime: () => 11 },
      mobile: { getCurrentTime: () => 22 },
    },
  });
  assert.equal(context.flagTimestamp.call({ platform: 'pc' }), 11);
});

test('source-only flag consumer: non-pc uses VIDEO_SHOW.playerId', () => {
  const context = fixture({
    videoShow: { videoId: 'desktop', playerId: 'mobile' },
    players: {
      desktop: { getCurrentTime: () => 11 },
      mobile: { getCurrentTime: () => 22 },
    },
  });
  assert.equal(context.flagTimestamp.call({ platform: 'mobile' }), 22);
});

test('source-only flag consumer: missing VIDEO_SHOW yields no time', () => {
  const context = fixture();
  assert.equal(context.flagTimestamp.call({ platform: 'pc' }), undefined);
});

test('source-only flag consumer: missing keyed wrapper yields no time', () => {
  const context = fixture({ videoShow: { videoId: 'missing' } });
  assert.equal(context.flagTimestamp.call({ platform: 'pc' }), undefined);
});

test('source-only consumers assume MGP exists, not a safe discovery interface', () => {
  const context = fixture({ videoShow: { videoId: 'content' } });
  delete context.MGP;
  assert.throws(() => context.n(), { name: 'ReferenceError' });
  assert.throws(() => context.flagTimestamp.call({ platform: 'pc' }), {
    name: 'ReferenceError',
  });
});

function adapterFixture(options = {}) {
  const calls = [];
  const logs = [];
  const warnings = [];
  const intervals = [];
  const listeners = new Map();
  const definitions = options.definitions || [
    { format: 'hls', quality: '720', width: 1280, height: 720, videoUrl: 'https://example.test/720.m3u8' },
    { format: 'hls', quality: '2160', width: 3840, height: 2160, videoUrl: 'https://example.test/2160.m3u8' },
    { format: 'hls', quality: '4320', width: 7680, height: 4320, videoUrl: 'https://example.test/4320.m3u8' },
  ];
  const video = { currentSrc: 'blob:test', readyState: 4, videoWidth: 1280, videoHeight: 720 };
  const root = {
    id: 'playerDiv_test', isConnected: true,
    querySelectorAll: () => options.multipleVideos ? [video, {}] : [video],
    contains: element => element === video,
  };
  const settings = { playerId: root.id, mainRoll: { mediaDefinition: definitions } };
  let selected = 720;
  let offered = options.offered || [720, 2160, 4320];
  const playbackState = { adRollReady: false };
  const player = {
    settings: () => settings,
    isSourceReady: () => true,
    getCurrentState: () => playbackState,
    quality: {
      get: ({ list } = {}) => list ? offered : selected,
      set: request => {
        calls.push(request);
        if (options.throwSetter) throw Error('unavailable');
        if (options.ignoreSetter) return;
        selected = request.quality;
        if (!options.noDecode) {
          const source = definitions.find(d => Number(d.quality) === selected);
          video.videoWidth = options.decodedWidth ?? source.width;
          video.videoHeight = source.height;
        }
      },
    },
  };
  const window = {
    MGP: { buildInfo: { playerName: 'desktop', playerVersion: '9.2.7',
      libraryName: 'hlsjs.light', libraryVersion: '1.6.15' }, players: { [root.id]: player } },
    location: { pathname: '/view_video.php' },
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
  };
  window.top = window.self = window;
  const context = vm.createContext({ window,
    document: { querySelectorAll: selector => selector.includes('.original.mainPlayerDiv') ? [root] : [] },
    setInterval: fn => { intervals.push(fn); return fn; },
    clearInterval: fn => intervals.splice(intervals.indexOf(fn), 1),
    setTimeout, console,
  });
  const core = fs.readFileSync(path.join(__dirname, '../src/core.js'), 'utf8');
  const adapter = fs.readFileSync(path.join(__dirname, '../src/platforms/pornhub.js'), 'utf8');
  vm.runInContext(`${core}\nglobalThis.api = YT4K; globalThis.adapter = null;
    YT4K.register = value => globalThis.adapter = value;\n${adapter}`, context);
  context.api.log = (...args) => logs.push(args);
  context.api.warn = (...args) => warnings.push(args);
  context.api.waitFor = async read => read();
  const start = () => context.adapter.start(context.api);
  const flush = () => new Promise(resolve => setImmediate(resolve));
  return { context, window, video, root, player, settings, definitions, playbackState,
    calls, logs, warnings, intervals, listeners, start, flush,
    tick: () => intervals.forEach(fn => fn()),
    setSelected: value => { selected = value; },
    setOffered: value => { offered = value; },
  };
}

test('MGP adapter: only the verified narrow host is registered', () => {
  const f = adapterFixture();
  assert.deepEqual(Array.from(f.context.adapter.hosts), ['www.pornhub.com']);
});

test('MGP adapter: highest actual height under the cap, not largest quality label', async () => {
  const f = adapterFixture();
  f.start();
  await f.flush();
  assert.equal(f.calls.length, 1);
  assert.deepEqual({ ...f.calls[0] }, { quality: 2160, auto: false, manual: false });
  assert.equal(f.logs.at(-1)[0], 'pornhub effective');
});

test('MGP adapter: labels never substitute for literal rendition dimensions', async () => {
  const f = adapterFixture({ definitions: [
    { format: 'hls', quality: '2160', width: 2160, height: 3840, videoUrl: 'https://example.test/a.m3u8' },
    { format: 'hls', quality: '720', width: 1080, height: 1920, videoUrl: 'https://example.test/b.m3u8' },
  ], offered: [2160, 720] });
  f.start(); await f.flush();
  assert.equal(f.calls[0].quality, 720);
  assert.equal(f.logs.at(-1)[1].height, 1920);
});

test('MGP adapter: a lone eligible rendition is valid', async () => {
  const f = adapterFixture({ offered: [2160] });
  f.start(); await f.flush();
  assert.equal(f.calls[0].quality, 2160);
});

for (const [name, mutate] of [
  ['all options above cap', f => { f.setOffered([4320]); }],
  ['unknown dimensions', f => { delete f.definitions[1].height; }],
  ['zero dimensions', f => { f.definitions[1].width = 0; }],
  ['locked source', f => { f.definitions[1].locked = true; }],
  ['disabled source', f => { f.definitions[1].disabled = true; }],
  ['remote ladder', f => { f.definitions[1].remote = true; }],
  ['master-only ladder', f => { f.definitions[1].quality = [720, 2160]; }],
  ['ambiguous duplicate', f => { f.definitions.push({ ...f.definitions[1], width: 4096 }); }],
  ['unmapped option', f => { f.setOffered([1080]); }],
  ['string label rather than numeric API list', f => { f.setOffered(['2160']); }],
  ['other MSE format', f => { f.definitions.push({ format: 'dash' }); }],
  ['unknown wrapper version', f => { f.window.MGP.buildInfo.playerVersion = '9.3.0'; }],
  ['unknown HLS version', f => { f.window.MGP.buildInfo.libraryVersion = 'other'; }],
  ['ad roll', f => { f.playbackState.adRollReady = true; }],
  ['settings belong to another root', f => { f.settings.playerId = 'other'; }],
  ['native HLS', f => { f.video.currentSrc = f.definitions[0].videoUrl; }],
  ['embed', f => { f.window.top = {}; }],
  ['non-watch route', f => { f.window.location.pathname = '/support'; }],
]) {
  test(`MGP adapter: skips ${name}`, async () => {
    const f = adapterFixture(); mutate(f); f.start(); await f.flush();
    assert.equal(f.calls.length, 0);
  });
}

test('MGP adapter: rejects multiple videos in one registered root', async () => {
  const f = adapterFixture({ multipleVideos: true }); f.start(); await f.flush();
  assert.equal(f.calls.length, 0);
});

test('MGP adapter: deferred readiness does not force loading; later readiness works', async () => {
  const f = adapterFixture(); f.video.readyState = 0; f.start(); await f.flush();
  assert.equal(f.calls.length, 0);
  f.video.readyState = 4; f.tick(); await f.flush();
  assert.equal(f.calls.length, 1);
});

test('MGP adapter: progressive source must be positively owned', async () => {
  const f = adapterFixture();
  for (const d of f.definitions) d.format = 'mp4';
  f.video.currentSrc = 'https://example.test/unrelated.mp4'; f.start(); await f.flush();
  assert.equal(f.calls.length, 0);
  f.video.currentSrc = f.definitions[0].videoUrl; f.tick(); await f.flush();
  assert.equal(f.calls.length, 1);
  assert.equal(f.logs.at(-1)[1].format, 'mp4');
});

for (const options of [{ ignoreSetter: true }, { noDecode: true }, { throwSetter: true }]) {
  test(`MGP adapter: never claims effective quality on ${Object.keys(options)[0]}`, async () => {
    const f = adapterFixture(options); f.start(); await f.flush(); f.tick(); await f.flush();
    assert.equal(f.calls.length, 1);
    assert.equal(f.logs.some(log => log[0] === 'pornhub effective'), false);
    assert.equal(f.warnings.length, 1);
  });
}

test('MGP adapter: leaves later manual changes alone', async () => {
  const f = adapterFixture(); f.start(); await f.flush(); f.setSelected(720);
  f.tick(); await f.flush(); assert.equal(f.calls.length, 1);
});

test('MGP adapter: replacing the registered wrapper creates a new attempt', async () => {
  const f = adapterFixture(); f.start(); await f.flush();
  f.window.MGP.players[f.root.id] = { ...f.player };
  f.tick(); await f.flush(); assert.equal(f.calls.length, 2);
});

test('MGP adapter: cleanup stops discovery and removes listeners', async () => {
  const f = adapterFixture(); const stop = f.start(); await f.flush(); stop();
  assert.equal(f.intervals.length, 0);
  assert.equal(f.listeners.size, 0);
});

test('MGP adapter: observed site ladder shape selects manifest-confirmed 1080 height', async () => {
  const ladder = JSON.parse(fs.readFileSync(path.join(__dirname,
    '../prototypes/pornhub/site-ladder.fixture.json'), 'utf8'));
  // URLs are intentionally fictitious; the saved numeric source evidence does
  // not contain signed media URLs or any content identifiers.
  const definitions = ladder.definitions.map((source, i) => ({ ...source,
    videoUrl: `https://example.test/fixture-${i}.m3u8`,
  }));
  const f = adapterFixture({ definitions, offered: [1080, 720, 480, 240] });
  f.start(); await f.flush();
  assert.equal(f.calls[0].quality, 1080);
  const master = ladder.masters.find(m => Number(m.quality) === f.calls[0].quality);
  assert.equal(master.resolutions.length, 1);
  assert.equal(master.resolutions[0].height, f.logs.at(-1)[1].height);
});

test('source-only ladder: lower-resolution width rounding is not decoded-width evidence', () => {
  const ladder = JSON.parse(fs.readFileSync(path.join(__dirname,
    '../prototypes/pornhub/site-ladder.fixture.json'), 'utf8'));
  assert.equal(ladder.definitions.find(d => d.quality === '240').width, 426);
  assert.equal(ladder.masters.find(d => d.quality === '240').resolutions[0].width, 427);
});

test('MGP adapter: production-site settings redact sources; keyed inspectOriginal supplies dimensions', async () => {
  const f = adapterFixture();
  const original = { mainRoll: { mediaDefinition: f.definitions } };
  const requestedIds = [];
  f.settings.mainRoll.mediaDefinition = [];
  f.window.MGP.inspectOriginal = id => {
    requestedIds.push(id);
    return id === f.root.id ? original : undefined;
  };
  f.start(); await f.flush();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].quality, 2160);
  assert.equal(f.logs.at(-1)[0], 'pornhub effective');
  assert.ok(requestedIds.length > 0);
  assert.ok(requestedIds.every(id => id === f.root.id));
});

test('MGP adapter: redacted settings without a keyed original remain unsupported', async () => {
  const f = adapterFixture(); f.settings.mainRoll.mediaDefinition = [];
  f.window.MGP.inspectOriginal = () => undefined;
  f.start(); await f.flush(); assert.equal(f.calls.length, 0);
});

test('MGP adapter: nonempty unknown settings are not overridden by original configuration', async () => {
  const f = adapterFixture();
  f.settings.mainRoll.mediaDefinition = [{ format: 'hls', quality: '2160' }];
  f.window.MGP.inspectOriginal = () => ({ mainRoll: { mediaDefinition: f.definitions } });
  f.start(); await f.flush(); assert.equal(f.calls.length, 0);
});

test('MGP adapter: real 240 rendition may decode one pixel wider than site configuration', async () => {
  const f = adapterFixture({ definitions: [{ format: 'hls', quality: '240',
    width: 426, height: 240, videoUrl: 'https://example.test/240.m3u8' }],
  offered: [240], decodedWidth: 427 });
  f.start(); await f.flush();
  assert.equal(f.logs.at(-1)[0], 'pornhub effective');
  assert.equal(f.logs.at(-1)[1].width, 427);
  assert.equal(f.logs.at(-1)[1].height, 240);
});

test('MGP adapter: larger decoded-width mismatch is not verified', async () => {
  const f = adapterFixture({ decodedWidth: 4096 });
  f.start(); await f.flush();
  assert.equal(f.logs.some(log => log[0] === 'pornhub effective'), false);
  assert.equal(f.warnings.length, 1);
});
