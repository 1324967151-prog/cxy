import { parseGIF, decompressFrames } from 'gifuct-js';
import { AGENT_IDS, WEAPONS } from './config.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`无法加载素材：${src}`));
    image.src = src;
  });
}
function boundsOf(pixels, width, height) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (pixels[(y * width + x) * 4 + 3] > 100) {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
async function loadGif(src, allowedRange, meta) {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`无法加载人物：${src}`);
  const gif = parseGIF(await response.arrayBuffer());
  const decoded = decompressFrames(gif, true);
  const canvas = document.createElement('canvas');
  canvas.width = gif.lsd.width; canvas.height = gif.lsd.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const patchCanvas = document.createElement('canvas');
  const patchCtx = patchCanvas.getContext('2d');
  let previous = null, restore = null;
  const frames = [];
  for (let index = 0; index < decoded.length; index++) {
    const frame = decoded[index];
    if (previous?.disposalType === 2) ctx.clearRect(previous.dims.left, previous.dims.top, previous.dims.width, previous.dims.height);
    if (previous?.disposalType === 3 && restore) ctx.putImageData(restore, 0, 0);
    if (frame.disposalType === 3) restore = ctx.getImageData(0, 0, canvas.width, canvas.height);
    patchCanvas.width = frame.dims.width; patchCanvas.height = frame.dims.height;
    patchCtx.putImageData(new ImageData(frame.patch, frame.dims.width, frame.dims.height), 0, 0);
    ctx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const bounds = boundsOf(pixels, canvas.width, canvas.height);
    if ((!allowedRange || (index >= allowedRange[0] && index <= allowedRange[1])) && bounds.h > 45 && bounds.w > 4) {
      const copy = document.createElement('canvas');
      copy.width = canvas.width; copy.height = canvas.height;
      copy.getContext('2d').drawImage(canvas, 0, 0);
      frames.push({ canvas: copy, pixels, bounds, width: canvas.width, height: canvas.height, delay: Math.max(20, frame.delay),
        head: { x: meta.hitbox.x - 4, y: meta.hitbox.y, w: meta.hitbox.w + 8, h: Math.min(24, meta.hitbox.h * 0.22) } });
    }
    previous = frame;
  }
  if (!frames.length) throw new Error(`人物动画为空：${src}`);
  // Entrance/exit GIF frames can contain only legs. Keep full-body walking frames;
  // map-specific cover, rather than source-canvas clipping, controls the reveal.
  const fullHeight = Math.max(...frames.map(f => f.bounds.h));
  const walking = frames.filter(f => f.bounds.h >= fullHeight * 0.85);
  return { frames: walking, duration: walking.reduce((total, f) => total + f.delay, 0) };
}
let assetsPromise;
export function loadAssets() {
  if (!assetsPromise) assetsPromise = (async () => {
    const response = await fetch('/assets/enemy-catalog.json');
    if (!response.ok) throw new Error('无法加载人物配置');
    const catalog = (await response.json()).enemies;
    const [maps, weapons, agents] = await Promise.all([
      loadImage('/assets/maps.png'),
      Promise.all(Object.entries(WEAPONS).map(async ([id, w]) => [id, await loadImage(w.held)])),
      Promise.all(AGENT_IDS.map(async id => {
        const meta = catalog.find(a => a.id === id);
        const [left, right] = await Promise.all([
          loadGif(`/assets/enemies/${id}-left.gif`, meta.frameRangeLeft, meta),
          loadGif(`/assets/enemies/${id}-right.gif`, meta.frameRangeRight, meta),
        ]);
        return [id, { ...meta, left, right }];
      })),
    ]);
    return { maps, weapons: Object.fromEntries(weapons), agents: Object.fromEntries(agents) };
  })().catch(error => { assetsPromise = null; throw error; });
  return assetsPromise;
}
export function animationFrame(animation, elapsed) {
  let time = Math.max(0, elapsed) % animation.duration;
  for (const frame of animation.frames) {
    if (time < frame.delay) return frame;
    time -= frame.delay;
  }
  return animation.frames.at(-1);
}
