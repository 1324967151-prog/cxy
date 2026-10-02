let context;
export function unlockAudio() {
  try {
    context ??= new (window.AudioContext || window.webkitAudioContext)();
    if (context.state === 'suspended') context.resume().catch(() => {});
  } catch { /* Audio is optional; training remains available. */ }
}
function tone(frequency, duration, volume, type = 'sine', endFrequency = frequency) {
  if (!context || context.state !== 'running') return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, context.currentTime + duration);
  gain.gain.setValueAtTime(volume, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
  oscillator.connect(gain); gain.connect(context.destination);
  oscillator.start(); oscillator.stop(context.currentTime + duration);
}
export const sounds = {
  shot(weapon) { tone(weapon.pitch, 0.09, 0.1, 'triangle', 40); },
  hit(head) { tone(head ? 1200 : 800, 0.13, 0.08, 'sine', head ? 1900 : 1100); },
  fail() { tone(240, 0.3, 0.09, 'triangle', 90); },
  tick() { tone(620, 0.055, 0.04); },
};
