import { WORLD } from './config.js';

export function viewTransform(width, height) {
  const scale = Math.max(width / WORLD.width, height / WORLD.height);
  return { scale, x: (width - WORLD.width * scale) / 2, y: 0 };
}
export function screenToWorld(point, transform) {
  return { x: (point.x - transform.x) / transform.scale, y: (point.y - transform.y) / transform.scale };
}
export function groundedPose(lanePose, frame) {
  return { x: lanePose.centerX - frame.width * lanePose.scale / 2,
    y: lanePose.floorY - (frame.bounds.y + frame.bounds.h) * lanePose.scale, scale: lanePose.scale };
}
export function enemyPose(enemy, frame, catalog, now) {
  const scale = catalog.scale * enemy.lane.depth;
  const direction = enemy.lane.reveal === 'right' ? 1 : -1;
  const progress = Math.min(1, Math.max(0, (now - enemy.spawnAt) / enemy.peekMs));
  const visibleHalfWidth = frame.bounds.w * scale / 2;
  const centerX = enemy.lane.edgeX + direction * (-visibleHalfWidth - 12 + progress * (visibleHalfWidth * 2 + 27));
  return groundedPose({ centerX, floorY: enemy.lane.floorY, scale }, frame);
}
export function alphaHit(frame, pose, clip, point) {
  if (clip.reveal === 'left' ? point.x >= clip.edgeX : point.x <= clip.edgeX) return null;
  const x = Math.floor((point.x - pose.x) / pose.scale);
  const y = Math.floor((point.y - pose.y) / pose.scale);
  if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) return null;
  if (frame.pixels[(y * frame.width + x) * 4 + 3] < 100) return null;
  const head = frame.head;
  return head && x >= head.x && x < head.x + head.w && y >= head.y && y < head.y + head.h ? 'head' : 'body';
}
