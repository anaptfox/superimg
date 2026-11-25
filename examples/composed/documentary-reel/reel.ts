import { escapeHtml } from "@foxworth/superimg/stdlib/text";
import type { AudioClip, Duration } from "@foxworth/superimg";

// Shared film stock for "The Persistence of Vision": one palette, one set of
// gate furniture, and one recurring figure. Every chapter is struck from this
// stock, so the reel reads as a single film rather than three slides.

export const INK = "#0C0A07";
export const INK_LIT = "#18120C";
export const BONE = "#EDE3D0";
export const AMBER = "#E2A64A";
export const RUST = "#B3563A";
export const DUST = "#7A6C5C";

export const FILM_TITLE = "THE PERSISTENCE OF VISION";

/** Deterministic hash → 0..1. Same frame, same grain, every render. */
function noise(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Projector gate weave: sub-pixel drift applied to the whole frame. Real prints
 * never sit perfectly still, and the tiny motion keeps static holds alive.
 */
export function gateWeave(frame: number): string {
  const x = (noise(frame) - 0.5) * 2.2;
  const y = (noise(frame + 97) - 0.5) * 1.6;
  return `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
}

// ---------------------------------------------------------------------------
// The figure — an articulated runner, carried through every chapter.
// ---------------------------------------------------------------------------

const RAD = Math.PI / 180;

/** Walk a joint chain. Angles are degrees from straight-down, forward positive. */
function chain(
  x: number,
  y: number,
  segments: readonly { angle: number; len: number }[],
): string {
  const pts: string[] = [`${x.toFixed(1)},${y.toFixed(1)}`];
  let cx = x;
  let cy = y;
  for (const seg of segments) {
    cx += Math.sin(seg.angle * RAD) * seg.len;
    cy += Math.cos(seg.angle * RAD) * seg.len;
    pts.push(`${cx.toFixed(1)},${cy.toFixed(1)}`);
  }
  return pts.join(" ");
}

export type RunnerOpts = {
  /** Gait phase; 1.0 is a full stride cycle. */
  phase: number;
  /** Overall figure height in user units (nominal 140). */
  scale?: number;
  color?: string;
  width?: number;
  opacity?: number;
};

/**
 * A running figure in silhouette, posed parametrically from a single phase.
 * Mid-stance falls at phase 0.5 with a straight support leg; the swing leg
 * tucks hardest at phase 0 — the same read as a Muybridge gait plate.
 */
export function runner(opts: RunnerOpts): string {
  const { phase, scale = 1, color = BONE, width = 5, opacity = 1 } = opts;
  const p = ((phase % 1) + 1) % 1;
  const phi = p * Math.PI * 2;

  const s = scale;
  const hipX = 50 * s;
  // Two hip dips per cycle, one for each foot's stance.
  const hipY = (72 + 4 * Math.cos(2 * phi)) * s;

  const lean = 14;
  const spine = 46 * s;
  const shX = hipX + Math.sin(lean * RAD) * spine;
  const shY = hipY - Math.cos(lean * RAD) * spine;

  const leg = (f: number) => {
    const thigh = 42 * Math.sin(f) - 4;
    // Knee tucks hardest just after toe-off and straightens through stance.
    const knee = thigh - (8 + 78 * (0.5 + 0.5 * Math.cos(f)));
    return chain(hipX, hipY, [
      { angle: thigh, len: 34 * s },
      { angle: knee, len: 32 * s },
      { angle: knee + 78, len: 11 * s },
    ]);
  };

  const arm = (f: number) => {
    const upper = 26 * Math.sin(f) - 8;
    return chain(shX, shY, [
      { angle: upper, len: 25 * s },
      { angle: upper + 88, len: 23 * s },
    ]);
  };

  const headR = 9.5 * s;
  const headX = shX + Math.sin(lean * RAD) * (14 * s);
  const headY = shY - Math.cos(lean * RAD) * (14 * s);

  const stroke = `fill="none" stroke="${color}" stroke-width="${(width * s).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"`;

  // Trailing limbs first so the near side reads on top.
  return `<g opacity="${opacity.toFixed(3)}">
    <polyline points="${leg(phi + Math.PI)}" ${stroke} opacity="0.55"/>
    <polyline points="${arm(phi)}" ${stroke} opacity="0.55"/>
    <line x1="${hipX.toFixed(1)}" y1="${hipY.toFixed(1)}" x2="${shX.toFixed(1)}" y2="${shY.toFixed(1)}" ${stroke}/>
    <polyline points="${leg(phi)}" ${stroke}/>
    <polyline points="${arm(phi + Math.PI)}" ${stroke}/>
    <circle cx="${headX.toFixed(1)}" cy="${headY.toFixed(1)}" r="${headR.toFixed(1)}" fill="${color}"/>
  </g>`;
}

// ---------------------------------------------------------------------------
// Gate furniture — sprockets, slate, grain, vignette.
// ---------------------------------------------------------------------------

/**
 * Perforations down both edges. `travel` scrolls them, so the film reads as
 * running through a gate; pass a constant to park it.
 */
export function sprockets(height: number, width: number, travel: number): string {
  const pitch = 76;
  const inset = 26;
  const holeW = 22;
  const holeH = 34;
  const offset = ((travel % 1) + 1) % 1;
  const rows = Math.ceil(height / pitch) + 2;

  const holes: string[] = [];
  for (let i = -1; i < rows; i++) {
    const y = i * pitch + offset * pitch;
    for (const x of [inset, width - inset - holeW]) {
      holes.push(
        `<rect x="${x}" y="${y.toFixed(1)}" width="${holeW}" height="${holeH}" rx="5" fill="${BONE}" opacity="0.16"/>`,
      );
    }
  }
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="position:absolute;inset:0;pointer-events:none">
    <rect x="0" y="0" width="${inset + holeW + 14}" height="${height}" fill="${BONE}" opacity="0.03"/>
    <rect x="${width - inset - holeW - 14}" y="0" width="${inset + holeW + 14}" height="${height}" fill="${BONE}" opacity="0.03"/>
    ${holes.join("")}
  </svg>`;
}

/** Film grain via feTurbulence — deterministic, no assets, no network. */
export function grain(width: number, height: number, seed: number): string {
  return `<svg width="${width}" height="${height}" style="position:absolute;inset:0;pointer-events:none;mix-blend-mode:soft-light;opacity:0.28">
    <filter id="grain${seed}" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed}" result="n"/>
      <feColorMatrix in="n" type="saturate" values="0"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#grain${seed})"/>
  </svg>`;
}

export function vignette(): string {
  return `<div style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 74% 66% at 50% 46%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.62) 100%)"></div>`;
}

/**
 * Running head and chapter mark, shared by every chapter so the reel keeps one
 * identity. `op` fades the whole apparatus; `ruleP` grows the rule from the left.
 */
export function slate(opts: {
  width: number;
  height: number;
  chapter: string;
  year: string;
  ruleP: number;
  op: number;
}): string {
  const { width, chapter, year, ruleP, op } = opts;
  if (op <= 0.004) return "";
  const left = 118;
  const right = width - 118;
  const span = (right - left) * Math.max(0, Math.min(1, ruleP));

  return `<div style="position:absolute;inset:0;pointer-events:none;opacity:${op.toFixed(3)};font-family:Inter,system-ui,sans-serif">
    <div style="position:absolute;left:${left}px;top:74px;display:flex;align-items:baseline;gap:18px">
      <span style="font-size:17px;font-weight:600;letter-spacing:0.34em;color:${AMBER}">${chapter}</span>
      <span style="font-size:15px;letter-spacing:0.28em;color:${DUST}">${year}</span>
    </div>
    <div style="position:absolute;left:${left}px;top:108px;height:1px;width:${span.toFixed(1)}px;background:${BONE};opacity:0.22"></div>
    <div style="position:absolute;left:${left}px;bottom:66px;font-size:14px;letter-spacing:0.3em;color:${DUST};opacity:0.75">${FILM_TITLE}</div>
  </div>`;
}

/** Warm archival ground shared by every chapter. */
export function ground(): string {
  return `radial-gradient(ellipse 88% 74% at 50% 38%, ${INK_LIT} 0%, ${INK} 72%)`;
}

export function clamp(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

export type Word = { text: string; start: number; end: number };

/**
 * Lay a sentence across a time window, weighting each word by its length so the
 * caption tracks a plausible reading cadence. Chapter scripts stay prose, and
 * these illustrative reading timings are not speech alignment or measured audio.
 */
export function narrate(sentence: string, start: number, end: number): Word[] {
  const parts = sentence.split(/\s+/).filter(Boolean);
  const weights = parts.map((w) => w.length + 2);
  const total = weights.reduce((a, b) => a + b, 0);
  const span = end - start;
  let cursor = start;
  return parts.map((text, i) => {
    const dur = ((weights[i] ?? 1) / total) * span;
    const word = {
      text,
      start: Number(cursor.toFixed(3)),
      // Leave a sliver of gap so the active word reads as a discrete beat.
      end: Number((cursor + dur * 0.9).toFixed(3)),
    };
    cursor += dur;
    return word;
  });
}

/**
 * Placeholder audio, not narration. One music asset stands in for all three chapters — the point of
 * this example is the multi-track timeline, not the voice — but each chapter
 * draws a different slice so the tracks are genuinely distinct.
 */
export const NARRATION_SRC = "../../_assets/lofi-bg.mp3";

export type Script = {
  id: string;
  label: string;
  text: string;
  words: Word[];
  trim: { in: Duration; out: Duration };
};

/**
 * Chapter scripts live here so a chapter and the composition agree on the word
 * timings without importing each other.
 */
export const SCRIPTS: Record<"ch1" | "ch2" | "ch3", Script> = {
  ch1: {
    id: "ch1-voice",
    label: "Chapter I placeholder audio",
    text: "Twelve drawings on a paper band. Spin the drum, look through the slots, and the drawings begin to walk.",
    words: narrate(
      "Twelve drawings on a paper band. Spin the drum, look through the slots, and the drawings begin to walk.",
      1.9,
      8.1,
    ),
    trim: { in: "0s", out: "10s" },
  },
  ch2: {
    id: "ch2-voice",
    label: "Chapter II placeholder audio",
    text: "Twelve exposures shown along a track, revealed in turn. Motion held still enough to count.",
    words: narrate(
      "Twelve exposures shown along a track, revealed in turn. Motion held still enough to count.",
      1.6,
      7.4,
    ),
    trim: { in: "10s", out: "20s" },
  },
  ch3: {
    id: "ch3-voice",
    label: "Chapter III placeholder audio",
    text: "Below sixteen frames a second the eye counts pictures. Above it, the eye gives up and calls it motion.",
    words: narrate(
      "Below sixteen frames a second the eye counts pictures. Above it, the eye gives up and calls it motion.",
      1.7,
      8.2,
    ),
    trim: { in: "20s", out: "30s" },
  },
};

/** Exercise voice-track mixing with explicitly labelled placeholder music. */
export function voiceClip(script: Script): AudioClip {
  return {
    id: script.id,
    label: script.label,
    src: NARRATION_SRC,
    role: "voice" as const,
    trim: script.trim,
    volume: 0.9,
    fadeIn: "0.3s",
    fadeOut: "0.5s",
    transcript: script.words,
  };
}

/**
 * The film's one caption treatment: a left-aligned lower third with the spoken
 * word in amber. Held on the same axis in every chapter, which keeps the right
 * of frame free for each chapter's picture.
 */
export function caption(
  words: readonly { text: string; active: boolean }[],
  op: number,
): string {
  if (op <= 0.004) return "";
  const spans = words
    .map(
      (w) =>
        `<span style="color:${w.active ? AMBER : BONE};opacity:${w.active ? "1" : "0.4"}">${escapeHtml(w.text)}</span>`,
    )
    .join(" ");
  return `<div style="position:absolute;left:176px;bottom:126px;width:700px;opacity:${op.toFixed(3)}">
    <p style="font-family:Inter,system-ui,sans-serif;font-size:31px;font-weight:500;line-height:1.52">${spans}</p>
  </div>`;
}

/** Lift into place while fading up — the reel's one entrance for text. */
export function rise(p: number, dist = 26): string {
  const k = clamp(p);
  return `opacity:${k.toFixed(3)};transform:translateY(${((1 - k) * dist).toFixed(2)}px)`;
}

/**
 * Wrap a line so it rises from behind its own baseline. Used for every title
 * in the film, which is what ties the chapters together typographically.
 */
export function revealLine(html: string, p: number, dist: number): string {
  const k = clamp(p);
  return `<div style="overflow:hidden;padding-bottom:2px"><div style="transform:translateY(${((1 - k) * dist).toFixed(2)}px)">${html}</div></div>`;
}
