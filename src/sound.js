/** Quiet procedural beds. Off until the user opts in. */

export function createAmbience() {
  let ctx = null;
  let gain = null;
  let nodes = [];
  let enabled = false;
  let kind = "city";

  function stopNodes() {
    for (const n of nodes) {
      try {
        n.stop?.();
        n.disconnect?.();
      } catch {
        /* already stopped */
      }
    }
    nodes = [];
  }

  function ensure() {
    if (ctx) return;
    ctx = new AudioContext();
    gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
  }

  function startKind(next) {
    if (!ctx || !enabled) return;
    stopNodes();
    kind = next || kind;
    const osc = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const g2 = ctx.createGain();
    osc.type = kind === "drums" ? "triangle" : kind === "sea" ? "sine" : "sawtooth";
    osc.frequency.value = kind === "drums" ? 72 : kind === "sea" ? 48 : 90;
    filt.type = "lowpass";
    filt.frequency.value = kind === "sea" ? 420 : 280;
    g2.gain.value = 0.045;
    osc.connect(filt);
    filt.connect(g2);
    g2.connect(gain);
    osc.start();
    nodes.push(osc);
    if (kind === "drums") {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 1.7;
      lfoGain.gain.value = 28;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();
      nodes.push(lfo);
    }
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.7, ctx.currentTime + 0.6);
  }

  return {
    isEnabled() {
      return enabled;
    },
    async setEnabled(on) {
      enabled = on;
      if (!on) {
        if (gain && ctx) {
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        }
        stopNodes();
        return;
      }
      ensure();
      if (ctx.state === "suspended") await ctx.resume();
      startKind(kind);
    },
    playFor(placeId) {
      const map = {
        kolkata: "drums",
        mumbai: "drums",
        chennai: "city",
        sydney: "sea",
        cape: "sea",
        "cape-town": "sea",
        rio: "sea",
        venice: "sea",
      };
      startKind(map[placeId] || "city");
    },
  };
}
