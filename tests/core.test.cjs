const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load() {
  const context = vm.createContext({ console, setTimeout, clearTimeout });
  vm.runInContext(`${fs.readFileSync('src/core.js', 'utf8')}\nglobalThis.api = YT4K;`, context);
  return context.api;
}

test('selects the highest actual height at or below the ceiling', () => {
  const api = load();
  const levels = [4320, 720, 2160, 1080].map(height => ({ width: height * 2, height }));
  assert.equal(api.selectBest(levels), levels[2]);
  assert.equal(api.selectBest(levels, 1080), levels[3]);
  assert.equal(api.selectBest([{ width: 1280, height: 720 }]).height, 720);
});

test('unknown, locked and above-cap variants are never selected', () => {
  const api = load();
  assert.equal(api.selectBest([
    null, {}, { width: 0, height: 720 }, { width: 1920, height: '1080' },
    { width: 2160, height: 3840 }, { width: Infinity, height: 720 },
    { width: 3840, height: 2160, disabled: true },
    { width: 3840, height: 2160, locked: true },
  ]), null);
  assert.equal(api.selectBest([{ width: 1, height: 1 }], NaN), null);
});

test('selection does not mutate order and breaks ties deterministically', () => {
  const api = load();
  const a = { width: 1920, height: 1080, bitrate: 100 };
  const b = { width: 1920, height: 1080, bitrate: 200 };
  const levels = [a, b];
  assert.equal(api.selectBest(levels), b);
  assert.deepEqual(levels, [a, b]);
});

test('waitFor returns the actual element, not a boolean surrogate', async () => {
  const api = load();
  const element = { querySelectorAll() {} };
  assert.equal(await api.waitFor(() => element), element);
  assert.equal(await api.waitFor(() => false, 5, 1), null);
  let count = 0;
  assert.equal(await api.waitFor(() => ++count === 2 && element, 50, 1), element);
});

test('dispatches by exact host and initializes once', async () => {
  const api = load();
  let starts = 0;
  api.register({ id: 'test', hosts: ['x.com'], start: () => starts++ });
  assert.equal(await api.start('notx.com'), false);
  assert.equal(await api.start('x.com.example.org'), false);
  assert.equal(await api.start('x.com'), true);
  await api.start('x.com');
  assert.equal(starts, 1);
});

test('failed adapter initialization remains retryable', async () => {
  const api = load();
  let attempts = 0;
  api.register({ id: 'retry', hosts: ['example.org'], start() {
    if (++attempts === 1) throw new Error('not ready');
  } });
  assert.equal(await api.start('example.org'), false);
  assert.equal(await api.start('example.org'), true);
  assert.equal(attempts, 2);
});

test('selection invariant across deterministic unsorted ladders', () => {
  const api = load();
  let seed = 42;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let run = 0; run < 500; run++) {
    const levels = Array.from({ length: 12 }, () => ({
      width: Math.floor(random() * 8000), height: Math.floor(random() * 5000),
      locked: random() < 0.1,
    }));
    const cap = 144 + Math.floor(random() * 2017);
    const selected = api.selectBest(levels, cap);
    const safe = levels.filter(v => v.width > 0 && v.height > 0 && v.height <= cap && !v.locked);
    assert.equal(selected?.height ?? null, safe.length ? Math.max(...safe.map(v => v.height)) : null);
  }
});
