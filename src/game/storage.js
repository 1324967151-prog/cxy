import { DEFAULT_CONFIG, DEFAULT_SETTINGS, MAPS, WEAPONS, DIFFICULTIES } from './config.js';
const memory = new Map();
function read(key) { if (memory.has(key)) return memory.get(key); try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function write(key, value) { memory.set(key, value); try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Preserve page-lifetime preferences and bests in memory. */ } }
export function loadPreferences() {
  const saved = read('hold:preferences:v1') ?? {};
  const config = { ...DEFAULT_CONFIG };
  if (MAPS.some(m => m.id === saved.config?.map)) config.map = saved.config.map;
  if (Object.hasOwn(WEAPONS, saved.config?.weapon)) config.weapon = saved.config.weapon;
  if (Object.hasOwn(DIFFICULTIES, saved.config?.difficulty)) config.difficulty = saved.config.difficulty;
  if ([30, 60, 120].includes(saved.config?.duration)) config.duration = saved.config.duration;
  const settings = { ...DEFAULT_SETTINGS };
  for (const [key, min, max] of [['sensitivity', 0.2, 3], ['crosshairSize', 2, 12], ['crosshairGap', 1, 10]]) {
    const value = saved.settings?.[key];
    if (Number.isFinite(value)) settings[key] = Math.min(max, Math.max(min, value));
  }
  if (/^#[0-9a-f]{6}$/i.test(saved.settings?.crosshairColor)) settings.crosshairColor = saved.settings.crosshairColor;
  for (const key of ['sound', 'pointerLock']) if (typeof saved.settings?.[key] === 'boolean') settings[key] = saved.settings[key];
  return { config, settings };
}
export function savePreferences(config, settings) { write('hold:preferences:v1', { config, settings }); }
export function bestKey(config) { return [config.map, config.weapon, config.difficulty, config.duration].join(':'); }
export function loadBest(config) { return Number(read('hold:best:v1')?.[bestKey(config)]) || 0; }
export function recordBest(config, score) {
  const bests = read('hold:best:v1') || {};
  const best = Math.max(Number(bests[bestKey(config)]) || 0, score);
  write('hold:best:v1', { ...bests, [bestKey(config)]: best });
  return best;
}
