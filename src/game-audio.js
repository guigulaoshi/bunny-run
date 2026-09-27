export function createGameAudio() {
  let context, master, muted = false, owned = false;
  let nextStarTime = 0;
  const starVoices = /* @__PURE__ */ new Set();
  function resetStars() {
    for (const voice of starVoices) {
      voice.osc.stop();
      voice.gain.disconnect();
    }
    starVoices.clear();
    nextStarTime = 0;
  }
  function attach(next, ownsContext = false) {
    if (!next || next.state === "closed" || context === next) return;
    resetStars();
    master?.disconnect();
    if (owned && context) context.close().catch(() => {
    });
    context = next;
    owned = ownsContext;
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.45;
    master.connect(context.destination);
  }
  async function unlock() {
    try {
      if (!context || context.state === "closed") {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        attach(new Audio(), true);
      }
      if (context.state !== "running") await context.resume();
    } catch {
    }
  }
  function tone(type, from, to, duration, delay = 0, level = 0.35, wobble = 0) {
    if (!context || context.state !== "running" || muted) return;
    const t = context.currentTime + delay, osc = context.createOscillator(), gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + duration);
    gain.gain.setValueAtTime(1e-4, t);
    gain.gain.exponentialRampToValueAtTime(level, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(1e-4, t + duration);
    osc.connect(gain);
    gain.connect(master);
    let lfo, depth;
    if (wobble) {
      lfo = context.createOscillator();
      depth = context.createGain();
      lfo.frequency.value = 23;
      depth.gain.setValueAtTime(wobble, t);
      depth.gain.exponentialRampToValueAtTime(1, t + duration);
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + duration);
    }
    osc.start(t);
    osc.stop(t + duration + 0.02);
    const voice = { osc, gain };
    osc.onended = () => {
      starVoices.delete(voice);
      osc.disconnect();
      gain.disconnect();
      lfo?.disconnect();
      depth?.disconnect();
    };
    return voice;
  }
  return {
    unlock,
    attach,
    resetStars,
    stars(count) {
      if (!context || context.state !== "running" || muted || !Number.isFinite(count)) return;
      let at = Math.max(context.currentTime, nextStarTime);
      for (let i = 0; i < Math.floor(count); i++) {
        starVoices.add(tone("sine", 1568, 1568, 0.14, at - context.currentTime, 0.35));
        at += 0.18;
      }
      nextStarTime = at;
    },
    get ready() {
      return context?.state === "running";
    },
    get muted() {
      return muted;
    },
    jump() {
      tone("sine", 135, 48, 0.1, 0, 0.38);
      tone("triangle", 180, 560, 0.23, 0, 0.45, 75);
      tone("sine", 440, 170, 0.27, 0.045, 0.18, 40);
    },
    clear() {
      tone("sine", 1046, 1108, 0.25, 0, 0.35);
      tone("sine", 1568, 1760, 0.42, 0.07, 0.25);
      tone("triangle", 2093, 2093, 0.15, 0.08, 0.07);
    },
    death() {
      tone("sawtooth", 160, 40, 0.42, 0, 0.13, 15);
      tone("triangle", 370, 85, 0.6, 0.06, 0.3);
    },
    setMuted(value) {
      muted = value;
      if (muted) resetStars();
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.45, context.currentTime, 0.02);
    }
  };
}
