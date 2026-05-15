// Extra training sound effects layered on top of src/lib/sounds.ts.
let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}
function tone(freq: number, dur = 0.12, type: OscillatorType = "sine", gain = 0.18) {
  const c = getCtx(); if (!c) return;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(gain, c.currentTime + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start(); o.stop(c.currentTime + dur + 0.02);
}

export const tsfx = {
  star: () => tone(1200, 0.18, "triangle", 0.18),
  levelComplete: () => {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, "triangle", 0.2), i * 110));
  },
  wrong: () => { tone(180, 0.18, "square", 0.2); setTimeout(() => tone(120, 0.2, "square", 0.18), 100); },
  bossDefeated: () => {
    [392, 523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.25, "sawtooth", 0.18), i * 130));
  },
  coin: () => tone(880, 0.06, "square", 0.12),
};
