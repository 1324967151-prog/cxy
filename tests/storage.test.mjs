import test from 'node:test';
import assert from 'node:assert/strict';
const config = { map: 'c-corner', weapon: 'vandal', difficulty: 'standard', duration: 60 };
function storage(value) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value });
}
test('corrupt or prototype-named saved preferences cannot crash the app', async () => {
  storage({ getItem: () => JSON.stringify({ config: { weapon: 'constructor', difficulty: 'toString' }, settings: { sensitivity: 100 } }) });
  const { loadPreferences } = await import('../src/game/storage.js?invalid');
  const p = loadPreferences();
  assert.equal(p.config.weapon, 'vandal'); assert.equal(p.config.difficulty, 'standard');
  assert.equal(p.settings.sensitivity, 3);
});
test('best scores stay monotonic when browser storage is unavailable', async () => {
  storage({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
  const { recordBest, loadBest } = await import('../src/game/storage.js?blocked');
  assert.equal(recordBest(config, 200), 200);
  assert.equal(recordBest(config, 100), 200);
  assert.equal(loadBest(config), 200);
});
test('scores are isolated by map weapon difficulty and duration', async () => {
  const values = new Map();
  storage({ getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) });
  const { recordBest, loadBest } = await import('../src/game/storage.js?isolation');
  recordBest(config, 300);
  for (const other of [{ map: 'b-market' }, { weapon: 'sheriff' }, { difficulty: 'easy' }, { duration: 30 }]) assert.equal(loadBest({ ...config, ...other }), 0);
  assert.equal(loadBest(config), 300);
});
test('readable but unwritable storage cannot overwrite a newer page-lifetime best', async () => {
  const key = [config.map, config.weapon, config.difficulty, config.duration].join(':');
  storage({ getItem: () => JSON.stringify({ [key]: 200 }), setItem() { throw new Error('quota'); } });
  const { recordBest, loadBest } = await import('../src/game/storage.js?quota');
  assert.equal(recordBest(config, 300), 300);
  assert.equal(loadBest(config), 300);
  assert.equal(recordBest(config, 250), 300);
});
