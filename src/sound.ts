/** Sons curtos sintetizados com WebAudio (sem arquivos externos). */
let ctx: AudioContext | null = null;
let enabled = readEnabled();

function readEnabled(): boolean {
  try { return localStorage.getItem('pt-sound') !== 'off'; } catch { return true; }
}

export function isSoundOn() { return enabled; }
export function setSoundOn(on: boolean) {
  enabled = on;
  try { localStorage.setItem('pt-sound', on ? 'on' : 'off'); } catch { /* ignora */ }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.15) {
  if (!enabled) return;
  try {
    ctx ??= new AudioContext();
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch { /* sem áudio */ }
}

export const sfx = {
  step: () => tone(660, 0, 0.08, 'triangle', 0.1),
  tick: () => tone(1200, 0, 0.04, 'square', 0.05),
  click: () => tone(500, 0, 0.06, 'triangle', 0.08),
  reveal: () => { tone(520, 0, 0.1); tone(780, 0.08, 0.15); },
  correct: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.2, 'triangle')); },
  wrong: () => { tone(220, 0, 0.25, 'sawtooth', 0.08); tone(165, 0.18, 0.3, 'sawtooth', 0.08); },
  special: () => { [880, 660, 990].forEach((f, i) => tone(f, i * 0.1, 0.15, 'square', 0.06)); },
  win: () => { [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.14, 0.3, 'triangle', 0.15)); },
};
