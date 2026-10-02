import { useEffect, useRef, useState } from 'react';
import { IconX, IconCrosshair, IconAdjustmentsHorizontal, IconVolume } from '@tabler/icons-react';

function Preview({ settings }) {
  const ref = useRef(null);
  useEffect(() => {
    const ctx = ref.current.getContext('2d');
    ctx.clearRect(0, 0, 240, 100);
    const gap = settings.crosshairGap, size = settings.crosshairSize;
    ctx.strokeStyle = settings.crosshairColor; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(120 - gap - size, 50); ctx.lineTo(120 - gap, 50);
    ctx.moveTo(120 + gap, 50); ctx.lineTo(120 + gap + size, 50);
    ctx.moveTo(120, 50 - gap - size); ctx.lineTo(120, 50 - gap);
    ctx.moveTo(120, 50 + gap); ctx.lineTo(120, 50 + gap + size); ctx.stroke();
  }, [settings]);
  return <canvas ref={ref} width="240" height="100" aria-label="准星预览" className="crosshair-preview" />;
}
export function Settings({ initialTab, settings, onChange, onClose }) {
  const dialog = useRef(null);
  const [tab, setTab] = useState(initialTab);
  useEffect(() => { dialog.current.showModal(); return () => dialog.current?.close(); }, []);
  const update = (key, value) => onChange({ ...settings, [key]: value });
  return <dialog ref={dialog} className="settings-dialog" onCancel={onClose} onClick={e => { if (e.target === dialog.current) onClose(); }}>
    <div className="dialog-heading"><div><p className="small-label">按你的习惯训练</p><h2>训练设置</h2></div><button className="icon-button" aria-label="关闭设置" onClick={onClose}><IconX /></button></div>
    <div className="settings-tabs" role="tablist" aria-label="设置分类">
      <button role="tab" aria-selected={tab === 'crosshair'} onClick={() => setTab('crosshair')}><IconCrosshair size={18} />准星</button>
      <button role="tab" aria-selected={tab === 'sensitivity'} onClick={() => setTab('sensitivity')}><IconAdjustmentsHorizontal size={18} />灵敏度与声音</button>
    </div>
    {tab === 'crosshair' ? <div className="settings-body" role="tabpanel">
      <Preview settings={settings} />
      <label className="range-label" htmlFor="crosshair-size">线条长度 <output>{settings.crosshairSize}</output></label>
      <input id="crosshair-size" type="range" min="2" max="12" value={settings.crosshairSize} onChange={e => update('crosshairSize', +e.target.value)} />
      <label className="range-label" htmlFor="crosshair-gap">中心间隙 <output>{settings.crosshairGap}</output></label>
      <input id="crosshair-gap" type="range" min="1" max="10" value={settings.crosshairGap} onChange={e => update('crosshairGap', +e.target.value)} />
      <label className="color-field">准星颜色<input aria-label="准星颜色" type="color" value={settings.crosshairColor} onChange={e => update('crosshairColor', e.target.value)} /></label>
    </div> : <div className="settings-body" role="tabpanel">
      <label className="range-label" htmlFor="sensitivity">鼠标灵敏度 <output>{settings.sensitivity.toFixed(2)} ×</output></label>
      <input id="sensitivity" type="range" min="0.2" max="3" step="0.05" value={settings.sensitivity} onChange={e => update('sensitivity', +e.target.value)} />
      <p className="setting-help">锁定鼠标时生效。1.00 × 为默认移动速度。</p>
      <label className="switch-row"><span><IconCrosshair size={20} />锁定鼠标<small>无限移动，按 ESC 暂停并释放</small></span><input type="checkbox" checked={settings.pointerLock} onChange={e => update('pointerLock', e.target.checked)} /></label>
      <label className="switch-row"><span><IconVolume size={20} />射击与命中音效<small>用声音感知每一次命中</small></span><input type="checkbox" checked={settings.sound} onChange={e => update('sound', e.target.checked)} /></label>
    </div>}
    <button className="primary-button save-settings" onClick={onClose}>完成设置</button>
  </dialog>;
}
