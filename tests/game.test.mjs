import test from 'node:test';
import assert from 'node:assert/strict';
import { DIFFICULTIES, MAPS } from '../src/game/config.js';
import { createSession, advance, resolveShot, pauseSession, resumeSession, endSession, remainingMs } from '../src/game/engine.js';
import { groundedPose, alphaHit, viewTransform, screenToWorld } from '../src/game/geometry.js';

const config = { map: 'c-corner', weapon: 'vandal', difficulty: 'standard', duration: 60 };
const random = () => 0.5;
test('spawns one enemy and never replaces an active enemy', () => {
  let s = createSession(config, 0);
  s = advance(s, 2000, random);
  assert.equal(s.status, 'running');
  assert.ok(s.enemy);
  const id = s.enemy.id;
  for (let t = 2001; t < 2300; t += 10) {
    s = advance(s, t, random);
    assert.equal(s.enemy.id, id);
  }
});
test('hit clears enemy immediately, scores and waits before next spawn', () => {
  const s = advance(createSession(config, 0), 2000, random);
  const hit = resolveShot(s, 'head', 2200, random);
  assert.equal(hit.enemy, null);
  assert.equal(hit.score, 200);
  assert.equal(hit.hits, 1);
  assert.equal(hit.headshots, 1);
  assert.equal(advance(hit, 2201, random).enemy, null);
  assert.ok(advance(hit, hit.nextSpawnAt, random).enemy);
});
test('body hits score 100, missed shot ends session', () => {
  const s = advance(createSession(config, 0), 2000, random);
  assert.equal(resolveShot(s, 'body', 2100, random).score, 100);
  const missed = resolveShot(s, null, 2100, random);
  assert.equal(missed.status, 'ended');
  assert.equal(missed.reason, 'miss');
  assert.equal(missed.enemy, null);
  assert.equal(advance(missed, 5000, random), missed);
});
test('expired enemy ends session without generating another', () => {
  const s = advance(createSession(config, 0), 2000, random);
  const ended = advance(s, s.enemy.deadline, random);
  assert.equal(ended.status, 'ended');
  assert.equal(ended.reason, 'timeout');
  assert.equal(ended.enemy, null);
});
test('pause preserves countdown and enemy deadline, resume excludes paused time', () => {
  const s = advance(createSession(config, 0), 2000, random);
  const paused = pauseSession(s, 2100);
  assert.equal(advance(paused, 50000, random), paused);
  const resumed = resumeSession(paused, 52100);
  assert.equal(resumed.endsAt, s.endsAt + 50000);
  assert.equal(resumed.enemy.deadline, s.enemy.deadline + 50000);
  assert.equal(resumed.enemy.spawnAt, s.enemy.spawnAt + 50000);
});
test('timer completes successfully and new sessions reset all state', () => {
  const ended = advance(createSession(config, 0), 60000, random);
  assert.equal(ended.reason, 'complete');
  const fresh = createSession({ ...config, duration: 30 }, 100000);
  assert.equal(fresh.score, 0);
  assert.equal(fresh.endsAt, 130000);
  assert.equal(fresh.enemy, null);
});
test('missed enemy deadline wins over a later session completion even after a long frame gap', () => {
  const s = advance(createSession(config, 0), 2000, random);
  const ended = advance(s, s.endsAt + 1000, random);
  assert.equal(ended.reason, 'timeout');
  assert.equal(ended.endedAt, s.enemy.deadline);
});
test('pausing after enemy deadline cannot rescue a failed round', () => {
  const s = advance(createSession(config, 0), 2000, random);
  const paused = pauseSession(s, s.enemy.deadline + 1);
  assert.equal(paused.status, 'ended');
  assert.equal(paused.reason, 'timeout');
});
test('stopping a paused round preserves effective remaining training time', () => {
  const s = createSession({ ...config, duration: 30 }, 0);
  const paused = pauseSession(s, 1000);
  const stopped = endSession(paused, 'stopped', 11000);
  assert.equal(remainingMs(stopped, 11000), 29000);
});
test('higher difficulties are faster and more frequent, each map has one fixed covered lane', () => {
  const d = Object.values(DIFFICULTIES);
  for (let i = 1; i < d.length; i++) {
    assert.ok(d[i].interval[1] < d[i - 1].interval[0]);
    assert.ok(d[i].peekMs < d[i - 1].peekMs);
    assert.ok(d[i].windowMs < d[i - 1].windowMs);
  }
  assert.equal(MAPS.length, 3);
  MAPS.forEach(m => {
    assert.equal(m.lanes.length, 1);
    m.lanes.forEach(l => assert.ok(l.floorY > 0 && l.edgeX > 0));
  });
  const first = advance(createSession({ ...config, map: 'b-market' }, 0), 2000, () => 0);
  const second = advance(createSession({ ...config, map: 'b-market' }, 0), 2000, () => 0.99);
  assert.equal(first.enemy.lane.id, 'orange');
  assert.equal(second.enemy.lane.id, first.enemy.lane.id);
});
test('visible feet anchor to ground independent of transparent canvas padding', () => {
  const pose = groundedPose({ centerX: 200, floorY: 500, scale: 2 }, { width: 150, height: 146, bounds: { x: 38, y: 32, w: 76, h: 106 } });
  assert.equal(pose.y + (32 + 106) * pose.scale, 500);
  assert.equal(pose.x + 75 * pose.scale, 200);
});
test('transparent sprite pixels and cover-hidden body cannot be shot', () => {
  const data = new Uint8ClampedArray(4 * 4 * 4);
  for (let y = 0; y < 4; y++) for (let x = 1; x < 3; x++) data[(y * 4 + x) * 4 + 3] = 255;
  const frame = { width: 4, height: 4, pixels: data, bounds: { x: 1, y: 0, w: 2, h: 4 }, head: { x: 1, y: 0, w: 2, h: 1 } };
  const pose = { x: 100, y: 100, scale: 10 };
  const clip = { edgeX: 120, reveal: 'right' };
  assert.equal(alphaHit(frame, pose, clip, { x: 115, y: 110 }), null);
  assert.equal(alphaHit(frame, pose, clip, { x: 105, y: 110 }), null);
  assert.equal(alphaHit(frame, pose, clip, { x: 125, y: 105 }), 'head');
  assert.equal(alphaHit(frame, pose, clip, { x: 125, y: 130 }), 'body');
});
test('a partial frame showing legs cannot turn its uppermost opaque pixels into a headshot', () => {
  const data = new Uint8ClampedArray(4 * 10 * 4);
  data[(7 * 4 + 2) * 4 + 3] = 255;
  const frame = { width: 4, height: 10, pixels: data, bounds: { x: 2, y: 7, w: 1, h: 3 }, head: { x: 1, y: 0, w: 2, h: 2 } };
  assert.equal(alphaHit(frame, { x: 0, y: 0, scale: 1 }, { edgeX: 0, reveal: 'right' }, { x: 2, y: 7 }), 'body');
});
test('screen hit coordinates remain aligned under cover crop and viewport changes', () => {
  for (const [width, height] of [[1487, 697], [1920, 1080], [820, 540]]) {
    const t = viewTransform(width, height);
    const world = { x: 955, y: 690 };
    const p = screenToWorld({ x: world.x * t.scale + t.x, y: world.y * t.scale + t.y }, t);
    assert.ok(Math.abs(p.x - world.x) < 0.001);
    assert.ok(Math.abs(p.y - world.y) < 0.001);
  }
});
