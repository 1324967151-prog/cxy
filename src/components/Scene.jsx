import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { MAPS, WEAPONS } from '../game/config.js';
import { advance, resolveShot } from '../game/engine.js';
import { animationFrame } from '../game/assets.js';
import { alphaHit, enemyPose, screenToWorld, viewTransform } from '../game/geometry.js';
import { sounds } from '../game/audio.js';

function crosshair(ctx, x, y, settings) {
  const { crosshairSize: length, crosshairGap: gap, crosshairColor: color } = settings;
  ctx.strokeStyle = '#07171c'; ctx.lineWidth = 4;
  const lines = () => {
    ctx.beginPath(); ctx.moveTo(x - gap - length, y); ctx.lineTo(x - gap, y);
    ctx.moveTo(x + gap, y); ctx.lineTo(x + gap + length, y);
    ctx.moveTo(x, y - gap - length); ctx.lineTo(x, y - gap);
    ctx.moveTo(x, y + gap); ctx.lineTo(x, y + gap + length); ctx.stroke();
  };
  lines(); ctx.strokeStyle = color; ctx.lineWidth = 2; lines();
}
export const Scene = forwardRef(function Scene(props, ref) {
  const canvasRef = useRef(null);
  const latest = useRef(props); latest.current = props;
  const aim = useRef({ x: null, y: null });
  const feedback = useRef(null);
  const geometry = useRef(null);
  const shotAt = useRef(-Infinity);
  const lastUI = useRef(0);
  useImperativeHandle(ref, () => ({
    resetAim() { aim.current = { x: null, y: null }; feedback.current = null; shotAt.current = -Infinity; },
    async lock() {
      if (!latest.current.settings.pointerLock || document.pointerLockElement === canvasRef.current) return true;
      try { await canvasRef.current.requestPointerLock(); return true; } catch { return false; }
    },
    focus() { canvasRef.current.focus(); },
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let width = 0, height = 0, raf;
    const resize = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width; height = entry.contentRect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    });
    resize.observe(canvas);
    function draw(now) {
      const p = latest.current;
      if (!width || !height) { raf = requestAnimationFrame(draw); return; }
      const dpr = canvas.width / width;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
      if (!p.assets) { raf = requestAnimationFrame(draw); return; }
      const s = p.sessionRef.current;
      if (s?.status === 'running') {
        const next = advance(s, now);
        if (next !== s) { p.sessionRef.current = next; p.onUpdate(next); }
        else if (now - lastUI.current > 100) { p.onUpdate(s); lastUI.current = now; }
      }
      const session = p.sessionRef.current;
      const map = MAPS.find(m => m.id === p.config.map);
      const transform = viewTransform(width, height);
      ctx.save(); ctx.translate(transform.x, transform.y); ctx.scale(transform.scale, transform.scale);
      const sourceHeight = p.assets.maps.height / 3;
      ctx.drawImage(p.assets.maps, 0, map.index * sourceHeight, p.assets.maps.width, sourceHeight, 0, 0, 1920, 1080);
      // The idle preview uses ONE grounded agent at the first approved cover.
      const enemy = session?.enemy ?? (p.phase === 'idle' ? { agent: 'jett', lane: map.lanes[0], direction: map.lanes[0].reveal, spawnAt: now - 250, peekMs: 500 } : null);
      geometry.current = null;
      if (enemy) {
        const meta = p.assets.agents[enemy.agent];
        const animation = meta[enemy.direction];
        const animationNow = session?.status === 'paused' ? session.pausedAt : now;
        const frame = p.phase === 'idle' ? animation.frames[Math.floor(animation.frames.length / 2)] : animationFrame(animation, (animationNow - enemy.spawnAt) * meta.speed);
        const pose = enemyPose(enemy, frame, meta, animationNow);
        ctx.save(); ctx.beginPath();
        if (enemy.lane.reveal === 'left') ctx.rect(0, 0, enemy.lane.edgeX, 1080);
        else ctx.rect(enemy.lane.edgeX, 0, 1920 - enemy.lane.edgeX, 1080);
        ctx.clip(); ctx.drawImage(frame.canvas, pose.x, pose.y, frame.width * pose.scale, frame.height * pose.scale); ctx.restore();
        geometry.current = { frame, pose, clip: enemy.lane, transform };
      }
      ctx.restore();
      const a = aim.current;
      const x = a.x ?? width / 2, y = a.y ?? height / 2;
      if (!['paused', 'ended'].includes(p.phase)) crosshair(ctx, x, y, p.settings);
      const f = feedback.current;
      if (f && now - f.at < 420) {
        ctx.globalAlpha = 1 - (now - f.at) / 420;
        ctx.strokeStyle = f.type === 'head' ? '#fbd174' : f.type === 'body' ? '#00eee5' : '#ff655b';
        ctx.lineWidth = 2; ctx.beginPath();
        for (const [dx, dy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
          ctx.moveTo(f.x + dx * 8, f.y + dy * 8); ctx.lineTo(f.x + dx * 15, f.y + dy * 15);
        }
        ctx.stroke(); ctx.font = '600 18px "Microsoft YaHei", sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = ctx.strokeStyle; ctx.fillText(f.type === 'head' ? '爆头 +200' : f.type === 'body' ? '命中 +100' : '未命中', f.x, f.y - 26);
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    function move(event) {
      const p = latest.current;
      if (!['running', 'countdown'].includes(p.phase)) return;
      if (document.pointerLockElement === canvas) {
        aim.current = { x: Math.min(width - 10, Math.max(10, (aim.current.x ?? width / 2) + event.movementX * p.settings.sensitivity)),
          y: Math.min(height - 10, Math.max(10, (aim.current.y ?? height / 2) + event.movementY * p.settings.sensitivity)) };
      } else if (event.target === canvas) {
        const rect = canvas.getBoundingClientRect();
        aim.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      }
    }
    function shoot(event) {
      const p = latest.current;
      const s = p.sessionRef.current;
      if (event.button !== 0 || s?.status !== 'running' || p.phase !== 'running') return;
      if (event.target !== canvas && document.pointerLockElement !== canvas) return;
      event.preventDefault();
      const now = performance.now();
      const weapon = WEAPONS[p.config.weapon];
      if (now - shotAt.current < weapon.cooldown) return;
      shotAt.current = now;
      const rect = canvas.getBoundingClientRect();
      const point = document.pointerLockElement === canvas ? { x: aim.current.x ?? width / 2, y: aim.current.y ?? height / 2 } : { x: event.clientX - rect.left, y: event.clientY - rect.top };
      aim.current = point;
      // Recompute at the shot timestamp so moving sprites and input use identical geometry.
      const enemy = s.enemy;
      let hit = null;
      if (enemy) {
        const meta = p.assets.agents[enemy.agent];
        const frame = animationFrame(meta[enemy.direction], (now - enemy.spawnAt) * meta.speed);
        const pose = enemyPose(enemy, frame, meta, now);
        hit = alphaHit(frame, pose, enemy.lane, screenToWorld(point, viewTransform(width, height)));
      }
      const next = resolveShot(s, hit, now);
      p.sessionRef.current = next; feedback.current = { ...point, at: now, type: next.hits > s.hits ? hit : 'miss' };
      if (p.settings.sound) { sounds.shot(weapon); if (next.hits > s.hits) sounds.hit(hit === 'head'); }
      p.onShot(now); p.onUpdate(next);
    }
    document.addEventListener('mousemove', move);
    document.addEventListener('mousedown', shoot);
    return () => { cancelAnimationFrame(raf); resize.disconnect(); document.removeEventListener('mousemove', move); document.removeEventListener('mousedown', shoot); };
  }, []);
  const visibleEnemy = props.sessionRef.current?.enemy;
  const enemyReady = visibleEnemy && performance.now() - visibleEnemy.spawnAt >= visibleEnemy.peekMs;
  return <canvas ref={canvasRef} className="game-canvas" aria-label="架枪训练画面" data-enemy-count={props.phase === 'idle' ? 1 : visibleEnemy ? 1 : 0} data-enemy-lane={visibleEnemy?.lane.name ?? ''} data-target-visible={Boolean(enemyReady)} tabIndex={0} />;
});
