import { useCallback, useEffect, useRef, useState } from 'react';
import { IconPlayerPlayFilled, IconMaximize, IconMinimize, IconCrosshair, IconAlertTriangle, IconMouse, IconSettings, IconChevronRight, IconPlayerPause, IconArrowLeft, IconRefresh, IconTrophy, IconTarget, IconClock, IconX } from '@tabler/icons-react';
import { MAPS, WEAPONS, DIFFICULTIES } from './game/config.js';
import { createSession, endSession, pauseSession, resumeSession, remainingMs } from './game/engine.js';
import { loadAssets } from './game/assets.js';
import { loadPreferences, savePreferences, loadBest, recordBest } from './game/storage.js';
import { unlockAudio, sounds } from './game/audio.js';
import { createActionGate } from './game/actions.js';
import { Scene } from './components/Scene.jsx';
import { Settings } from './components/Settings.jsx';

function formatTime(ms) {
  const seconds = Math.ceil(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
function MapThumb({ map }) { return <span className="map-thumb" style={{ backgroundPosition: `center ${map.position}` }} />; }
function Stat({ icon: Icon, value, label }) { return <div className="result-stat"><Icon size={20} /><strong>{value}</strong><span>{label}</span></div>; }
export function App() {
  const [preferences] = useState(loadPreferences);
  const [config, setConfig] = useState(preferences.config);
  const [settings, setSettings] = useState(preferences.settings);
  const [assets, setAssets] = useState(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('idle');
  const [countdown, setCountdown] = useState(3);
  const [view, setView] = useState({ session: null, now: 0 });
  const [settingsTab, setSettingsTab] = useState(null);
  const [best, setBest] = useState(() => loadBest(config));
  const [recoil, setRecoil] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [inputNotice, setInputNotice] = useState('');
  const sessionRef = useRef(null);
  const scene = useRef(null);
  const ended = useRef(null);
  const recoilTimer = useRef(null);
  const actionGate = useRef(null);
  actionGate.current ??= createActionGate();
  const resumeBusy = useRef(false);
  const current = useRef({ phase, settings }); current.current = { phase, settings };
  const map = MAPS.find(m => m.id === config.map);
  const weapon = WEAPONS[config.weapon];
  const difficulty = DIFFICULTIES[config.difficulty];
  const active = phase !== 'idle';
  const time = view.session ? remainingMs(view.session, view.now) : config.duration * 1000;
  const boot = useCallback(() => {
    setError(''); loadAssets().then(setAssets).catch(e => setError(e.message));
  }, []);
  useEffect(() => { boot(); }, [boot]);
  useEffect(() => { savePreferences(config, settings); setBest(loadBest(config)); }, [config, settings]);
  const update = useCallback(next => {
    setView({ session: next, now: performance.now() });
    if (next.status === 'ended' && ended.current !== next.startedAt) {
      ended.current = next.startedAt; setPhase('ended'); document.exitPointerLock?.();
      setBest(recordBest(next.config, next.score));
      if (current.current.settings.sound && next.reason !== 'complete' && next.reason !== 'stopped') sounds.fail();
    }
  }, []);
  const pause = useCallback(() => {
    actionGate.current.cancel();
    if (current.current.phase === 'countdown') {
      setPhase('paused'); document.exitPointerLock?.(); return;
    }
    const s = sessionRef.current;
    if (s?.status !== 'running') return;
    const next = pauseSession(s, performance.now()); sessionRef.current = next; update(next);
    if (next.status === 'paused') setPhase('paused'); document.exitPointerLock?.();
  }, [update]);
  useEffect(() => {
    const keydown = e => { if (e.key === 'Escape' && ['running', 'countdown'].includes(current.current.phase)) pause(); };
    const visibility = () => { if (document.hidden) pause(); };
    const blur = () => pause();
    const lockChange = () => { if (!document.pointerLockElement && ['running', 'countdown'].includes(current.current.phase) && current.current.settings.pointerLock) pause(); };
    document.addEventListener('keydown', keydown); document.addEventListener('visibilitychange', visibility);
    document.addEventListener('pointerlockchange', lockChange); window.addEventListener('blur', blur);
    const fsChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', fsChange);
    return () => {
      document.removeEventListener('keydown', keydown); document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('pointerlockchange', lockChange); window.removeEventListener('blur', blur);
      document.removeEventListener('fullscreenchange', fsChange); clearTimeout(recoilTimer.current);
    };
  }, [pause]);
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (settings.sound) sounds.tick();
    const timer = setTimeout(() => {
      if (countdown > 1) setCountdown(countdown - 1);
      else {
        const s = createSession(config, performance.now()); sessionRef.current = s;
        update(s); setPhase('running'); scene.current?.focus();
      }
    }, 850);
    return () => clearTimeout(timer);
  }, [phase, countdown, config, settings.sound, update]);
  async function lockInput() {
    const locked = await scene.current.lock();
    if (!locked) setInputNotice('鼠标锁定暂不可用，直接移动鼠标瞄准即可。');
  }
  async function start() {
    if (!assets) return;
    actionGate.current.cancel();
    unlockAudio(); ended.current = null; sessionRef.current = null;
    setView({ session: null, now: 0 }); scene.current.resetAim(); setCountdown(3); setPhase('countdown');
    setInputNotice(''); await lockInput();
  }
  async function resume() {
    if (resumeBusy.current) return;
    resumeBusy.current = true;
    const paused = sessionRef.current;
    try {
      const applied = await actionGate.current.run(
        async () => { unlockAudio(); await lockInput(); },
        () => current.current.phase === 'paused' && sessionRef.current === paused && !document.hidden && document.hasFocus(),
        () => {
          if (!paused) { setCountdown(3); setPhase('countdown'); return; }
          const next = resumeSession(paused, performance.now()); sessionRef.current = next;
          update(next); setPhase('running'); scene.current.focus();
        },
      );
      if (!applied && !['running', 'countdown'].includes(current.current.phase)) document.exitPointerLock?.();
    } finally { resumeBusy.current = false; }
  }
  function leave() {
    actionGate.current.cancel();
    document.exitPointerLock?.(); sessionRef.current = null; ended.current = null;
    setView({ session: null, now: 0 }); setPhase('idle'); setInputNotice(''); scene.current.resetAim();
  }
  function stop() {
    actionGate.current.cancel();
    const next = endSession(sessionRef.current, 'stopped', performance.now()); sessionRef.current = next; update(next);
  }
  function shot() {
    clearTimeout(recoilTimer.current); setRecoil(true); recoilTimer.current = setTimeout(() => setRecoil(false), 90);
  }
  async function toggleFullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { setInputNotice('当前浏览器不支持全屏，可以最大化预览窗口训练。'); }
  }
  const result = view.session;
  const resultTitles = { miss: '这一枪，差了一点', timeout: '敌人先出手了', complete: '本轮训练完成', stopped: '训练已结束' };
  const resultCopy = { miss: '空枪，本局结束。稳住准星，再来一轮。', timeout: '没有在命中窗口内击中敌人，本局结束。', complete: '守住每一个角度，把节奏带进下一局。', stopped: '本轮得分已保存，你可以调整后再出发。' };
  return <main className={`app ${active ? 'is-active' : ''}`} data-phase={phase}>
    <section className="hero" aria-label="训练场">
      <Scene ref={scene} assets={assets} config={config} settings={settings} phase={phase} sessionRef={sessionRef} onUpdate={update} onShot={shot} />
      <img className={`weapon-held ${recoil ? 'recoil' : ''}`} src={weapon.held} alt="" draggable="false" />
      <header className="scene-header">
        <div className="brand"><img src="/assets/hold-mark.svg" alt="" /><div><h1>HOLD / 架枪训练</h1><p>{map.name}</p></div></div>
        <div className={`scoreboard ${time < 10000 && active ? 'time-low' : ''}`} aria-label="训练分数与时间">
          <div><span>分数</span><strong data-testid="score">{String(view.session?.score ?? 0).padStart(4, '0')}</strong></div>
          <div><span>剩余时间</span><strong data-testid="timer">{formatTime(time)}</strong></div>
        </div>
        <div className="header-actions">
          {phase === 'idle' ? <button className="crosshair-button" onClick={() => setSettingsTab('crosshair')}><IconCrosshair size={26} />准星设置</button> : phase === 'running' ? <button className="crosshair-button" onClick={pause}><IconPlayerPause size={21} />暂停</button> : null}
          <button className="fullscreen-button" aria-label={fullscreen ? '退出全屏' : '全屏训练'} onClick={toggleFullscreen}>{fullscreen ? <IconMinimize /> : <IconMaximize />}</button>
        </div>
      </header>
      {phase === 'idle' ? <div className="hero-copy"><h2>预瞄到位，下一枪更快</h2><p>守住掩体边缘，等敌人探身。</p><span className="accent-line" /></div> : null}
      {phase === 'running' ? <div className="live-footer"><span><IconTarget size={17} />{difficulty.name} · {weapon.name}</span><span>左键射击 · ESC 暂停</span><span>{view.session?.hits ?? 0} 命中</span></div> : null}
      {inputNotice ? <div className="input-notice" role="status">{inputNotice}<button aria-label="关闭提示" onClick={() => setInputNotice('')}><IconX size={14} /></button></div> : null}
      {phase === 'countdown' ? <div className="countdown-overlay" aria-live="polite"><strong>{countdown}</strong><p>守住角度，准备开始</p><button className="subtle-button" onClick={leave}>取消训练</button></div> : null}
      {phase === 'paused' ? <div className="state-overlay"><section className="state-card" aria-label="训练暂停"><IconPlayerPause size={30} className="state-icon" /><h2>训练已暂停</h2><p>时间与敌人已冻结，准备好再继续。</p><button className="primary-button" onClick={resume}><IconPlayerPlayFilled size={19} />继续训练</button><button className="secondary-button" onClick={sessionRef.current ? stop : leave}>{sessionRef.current ? '结束本轮' : '返回调整'}</button><button className="subtle-button" onClick={() => setSettingsTab('sensitivity')}>调整灵敏度与准星</button></section></div> : null}
      {phase === 'ended' && result ? <div className="state-overlay"><section className={`state-card result-card ${result.reason === 'complete' ? 'success' : ''}`} aria-label="训练结果">
        {result.reason === 'complete' ? <IconTrophy size={32} className="state-icon" /> : <IconTarget size={32} className="state-icon" />}
        <p className="result-context">{map.name} / {difficulty.name} / {weapon.name}</p><h2>{resultTitles[result.reason]}</h2><p>{resultCopy[result.reason]}</p>
        <div className="result-score"><span>本轮得分</span><strong>{result.score}</strong><small>当前配置最高分 {best}</small></div>
        <div className="result-stats"><Stat icon={IconTarget} value={result.hits} label="击中目标" /><Stat icon={IconCrosshair} value={`${result.hits ? Math.round(result.headshots / result.hits * 100) : 0}%`} label="爆头率" /><Stat icon={IconClock} value={result.reactions.length ? `${Math.round(result.reactions.reduce((a, b) => a + b, 0) / result.reactions.length)} ms` : '—'} label="平均反应" /></div>
        <button className="primary-button" onClick={start}><IconRefresh size={20} />再来一轮</button><button className="secondary-button" onClick={leave}><IconArrowLeft size={18} />返回调整</button>
      </section></div> : null}
    </section>
    {!active ? <section className="control-panel" aria-label="训练配置">
      <div className="map-selector"><h3>地图</h3><div className="map-options">{MAPS.map(m => <button key={m.id} className={`map-card ${config.map === m.id ? 'selected' : ''}`} aria-pressed={config.map === m.id} onClick={() => setConfig({ ...config, map: m.id })}><MapThumb map={m} /><span>{m.name}</span></button>)}</div>{best > 0 ? <span className="best-note"><IconTrophy size={16} />最高分 {best}</span> : null}</div>
      <div className="configuration-row">
        <div className="weapon-group"><h3>枪械</h3><div className="weapon-options">{Object.entries(WEAPONS).map(([id, w]) => <button key={id} className={`weapon-card ${config.weapon === id ? 'selected' : ''}`} aria-pressed={config.weapon === id} onClick={() => setConfig({ ...config, weapon: id })}><img src={`/assets/weapons/${id}.png`} alt="" /><span>{w.name}</span></button>)}</div></div>
        <div className="difficulty-group"><h3>难度</h3><div className="difficulty-options">{Object.entries(DIFFICULTIES).map(([id, d]) => <button key={id} className={config.difficulty === id ? 'selected' : ''} aria-pressed={config.difficulty === id} onClick={() => setConfig({ ...config, difficulty: id })}>{d.name}</button>)}</div><p>出敌间隔 {(difficulty.interval[0] / 1000).toFixed(config.difficulty === 'hard' ? 2 : 1)} - {(difficulty.interval[1] / 1000).toFixed(config.difficulty === 'hard' ? 2 : 1)} 秒 · 命中窗口 {(difficulty.windowMs / 1000).toFixed(1)} 秒</p></div>
        <div className="start-group"><div className="duration-options"><h3>时长</h3>{[30, 60, 120].map(duration => <button key={duration} className={config.duration === duration ? 'selected' : ''} aria-pressed={config.duration === duration} onClick={() => setConfig({ ...config, duration })}>{duration} 秒</button>)}</div><button className="primary-button start-button" onClick={error ? boot : start} disabled={!assets && !error}><IconPlayerPlayFilled size={25} />{error ? '重新加载素材' : assets ? '开始训练' : '准备训练场…'}</button>{error ? <p className="asset-error" role="alert">{error}</p> : null}</div>
      </div>
      <footer className="instructions"><p className="failure-rule"><IconAlertTriangle size={27} />空枪或漏敌，本局结束。</p><span className="instruction-divider" /><p className="mouse-rule"><IconMouse size={29} />鼠标移动瞄准 · 左键射击 · ESC 暂停</p><button className="sensitivity-button" onClick={() => setSettingsTab('sensitivity')}><IconSettings size={25} />灵敏度<IconChevronRight size={21} /></button></footer>
    </section> : null}
    {settingsTab ? <Settings initialTab={settingsTab} settings={settings} onChange={setSettings} onClose={() => setSettingsTab(null)} /> : null}
  </main>;
}
