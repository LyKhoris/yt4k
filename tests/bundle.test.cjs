const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('installable bundle compiles and declares only implemented platforms', () => {
  const source = fs.readFileSync('yt4k-1.2.0.user.js', 'utf8');
  assert.doesNotThrow(() => new vm.Script(source));
  assert.match(source, /@match\s+https:\/\/www\.reddit\.com\/\*/);
  assert.match(source, /@match\s+https:\/\/x\.com\/\*/);
  assert.match(source, /@match\s+https:\/\/www\.youtube\.com\/\*/);
  assert.match(source, /@match\s+https:\/\/www\.pornhub\.com\/\*/);
  assert.doesNotMatch(source, /@match[^\n]*https:\/\/\*\.pornhub\.com/);
  assert.match(source, /@grant\s+none/);
  assert.match(source, /@sandbox\s+raw/);
  assert.match(source, /@inject-into\s+page/);
  assert.match(source, /@run-at\s+document-start/);
  const { version } = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(source.match(/@version\s+(\S+)/)[1], version);
});

test('published script has stable update URLs and preserves installed identity', () => {
  const source = fs.readFileSync('yt4k-1.2.0.user.js', 'utf8');
  const url = 'https://raw.githubusercontent.com/LyKhoris/yt4k/main/yt4k-1.2.0.user.js';
  const field = name => source.match(new RegExp(`^// @${name}\\s+(\\S+)`, 'm'))?.[1];
  assert.equal(field('updateURL'), url);
  assert.equal(field('downloadURL'), url);
  assert.equal(field('name'), 'yt4k');
  assert.equal(field('namespace'), 'https://localhost/yt-auto-max-quality');
});

test('the actual four-platform bundle dispatches only Pornhub on its host', () => {
  const source = fs.readFileSync('yt4k-1.2.0.user.js', 'utf8');
  const intervals = [];
  const listeners = [];
  const selectors = [];
  const location = { hostname: 'www.pornhub.com', pathname: '/view_video.php' };
  const window = { location, addEventListener: name => listeners.push(name) };
  window.self = window.top = window;
  vm.runInNewContext(source, {
    location, window, console,
    document: { querySelectorAll(selector) { selectors.push(selector); return []; } },
    setInterval(fn, ms) { intervals.push(ms); return intervals.length; },
    setTimeout() { assert.fail('YouTube should not start on Pornhub'); },
    MutationObserver: class { constructor() { assert.fail('Reddit/X should not start on Pornhub'); } },
  });
  assert.deepEqual(intervals, [1000]);
  assert.deepEqual(listeners, ['pageshow']);
  assert.deepEqual(selectors, ['.original.mainPlayerDiv .playerFlvContainer[id^="playerDiv_"]']);
});

for (const scenario of [
  { host: 'www.reddit.com', selectors: ['*'], intervals: [1000], timeouts: [], observers: 1,
    events: ['window:pageshow', 'window:popstate'] },
  { host: 'x.com', selectors: ['[data-testid="videoPlayer"] video'], intervals: [1000], timeouts: [], observers: 1,
    events: ['document:loadedmetadata', 'document:emptied', 'document:play'] },
  { host: 'www.youtube.com', selectors: [], intervals: [], timeouts: [250], observers: 0,
    events: ['window:yt-navigate-finish', 'window:yt-page-data-updated', 'window:pageshow', 'document:loadedmetadata'] },
  { host: 'unsupported.example', selectors: [], intervals: [], timeouts: [], observers: 0, events: [] },
]) {
  test(`actual bundled startup is isolated on ${scenario.host}`, () => {
    const selectors = [], intervals = [], timeouts = [], events = [];
    let observers = 0;
    const location = { hostname: scenario.host, pathname: '/', href: `https://${scenario.host}/` };
    const window = { location, addEventListener: name => events.push(`window:${name}`) };
    window.top = window.self = window;
    const document = {
      querySelectorAll(selector) { selectors.push(selector); return []; },
      addEventListener: name => events.push(`document:${name}`),
    };
    vm.runInNewContext(fs.readFileSync('yt4k-1.2.0.user.js', 'utf8'), {
      window, document, location, console,
      setInterval(fn, ms) { intervals.push(ms); return intervals.length; },
      setTimeout(fn, ms) { timeouts.push(ms); return timeouts.length; },
      clearTimeout() {},
      MutationObserver: class { constructor() { observers++; } observe() {} },
    });
    assert.deepEqual(selectors, scenario.selectors);
    assert.deepEqual(intervals, scenario.intervals);
    assert.deepEqual(timeouts, scenario.timeouts);
    assert.deepEqual(events, scenario.events);
    assert.equal(observers, scenario.observers);
  });
}
