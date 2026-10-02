import { DIFFICULTIES, MAPS, AGENT_IDS } from './config.js';

const between = (range, random) => range[0] + random() * (range[1] - range[0]);
export function createSession(config, now) {
  return { config: { ...config }, status: 'running', score: 0, shots: 0, hits: 0, headshots: 0,
    reactions: [], startedAt: now, endsAt: now + config.duration * 1000,
    nextSpawnAt: now + 900, enemy: null, sequence: 0, lastShotAt: -Infinity,
    pausedAt: null, endedAt: null, reason: null };
}
export function endSession(s, reason, now) {
  return { ...s, status: 'ended', enemy: null, reason, endedAt: s.status === 'paused' ? s.pausedAt : now };
}
export function advance(s, now, random = Math.random) {
  if (!s || s.status !== 'running') return s;
  if (s.enemy && s.enemy.deadline < s.endsAt && now >= s.enemy.deadline) return endSession(s, 'timeout', s.enemy.deadline);
  if (now >= s.endsAt) return endSession(s, 'complete', s.endsAt);
  if (s.enemy) {
    return s;
  }
  if (now < s.nextSpawnAt) return s;
  const difficulty = DIFFICULTIES[s.config.difficulty];
  const map = MAPS.find(m => m.id === s.config.map);
  // Each map has one deliberate peek point. Keep the lane in the map model
  // so geometry and hit testing share the same cover anchor without random
  // alternate angles.
  const lane = map.lanes[0];
  const agent = AGENT_IDS[Math.min(3, Math.floor(random() * 4))];
  return { ...s, sequence: s.sequence + 1, enemy: {
    id: s.sequence + 1, agent, lane, spawnAt: now,
    peekMs: difficulty.peekMs, deadline: now + difficulty.peekMs + difficulty.windowMs,
    direction: lane.reveal === 'right' ? 'right' : 'left',
  } };
}
export function resolveShot(s, hit, now, random = Math.random) {
  if (!s || s.status !== 'running') return s;
  // The deadline always wins, even if a click lands between animation frames.
  const advanced = advance(s, now, random);
  if (advanced.status !== 'running') return advanced;
  const fired = { ...advanced, shots: advanced.shots + 1, lastShotAt: now };
  if (!hit || !advanced.enemy) return endSession(fired, 'miss', now);
  return { ...fired, enemy: null, hits: fired.hits + 1,
    headshots: fired.headshots + (hit === 'head' ? 1 : 0), score: fired.score + (hit === 'head' ? 200 : 100),
    reactions: [...fired.reactions, Math.max(0, now - advanced.enemy.spawnAt)],
    nextSpawnAt: now + between(DIFFICULTIES[s.config.difficulty].interval, random) };
}
export function pauseSession(s, now) {
  if (!s || s.status !== 'running') return s;
  if (now >= s.endsAt || (s.enemy && now >= s.enemy.deadline)) return advance(s, now);
  return { ...s, status: 'paused', pausedAt: now };
}
export function resumeSession(s, now) {
  if (!s || s.status !== 'paused') return s;
  const shift = now - s.pausedAt;
  return { ...s, status: 'running', pausedAt: null, startedAt: s.startedAt + shift,
    endsAt: s.endsAt + shift, nextSpawnAt: s.nextSpawnAt + shift,
    lastShotAt: s.lastShotAt + shift,
    enemy: s.enemy ? { ...s.enemy, spawnAt: s.enemy.spawnAt + shift, deadline: s.enemy.deadline + shift } : null };
}
export function remainingMs(s, now) {
  if (!s) return 0;
  return Math.max(0, s.endsAt - (s.status === 'paused' ? s.pausedAt : s.status === 'ended' ? s.endedAt : now));
}
