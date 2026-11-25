// Karaoke — a letterpress reading stage for ctx.track().
// Ink fills the spoken word; a tape strip under the line shows the cue timing.

import {
  video,
  layoutTimeline,
  Frame,
  Stack,
  Text,
  Vector,
  vector,
  type MediaElement,
  type RenderContext,
  googleFont,
} from "@foxworth/superimg";

export interface Cue {
  text: string;
  start: number;
  end: number;
  type?: string;
}

export interface KaraokeData extends Record<string, unknown> {
  transcript: Cue[];
  accentColor: string;
  bgColor: string;
}

/** Seconds of stage-setting before the first cue speaks. */
const LEAD = 0.7;
const SETTLE_S = 1.3;
const OUT_S = 0.45;

const SAMPLE_TRANSCRIPT: Cue[] = [
  { text: "Welcome", start: 0.0, end: 0.4, type: "word" },
  { text: "to", start: 0.45, end: 0.55, type: "word" },
  { text: "the", start: 0.6, end: 0.7, type: "word" },
  { text: "future", start: 0.75, end: 1.1, type: "word" },
  { text: "of", start: 1.15, end: 1.25, type: "word" },
  { text: "video", start: 1.3, end: 1.7, type: "word" },
  { text: "generation", start: 1.75, end: 2.4, type: "word" },
];

function cues(data: KaraokeData): Cue[] {
  const raw = Array.isArray(data.transcript) ? data.transcript : SAMPLE_TRANSCRIPT;
  const words = raw
    .filter((w) => (!w.type || w.type === "word") && Number.isFinite(w.start) && Number.isFinite(w.end) && w.start >= 0 && w.end > w.start)
    .sort((a, b) => a.start - b.start);
  return words.length > 0 ? words : SAMPLE_TRANSCRIPT;
}

/** Same pure plan in resolve() and render() so duration always fits the cues. */
function plan(data: KaraokeData) {
  const words = cues(data);
  const spoken = Math.max(0.6, Math.max(...words.map((word) => word.end)));
  return layoutTimeline({
    thread: LEAD,
    read: spoken + 0.15,
    settle: SETTLE_S,
    out: OUT_S,
  });
}

function rectPath(x: number, y: number, width: number, height: number): string {
  return `M${x},${y}H${x + width}V${y + height}H${x}Z`;
}

