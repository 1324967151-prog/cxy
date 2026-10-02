export const WORLD = { width: 1920, height: 1080 };
export const DIFFICULTIES = {
  easy: { name: '简单', interval: [1600, 2200], peekMs: 500, windowMs: 1200 },
  standard: { name: '标准', interval: [1000, 1500], peekMs: 350, windowMs: 800 },
  hard: { name: '困难', interval: [650, 950], peekMs: 230, windowMs: 500 },
  nightmare: { name: '噩梦', interval: [400, 600], peekMs: 150, windowMs: 300 },
};
export const MAPS = [
  { id: 'c-corner', name: 'C 拐角', index: 0, position: 'top', lanes: [
    { id: 'pillar', name: '远处石柱', edgeX: 969, floorY: 687, reveal: 'left', depth: 1.0 },
  ] },
  { id: 'b-market', name: 'B 区市场', index: 1, position: 'center', lanes: [
    { id: 'orange', name: '左侧橙墙', edgeX: 935, floorY: 690, reveal: 'right', depth: 1.0 },
  ] },
  { id: 'b-cover', name: 'B 点掩体', index: 2, position: 'bottom', lanes: [
    { id: 'box', name: '左侧箱体', edgeX: 736, floorY: 628, reveal: 'right', depth: 0.95 },
  ] },
];
export const WEAPONS = {
  sheriff: { name: '正义', label: 'SHERIFF', cooldown: 400, magazine: 6, pitch: 105, held: '/assets/weapons/sheriff-held.png' },
  phantom: { name: '幻影', label: 'PHANTOM', cooldown: 100, magazine: 30, pitch: 170, held: '/assets/weapons/phantom-held.png' },
  vandal: { name: '狂徒', label: 'VANDAL', cooldown: 110, magazine: 25, pitch: 130, held: '/assets/weapons/vandal-held.png' },
};
export const DEFAULT_CONFIG = { map: 'c-corner', weapon: 'vandal', difficulty: 'standard', duration: 60 };
export const DEFAULT_SETTINGS = { sensitivity: 1, crosshairSize: 5, crosshairGap: 4, crosshairColor: '#00eee5', sound: true, pointerLock: true };
export const AGENT_IDS = ['jett', 'sage', 'chamber', 'cypher'];
export const AGENT_NAMES = { jett: '捷风', sage: '贤者', chamber: '尚勃勒', cypher: '零' };
