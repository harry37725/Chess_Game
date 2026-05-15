// Lightweight Web Audio sound effects + ambient music — no asset files needed.
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

function blip(freq: number, duration = 0.12, type: OscillatorType = "triangle", gain = 0.18) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(gain, c.currentTime + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
  osc.connect(g).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration + 0.02);
}

export const sfx = {
  move: () => blip(440, 0.09, "triangle", 0.15),
  capture: () => { blip(220, 0.12, "square", 0.18); setTimeout(() => blip(160, 0.12, "square", 0.14), 60); },
  check: () => { blip(880, 0.1, "sawtooth", 0.16); setTimeout(() => blip(660, 0.12, "sawtooth", 0.14), 90); },
  end: () => { blip(523, 0.18, "sine", 0.2); setTimeout(() => blip(659, 0.18, "sine", 0.2), 150); setTimeout(() => blip(784, 0.28, "sine", 0.22), 320); },
  chat: () => blip(720, 0.06, "sine", 0.1),
};

// Ambient music: soft chord pad that fades in/out.
let musicNodes: { osc: OscillatorNode; g: GainNode }[] | null = null;
let masterGain: GainNode | null = null;

export function startMusic() {
  const c = getCtx();
  if (!c || musicNodes) return;
  masterGain = c.createGain();
  masterGain.gain.value = 0;
  masterGain.connect(c.destination);
  // A minor 9th-ish gentle pad
  const freqs = [220, 261.63, 329.63, 392, 493.88];
  musicNodes = freqs.map((f, i) => {
    const osc = c.createOscillator();
    osc.type = i === 0 ? "sine" : "triangle";
    osc.frequency.value = f;
    const g = c.createGain();
    g.gain.value = 0.05;
    // Slow LFO for shimmer
    const lfo = c.createOscillator();
    const lfoG = c.createGain();
    lfo.frequency.value = 0.1 + i * 0.07;
    lfoG.gain.value = 0.02;
    lfo.connect(lfoG).connect(g.gain);
    lfo.start();
    osc.connect(g).connect(masterGain!);
    osc.start();
    return { osc, g };
  });
  masterGain.gain.linearRampToValueAtTime(0.08, c.currentTime + 1.2);
}

export function stopMusic() {
  const c = getCtx();
  if (!c || !musicNodes || !masterGain) return;
  const mg = masterGain;
  const nodes = musicNodes;
  mg.gain.cancelScheduledValues(c.currentTime);
  mg.gain.linearRampToValueAtTime(0, c.currentTime + 0.6);
  setTimeout(() => {
    nodes.forEach(({ osc }) => { try { osc.stop(); } catch {} });
    try { mg.disconnect(); } catch {}
  }, 800);
  musicNodes = null;
  masterGain = null;
}

export function isMusicOn() { return !!musicNodes; }
