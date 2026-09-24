// Kaiju sounds, synthesised with the Web Audio API (no audio files): a roar, footfall thuds, blasts, a charging and
// firing beam, fire and collapsing buildings. Browsers only allow sound after the player interacts with the page, so
// the audio context starts on the first key press or tap. `volume` (0…1) falls off with distance from the camera.
export function createKaijuAudio() {
  let ctx = null, master = null;
  const start = () => {
    if (ctx || typeof AudioContext === 'undefined') return;
    try { ctx = new AudioContext(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); } catch { ctx = null; }
  };
  const unlock = () => { start(); ctx?.resume?.(); };
  addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
  function noise(duration) {
    const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource(); source.buffer = buffer; return source;
  }
  function envelope(node, volume, attack, hold, release) {
    const gain = ctx.createGain(), t = ctx.currentTime; gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + attack); gain.gain.setValueAtTime(Math.max(0.0002, volume), t + attack + hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release); node.connect(gain); gain.connect(master); return attack + hold + release;
  }
  function tone(type, from, to, volume, attack, hold, release) {
    const osc = ctx.createOscillator(); osc.type = type; osc.frequency.setValueAtTime(from, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + attack + hold + release);
    const length = envelope(osc, volume, attack, hold, release); osc.start(); osc.stop(ctx.currentTime + length + 0.05);
  }
  function rumble(volume, cutoff, attack, hold, release) {
    const source = noise(attack + hold + release + 0.1), filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = cutoff;
    source.connect(filter); const length = envelope(filter, volume, attack, hold, release); source.start(); source.stop(ctx.currentTime + length + 0.05);
  }
  const sounds = {
    roar: v => { tone('sawtooth', 140, 55, v * 0.35, 0.15, 1.2, 0.8); tone('square', 90, 40, v * 0.2, 0.2, 1.1, 0.7); rumble(v * 0.5, 700, 0.1, 1.2, 0.8); },
    step: v => { tone('sine', 70, 30, v * 0.9, 0.01, 0.05, 0.5); rumble(v * 0.4, 200, 0.01, 0.05, 0.4); },
    slam: v => { tone('sine', 60, 25, v, 0.01, 0.1, 1.2); rumble(v * 0.9, 400, 0.01, 0.2, 1.4); },
    tail: v => rumble(v * 0.7, 900, 0.05, 0.3, 0.8),
    blast: v => { rumble(v * 0.9, 1200, 0.005, 0.08, 0.9); tone('sine', 90, 30, v * 0.6, 0.005, 0.05, 0.6); },
    collapse: v => { rumble(v * 0.6, 500, 0.05, 0.6, 1.6); },
    charge: v => tone('sine', 200, 900, v * 0.25, 0.1, 1.6, 0.3),
    laser: v => { tone('sawtooth', 900, 700, v * 0.18, 0.02, 1.8, 0.3); tone('sine', 1800, 1500, v * 0.12, 0.02, 1.8, 0.3); rumble(v * 0.4, 3000, 0.02, 1.8, 0.3); },
    fire: v => rumble(v * 0.6, 1600, 0.2, 2.6, 0.6),
    meteors: v => tone('triangle', 400, 120, v * 0.2, 0.05, 0.4, 0.4),
  };
  return {
    play(name, volume = 1) { if (!ctx || volume < 0.02 || ctx.state !== 'running') return; try { sounds[name]?.(Math.min(1, volume)); } catch { /* audio is best-effort */ } },
    dispose() { removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock); ctx?.close?.(); ctx = null; },
  };
}
