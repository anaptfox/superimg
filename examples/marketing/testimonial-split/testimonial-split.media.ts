// Testimonial Split — a magazine spread: oat panel, forest field, coral pull.
// The portrait is drawn, not photographed, so this runs with no network at all.

import { video, Frame, Fill, Text, Html, Image, type RenderContext, googleFont } from "@foxworth/superimg";
import { portrait } from "./portrait";

export interface QuoteChunk {
  text: string;
  highlights: string[];
}

export interface TestimonialData extends Record<string, unknown> {
  question: string;
  quoteChunks: QuoteChunk[];
  closingQuote: string;
  name: string;
  title: string;
  /** Inline data URI for the drawn portrait. */
  photoUrl: string;
  orgName: string;
  brandColor: string;
}

const FOREST = "#122019";
const FOREST_DEEP = "#0A130E";
const OAT = "#EDE4D3";
const CORAL = "#E2705A";

export default video<TestimonialData>({
  duration: "18s",
  poster: "9s",
  fonts: [googleFont("Fraunces:wght@600;700"), googleFont("Archivo:wght@500;700"), googleFont("DM+Mono:wght@400;500")],
  editions: {
    square: { size: { width: 1080, height: 1080 } },
    story: { size: { width: 1080, height: 1920 } },
  },
  audio: {
    id: "bed",
    src: "../../_assets/lofi-bg.mp3",
    role: "music",
    volume: 0.4,
    fadeIn: "0.6s",
    fadeOut: "2.4s",
    loop: true,
  },
  sample: {
    question: "Why do you build in the open?",
    quoteChunks: [
      {
        text: "Working in public made the project a CRAFT.",
        highlights: ["CRAFT"],
      },
      {
        text: "Every PR brings a REVIEW I could never afford.",
        highlights: ["REVIEW"],
      },
      {
        text: "The work outlives the job. Nobody TELLS YOU that.",
        highlights: ["TELLS YOU"],
      },
    ],
    closingQuote: "Build where people can see it.",
    name: "Leslie Ward",
    title: "Staff Engineer",
    photoUrl: portrait({ paper: "#EDE4D3", ink: "#122019", accent: "#E2705A" }),
    orgName: "Northwind Collective",
    brandColor: "#E2705A",
  },
  render(ctx: RenderContext<TestimonialData>) {
    const { std, width, height, data } = ctx;
    const stacked = ctx.isPortrait || ctx.isSquare;
    const { question, quoteChunks, closingQuote, name, title, photoUrl, orgName, brandColor } =
      data;

    const t = ctx.director({
      intro: "1s",
      content: "13.4s",
      close: "2.6s",
      exit: "1s",
    });

    const introP = t.in("intro");
    const contentP = t.in("content");
    const outroP = t.in("close");
    const exitP = t.in("exit");
    const opened = contentP > 0 || outroP > 0;

    // The spread lifts and dims as a single object rather than piece by piece.
    const spreadOut = std.interpolate(exitP, [0, 1], [0, 1], "easeInCubic");

    const wipe = std.reveal.wipe({
      progress: std.clamp01(introP / 0.55),
      direction: "diagonal",
      color: brandColor,
    });

    // Panel geometry: a column beside the quote, or a band above it.
    const panelW = stacked ? width : Math.round(width * 0.37);
    const panelH = stacked ? Math.round(height * 0.42) : height;
    const panelSlide = std.interpolate(
      opened ? 1 : std.clamp01((introP - 0.35) / 0.65),
      [0, 1],
      [1, 0],
      "easeOutExpo",
    );
    const panelOffset = stacked ? -panelH * panelSlide : -panelW * panelSlide;

    const faceSize = Math.round(Math.min(panelW * 0.56, panelH * 0.42));
    const faceX = Math.round((panelW - faceSize) / 2);
    const faceY = Math.round(stacked ? panelH * 0.14 : height * 0.19);
    const faceIn = std.spring(0.86, 1, std.clamp01((opened ? 1 : introP / 0.9 - 0.4) * 1.6), "gentle");

    const colX = stacked ? Math.round(width * 0.08) : panelW + Math.round(width * 0.055);
    const colW = stacked
      ? width - colX * 2
      : width - colX - Math.round(width * 0.055);
    const colY = stacked ? panelH + Math.round(height * 0.06) : Math.round(height * 0.17);

    const quoteSize = ctx.isSquare ? 46 : stacked
      ? Math.round(height * 0.028)
      : Math.round(Math.min(height * 0.048, colW * 0.042));
    const quoteBoxH = stacked ? Math.round(height * 0.30) : Math.round(height * 0.44);

    // Three chunks share the content phase; each gets a rise, a hold, a fall.
    const chunks = quoteChunks.length ? quoteChunks : [{ text: closingQuote, highlights: [] }];
    const chunkCount = chunks.length;
    const cursor = contentP * chunkCount;
    const index = Math.min(chunkCount - 1, Math.floor(cursor));
    const local = cursor - index;
    const chunk = chunks[index]!;

    const rise = std.interpolate(std.clamp01(local * 5), [0, 1], [0, 1], "easeOutCubic");
    const fall = std.interpolate(std.clamp01((local - 0.86) / 0.14), [0, 1], [0, 1], "easeInCubic");
    const chunkOp = opened && outroP === 0 ? rise * (1 - fall) : 0;
    const chunkY = std.interpolate(rise, [0, 1], [22, 0], "easeOutCubic") + fall * 14;
    const markDraw = std.clamp01((local - 0.22) / 0.3);

    const closeOp = std.interpolate(std.clamp01(outroP * 2.2), [0, 1], [0, 1], "easeOutCubic");
    const closeY = std.interpolate(closeOp, [0, 1], [26, 0], "easeOutCubic");

    const eyebrowOp = std.clamp01((opened ? 1 : (introP - 0.5) * 3)) * (1 - closeOp);
    const ruleW = Math.round(colW * 0.18 * eyebrowOp);

    const highlighted = (text: string, marks: string[]): string => {
      let out = std.text.escapeHtml(text);
      for (const rawMark of marks.filter(Boolean)) {
        const mark = std.text.escapeHtml(rawMark);
        out = out.replace(
          mark,
          `<span style="color:${brandColor};position:relative;white-space:nowrap;">${mark}<span style="position:absolute;left:0;bottom:-0.14em;height:0.09em;width:${(markDraw * 100).toFixed(1)}%;background:${brandColor};opacity:0.75;"></span></span>`,
        );
      }
      return out;
    };

    const quoteHtml = `<div style="font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:${quoteSize}px;line-height:1.42;color:${OAT};letter-spacing:-0.01em;opacity:${chunkOp.toFixed(3)};transform:translateY(${chunkY.toFixed(2)}px);">${highlighted(chunk.text, chunk.highlights)}</div>`;

    const closingHtml = `<div style="font-family:'Fraunces',Georgia,serif;font-weight:700;font-size:${Math.round(quoteSize * 1.32)}px;line-height:1.24;color:${OAT};opacity:${closeOp.toFixed(3)};transform:translateY(${closeY.toFixed(2)}px);">${std.text.escapeHtml(closingQuote)}</div>`;

    const ticks = Array.from({ length: chunkCount }, (_, i) => {
      const on = outroP > 0 ? 1 : i <= index ? 1 : 0;
      return `<div style="width:${Math.round(colW * 0.06)}px;height:4px;background:${i === index && outroP === 0 ? brandColor : OAT};opacity:${on ? (i === index ? 1 : 0.3) : 0.12};"></div>`;
    }).join("");

    const footH = Math.round(height * (stacked ? 0.085 : 0.1));

    return Frame(
      {
        id: "spread",
        width: "fill",
        height: "fill",
        style: {
          opacity: 1 - spreadOut,
          transform: `scale(${(1 - spreadOut * 0.02).toFixed(4)})`,
          transformOrigin: "50% 50%",
        },
      },
      Fill({
        gradient: {
          kind: "radial",
          at: stacked ? "50% 78%" : "72% 40%",
          size: "120% 120%",
          stops: [`${FOREST} 0%`, `${FOREST_DEEP} 100%`],
        },
      }),

      Frame(
        {
          id: "panel",
          x: stacked ? 0 : Math.round(panelOffset),
          y: stacked ? Math.round(panelOffset) : 0,
          width: panelW,
          height: panelH,
          fill: OAT,
        },
        Image({
          id: "portrait", x: faceX, y: faceY, width: faceSize, height: faceSize,
          src: photoUrl, fit: "contain", style: { transform: `scale(${faceIn})`, transformOrigin: "50% 50%" },
        }),
        Frame(
          {
            x: Math.round(panelW * 0.1),
            y: faceY + faceSize + Math.round(height * 0.045),
            width: Math.round(panelW * 0.8),
            height: Math.round(height * 0.06),
          },
          Text(
            {
              variant: "title",
              size: Math.round(Math.min(panelW * 0.085, height * 0.042)),
              weight: 700,
              color: FOREST,
              fontFamily: "'Archivo', system-ui, sans-serif",
              align: "center",
              letterSpacing: -0.5,
            },
            name,
          ),
        ),
        Frame(
          {
            x: Math.round(panelW * 0.1),
            y: faceY + faceSize + Math.round(height * 0.105),
            width: Math.round(panelW * 0.8),
            height: Math.round(height * 0.04),
          },
          Text(
            {
              variant: "caption",
              size: Math.round(Math.min(panelW * 0.038, height * 0.019)),
              weight: 500,
              color: `${FOREST}B0`,
              fontFamily: "'DM Mono', ui-monospace, monospace",
              align: "center",
              letterSpacing: 3,
            },
            title.toUpperCase(),
          ),
        ),
        Frame({
          x: Math.round(panelW * 0.42),
          y: faceY + faceSize + Math.round(height * 0.026),
          width: Math.round(panelW * 0.16),
          height: 3,
          fill: brandColor,
        }),
      ),

      Frame(
        { id: "eyebrow", x: colX, y: colY, width: colW, height: Math.round(height * 0.05) },
        Text(
          {
            variant: "label",
            size: Math.round(Math.min(colW * 0.028, height * 0.024)),
            weight: 500,
            color: brandColor,
            fontFamily: "'DM Mono', ui-monospace, monospace",
            letterSpacing: 4,
            maxWidth: colW,
            style: { opacity: eyebrowOp },
          },
          question.toUpperCase(),
        ),
      ),
      Frame({
        x: colX,
        y: colY + Math.round(height * 0.055),
        width: Math.max(1, ruleW),
        height: 2,
        fill: `${OAT}55`,
        style: { opacity: ruleW > 1 ? 1 : 0 },
      }),

      Html({
        id: "quote",
        x: colX,
        y: colY + Math.round(height * 0.1),
        width: colW,
        height: quoteBoxH,
        html: outroP > 0 ? closingHtml : quoteHtml,
      }),

      Html({
        id: "ticks",
        x: colX,
        y: colY + Math.round(height * 0.1) + quoteBoxH,
        width: colW,
        height: 20,
        html: `<div style="display:flex;gap:10px;">${ticks}</div>`,
      }),

      Frame(
        {
          id: "footer",
          x: 0,
          y: height - footH,
          width,
          height: footH,
          fill: brandColor,
        },
        Frame(
          {
            x: Math.round(width * 0.055),
            y: Math.round(footH * 0.34),
            width: Math.round(width * 0.5),
            height: Math.round(footH * 0.4),
          },
          Text(
            {
              variant: "caption",
              size: Math.round(Math.min(width * 0.016, footH * 0.3)),
              weight: 700,
              color: FOREST,
              fontFamily: "'Archivo', system-ui, sans-serif",
              letterSpacing: 5,
            },
            orgName.toUpperCase(),
          ),
        ),
        Frame(
          {
            x: Math.round(width * 0.445),
            y: Math.round(footH * 0.34),
            width: Math.round(width * 0.5),
            height: Math.round(footH * 0.4),
          },
          Text(
            {
              variant: "caption",
              size: Math.round(Math.min(width * 0.016, footH * 0.3)),
              weight: 500,
              color: `${FOREST}CC`,
              fontFamily: "'DM Mono', ui-monospace, monospace",
              align: "right",
              letterSpacing: 3,
            },
            `${name} · ${title}`.toUpperCase(),
          ),
        ),
      ),

      wipe.active
        ? Frame(
            { id: "wipe", width: "fill", height: "fill" },
            Html({ html: wipe.html }),
          )
        : null,
    );
  },
});
