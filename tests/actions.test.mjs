import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionGate } from '../src/game/actions.js';
test('cancelled pointer-lock completion cannot resume after blur or leave', async () => {
  const gate = createActionGate(); let resolve; let resumed = false;
  const pending = new Promise(r => { resolve = r; });
  const action = gate.run(() => pending, () => true, () => { resumed = true; });
  gate.cancel(); resolve();
  assert.equal(await action, false); assert.equal(resumed, false);
});
test('resume rechecks focus and session conditions after awaited input setup', async () => {
  const gate = createActionGate(); let resolve; let visible = true; let resumed = false;
  const pending = new Promise(r => { resolve = r; });
  const action = gate.run(() => pending, () => visible, () => { resumed = true; });
  visible = false; resolve();
  assert.equal(await action, false); assert.equal(resumed, false);
});
test('latest pending action wins while unchanged focused actions apply exactly once', async () => {
  const gate = createActionGate(); let resolve; let applies = 0;
  const old = gate.run(() => new Promise(r => { resolve = r; }), () => true, () => { applies += 100; });
  const latest = gate.run(async () => {}, () => true, () => { applies++; });
  assert.equal(await latest, true); resolve();
  assert.equal(await old, false); assert.equal(applies, 1);
});