export default video<KaraokeData>({
  duration: "5s", // AST fallback; resolve() owns the real length
  fonts: [googleFont("Space+Grotesk:wght@500;700"), googleFont("JetBrains+Mono:wght@400;500")],
  inlineCss: [
    "* { margin: 0; padding: 0; box-sizing: border-box; }",
    "body { overflow: hidden; }",
  ],
  editions: {
    landscape: { size: { width: 1920, height: 1080 } },
    square: { size: { width: 1080, height: 1080 } },
  },
  sample: {
    transcript: SAMPLE_TRANSCRIPT,
    accentColor: "#C6482B",
    bgColor: "#F1ECE2",
  },

  resolve({ data }) {
    const { totalSeconds, phases } = plan(data as KaraokeData);
    return { duration: `${totalSeconds}s`, phases };
  },

  render(ctx: RenderContext<KaraokeData>) {
    const { std, width, height, data } = ctx;

    const paper = String(data.bgColor ?? "#F1ECE2");
    const accent = String(data.accentColor ?? "#C6482B");
    const ink = std.color.isLight(paper) ? "#171310" : "#F6F2EA";
    const ghost = std.color.alpha(ink, 0.18);
    const quiet = std.color.alpha(ink, 0.42);
    const hair = std.color.alpha(ink, 0.14);

    const words = cues(data);
    const spokenEnd = Math.max(0.6, Math.max(...words.map((word) => word.end)));

    const t = ctx.director(plan(data).phases);
    const page = t.motion({ id: "page", during: "thread", y: 18, exit: { y: -18 } });

    // Cues are authored from zero; the stage threads first, so shift them.
    const vo = ctx.track({
      id: "voiceover",
      words: words.map((w) => ({ text: w.text, start: w.start + LEAD, end: w.end + LEAD })),
    });
    const transcript = vo.transcript();
    const events = transcript.all();
    const phrase = transcript.between(0, events.length - 1);
    const active = transcript.current();
    const charProgress = transcript.charProgress();

    const measure = Math.round(Math.min(width * 0.8, 1180));
    const capPx = Math.round(Math.min(width, height * 1.42) * 0.058);
    const gapPx = Math.round(capPx * 0.32);
    const threadP = t.in("thread");
    const settleP = t.in("settle");

    const captionH = Math.round(capPx * 3.1);
    const lineHeight = capPx * 1.24;
    const captionWords: MediaElement[] = [];
    let wordX = 0;
    let lineIndex = 0;
    events.forEach((word, wordIndex) => {
      const metrics = std.svg.measureText(word.text, {
        fontSize: capPx,
        fontFamily: "Space Grotesk, system-ui, sans-serif",
        letterSpacing: -capPx * 0.02,
        lineHeight: 1.24,
      });
      if (wordX > 0 && wordX + metrics.width > measure) {
        wordX = 0;
        lineIndex += 1;
      }
      const spoken = word.progress >= 1;
      const isActive = word.active;
      const rise = isActive ? -Math.round(capPx * 0.05) : 0;
      // Keep one semantic run per character mounted for the whole animation;
      // only paint changes as the active cue advances.
      const full = isActive ? Math.floor(charProgress) : spoken ? word.text.length : 0;
      const partial = isActive ? charProgress - full : 0;
      const runs = Array.from(word.text).map((char, i) => {
        const color =
          i < full ? ink : isActive && i === full ? std.color.mix(ink, ghost, partial) : ghost;
        return vector.run({ id: `cue-${wordIndex}-char-${i}`, fill: color }, char);
      });

      // Underline grows with the cue instead of snapping on — no layout shift.
      const swipe = isActive || spoken ? word.progress : 0;
      const baseline = capPx * 1.12 + lineIndex * lineHeight;
      captionWords.push(
        vector.text(
          {
            id: `cue-${wordIndex}`,
            x: wordX,
            y: baseline,
            size: capPx,
            family: "Space Grotesk, system-ui, sans-serif",
            weight: 700,
            letterSpacing: -capPx * 0.02,
            transform: { y: rise },
          },
          ...runs,
        ),
        vector.path({
          id: `cue-underline-${wordIndex}`,
          d: `M${wordX},${baseline + capPx * 0.14}H${wordX + metrics.width}`,
          fill: "none",
          stroke: accent,
          strokeWidth: 3,
          pathLength: 1,
          strokeDasharray: 1,
          strokeDashoffset: 1 - swipe,
          opacity: swipe,
        }),
      );
      wordX += metrics.width + gapPx;
    });

    const captionTree = Vector(
      {
        id: "caption",
        width: measure,
        height: captionH,
        viewBox: { x: 0, y: 0, width: measure, height: captionH },
      },
      ...captionWords,
    );

    // Tape strip: one block per cue, laid out on real time, not on index.
    const stripW = measure;
    const stripH = Math.round(capPx * 0.5);
    const blockH = Math.round(stripH * 0.44);
    const blockY = Math.round((stripH - blockH) / 2);
    const span = spokenEnd + LEAD;
    const xOf = (sec: number) => (sec / span) * stripW;
    const now = std.math.clamp(ctx.timeline.seconds, 0, span);
    const drawn = std.interpolate(threadP, [0, 1], [0, 1], "easeOutCubic");

    const progressClips: MediaElement[] = [];
    const blocks = events.flatMap((word, wordIndex) => {
      const x = xOf(word.start);
      const w = Math.max(4, xOf(word.end) - x);
      const lit = Math.max(0, Math.min(1, word.progress));
      progressClips.push(
        vector.clip(
          { id: `cue-block-window-${wordIndex}` },
          vector.path({ d: rectPath(x, blockY, w * lit, blockH), fill: "#fff" }),
        ),
      );
      return [
        vector.path({
          id: `cue-block-${wordIndex}`,
          d: std.svg.shape.roundedRect(x, blockY, w, blockH, 2),
          fill: hair,
        }),
        vector.path({
          id: `cue-block-progress-${wordIndex}`,
          d: std.svg.shape.roundedRect(x, blockY, w, blockH, 2),
          fill: accent,
          clip: `cue-block-window-${wordIndex}`,
        }),
      ];
    });

    const headX = xOf(now);
    const headOp = t.in("out") > 0 ? 0 : std.interpolate(threadP, [0.4, 1], [0, 1], "easeOutCubic");
    const stripTree = Vector(
      {
        id: "tape",
        width: stripW,
        height: stripH,
        viewBox: { x: 0, y: 0, width: stripW, height: stripH },
      },
      vector.defs(
        vector.clip(
          { id: "tape-window" },
          vector.path({ d: rectPath(0, 0, stripW * drawn, stripH), fill: "#fff" }),
        ),
        ...progressClips,
      ),
      vector.path({
        id: "tape-baseline",
        d: `M0,${stripH - 1}H${stripW}`,
        fill: "none",
        stroke: hair,
        strokeWidth: 2,
        pathLength: 1,
        strokeDasharray: 1,
        strokeDashoffset: 1 - drawn,
        opacity: drawn,
      }),
      vector.group({ id: "cue-blocks", clip: "tape-window" }, ...blocks),
      vector.path({
        id: "playhead-line",
        d: `M${headX},0V${stripH}`,
        fill: "none",
        stroke: ink,
        strokeWidth: 1.5,
        opacity: headOp,
      }),
      vector.path({
        id: "playhead-dot",
        d: std.svg.shape.circle(headX, stripH - 1, 3.5),
        fill: ink,
        opacity: headOp,
      }),
    );

    const timecode = `${Math.floor(now / 60)}:${(now % 60).toFixed(2).padStart(5, "0")}`;
    const labelPx = Math.round(capPx * 0.19);
    const railPx = Math.max(1, Math.round(capPx * 0.02));

    return Frame(
      { id: "stage", width, height, fill: paper },
      Frame({
        x: Math.round((width - measure) / 2 - capPx * 0.62),
        y: 0,
        width: railPx,
        height,
        fill: hair,
      }),
      Stack(
        {
          id: "sheet",
          width: "fill",
          height: "fill",
          align: "center",
          justify: "center",
          gap: Math.round(capPx * 0.55),
          motion: page,
        },
        Stack(
          {
            direction: "row",
            width: measure,
            height: Math.round(labelPx * 1.5),
            justify: "space-between",
            align: "center",
            style: { opacity: std.interpolate(threadP, [0.2, 1], [0, 1], "easeOutCubic") },
          },
          Text(
            { variant: "label", color: quiet, size: labelPx, weight: 500, letterSpacing: 3.6 },
            "TRANSCRIPT SYNC",
          ),
          Text(
            {
              variant: "label",
              color: quiet,
              size: labelPx,
              weight: 500,
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            },
            timecode,
          ),
        ),
        captionTree,
        // between() lights the whole phrase once the last cue lands.
        Frame(
          { width: measure, height: 3 },
          Frame({
            x: 0,
            y: 0,
            width: measure,
            height: 3,
            fill: accent,
            style: {
              opacity: settleP > 0 ? 1 : 0,
              transform: `scaleX(${std.interpolate(settleP, [0, 0.55], [0, 1], "easeOutCubic")})`,
              transformOrigin: "left center",
            },
          }),
        ),
        stripTree,
        Stack(
          {
            direction: "row",
            width: measure,
            height: Math.round(labelPx * 1.5),
            justify: "space-between",
            align: "center",
            style: { opacity: std.interpolate(threadP, [0.4, 1], [0, 1], "easeOutCubic") },
          },
          Text(
            {
              variant: "label",
              color: quiet,
              size: labelPx,
              weight: 500,
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            },
            `${events.length} cues · ${spokenEnd.toFixed(1)}s`,
          ),
          Text(
            {
              variant: "label",
              color: settleP > 0 ? accent : quiet,
              size: labelPx,
              weight: 500,
              letterSpacing: 2.4,
            },
            active ? active.text.toUpperCase() : `${Math.round(phrase.progress * 100)}% READ`,
          ),
        ),
      ),
    );
  },
});
