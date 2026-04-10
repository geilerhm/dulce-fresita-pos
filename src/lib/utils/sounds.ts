/**
 * POS sound packs — selectable from Settings
 */

let audioCtx: AudioContext | null = null;

function getCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function tone(freq: number, vol: number, start: number, dur: number, type: OscillatorType = "sine") {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vol, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.start(start);
  osc.stop(start + dur);
}

// ── Sound packs ──────────────────────────────────────────

export interface SoundPack {
  id: string;
  name: string;
  description: string;
  add: () => void;
  remove: () => void;
  success: () => void;
  click: () => void;
  error: () => void;
}

const crystal: SoundPack = {
  id: "crystal",
  name: "Cristal",
  description: "Campanitas de cristal suaves",
  add: () => {
    const t = getCtx().currentTime;
    tone(523.25, 0.08, t, 0.25);
    tone(783.99, 0.08, t + 0.04, 0.25);
  },
  remove: () => {
    const t = getCtx().currentTime;
    tone(440, 0.06, t, 0.18);
  },
  success: () => {
    const t = getCtx().currentTime;
    [523.25, 659.25, 783.99].forEach((f, i) => tone(f, 0.07, t + i * 0.12, 0.5));
  },
  click: () => {
    const t = getCtx().currentTime;
    tone(660, 0.04, t, 0.08);
  },
  error: () => {
    const t = getCtx().currentTime;
    tone(330, 0.08, t, 0.15);
    tone(262, 0.08, t + 0.12, 0.2);
  },
};

const minimal: SoundPack = {
  id: "minimal",
  name: "Minimal",
  description: "Un toque sutil, casi imperceptible",
  add: () => {
    const t = getCtx().currentTime;
    tone(880, 0.05, t, 0.1);
  },
  remove: () => {
    const t = getCtx().currentTime;
    tone(330, 0.04, t, 0.1);
  },
  success: () => {
    const t = getCtx().currentTime;
    tone(880, 0.06, t, 0.15);
    tone(1108.73, 0.06, t + 0.1, 0.2);
  },
  click: () => {
    const t = getCtx().currentTime;
    tone(800, 0.03, t, 0.05);
  },
  error: () => {
    const t = getCtx().currentTime;
    tone(300, 0.05, t, 0.12);
    tone(220, 0.05, t + 0.08, 0.15);
  },
};

const wooden: SoundPack = {
  id: "wooden",
  name: "Madera",
  description: "Tonos calidos tipo marimba",
  add: () => {
    const t = getCtx().currentTime;
    tone(587.33, 0.1, t, 0.12, "triangle");
    tone(783.99, 0.06, t + 0.01, 0.15, "triangle");
  },
  remove: () => {
    const t = getCtx().currentTime;
    tone(392, 0.07, t, 0.1, "triangle");
  },
  success: () => {
    const t = getCtx().currentTime;
    [587.33, 739.99, 880].forEach((f, i) => tone(f, 0.09, t + i * 0.1, 0.3, "triangle"));
  },
  click: () => {
    const t = getCtx().currentTime;
    tone(500, 0.06, t, 0.06, "triangle");
  },
  error: () => {
    const t = getCtx().currentTime;
    tone(350, 0.08, t, 0.12, "triangle");
    tone(260, 0.08, t + 0.1, 0.18, "triangle");
  },
};

const bubble: SoundPack = {
  id: "bubble",
  name: "Burbujas",
  description: "Pop suave y jugueton",
  add: () => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.start(t);
    osc.stop(t + 0.12);
  },
  remove: () => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(500, t);
    osc.frequency.exponentialRampToValueAtTime(250, t + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.07, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.start(t);
    osc.stop(t + 0.12);
  },
  success: () => {
    const t = getCtx().currentTime;
    [400, 500, 650, 800].forEach((f, i) => {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      const start = t + i * 0.08;
      osc.frequency.setValueAtTime(f * 0.8, start);
      osc.frequency.exponentialRampToValueAtTime(f, start + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.08, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  },
  click: () => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(350, t);
    osc.frequency.exponentialRampToValueAtTime(500, t + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.06, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.start(t);
    osc.stop(t + 0.06);
  },
  error: () => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.start(t);
    osc.stop(t + 0.2);
  },
};

const silent: SoundPack = {
  id: "silent",
  name: "Silencio",
  description: "Sin sonidos",
  add: () => {},
  remove: () => {},
  success: () => {},
  click: () => {},
  error: () => {},
};

// ── Registry ──────────────────────────────────────────

export const SOUND_PACKS: SoundPack[] = [crystal, minimal, wooden, bubble, silent];

const STORAGE_KEY = "dulce-fresita-sound-pack";

export function getSavedPackId(): string {
  if (typeof window === "undefined") return "crystal";
  return localStorage.getItem(STORAGE_KEY) || "crystal";
}

export function savePackId(id: string) {
  localStorage.setItem(STORAGE_KEY, id);
}

function getPack(): SoundPack {
  const id = getSavedPackId();
  return SOUND_PACKS.find((p) => p.id === id) || crystal;
}

// ── Public API (used by components) ──────────────────

export function playAdd() { try { getPack().add(); } catch {} }
export function playRemove() { try { getPack().remove(); } catch {} }
export function playSuccess() { try { getPack().success(); } catch {} }
export function playClick() { try { getPack().click(); } catch {} }
export function playError() { try { getPack().error(); } catch {} }
