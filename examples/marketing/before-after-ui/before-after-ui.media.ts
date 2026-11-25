// Before / After (UI) — a drafting sheet with two pinned specimens.
// Film: graph paper, hairline ink, red pen. The markup under test is authored
// in this file, so nothing is fetched at render time.
// Two transitions, both implemented: `wipe` overdraws one box, `split` pins two.

import { video, Frame, Fill, Stack, Text, Html, type RenderContext, googleFont } from "@foxworth/superimg";

export type TransitionStyle = "wipe" | "split";

export interface UIContent {
  html: string;
  css: string;
  label: string;
}

export interface BeforeAfterUIData extends Record<string, unknown> {
  before: UIContent;
  after: UIContent;
  title: string;
  transition: TransitionStyle;
  accentColor: string;
}

const PAPER = "#F4F1E8";
const PAPER_EDGE = "#E7E2D4";
const INK = "#1D2430";
const GRAPHITE = "#6C7480";
const GRID = "rgba(38,84,140,0.11)";
const GRID_FINE = "rgba(38,84,140,0.05)";

const LEGACY_CSS = `
.ba-legacy { font-family: "Times New Roman", Times, serif; color: #000; }
.ba-legacy table { border-collapse: collapse; }
.ba-legacy td { padding: 4px 6px; font-size: 15px; }
.ba-legacy input {
  font: 14px "Times New Roman", serif; padding: 2px 4px; width: 190px;
  border: 2px inset #d6d3ce; background: #fff;
}
.ba-legacy .go {
  font: 13px "Times New Roman", serif; padding: 3px 12px;
  border: 2px outset #d6d3ce; background: #d6d3ce;
}
.ba-legacy .note { font-size: 12px; color: #a00; }
`;

const LEGACY_HTML = `
<div class="ba-legacy">
  <table>
    <tr><td>Email address:</td><td><input value="you@example.com"></td></tr>
    <tr><td>Plan:</td><td><input value="Standard"></td></tr>
    <tr><td></td><td><button class="go">Submit Form</button></td></tr>
  </table>
  <div class="note">* All fields are required.</div>
</div>
`;

const MODERN_CSS = `
.ba-modern {
  font-family: ui-sans-serif, system-ui, sans-serif; color: #10161f;
  width: 340px; padding: 22px; border-radius: 14px; background: #fff;
  box-shadow: 0 1px 2px rgba(16,22,31,.06), 0 12px 28px rgba(16,22,31,.10);
  border: 1px solid #e8ebef;
}
.ba-modern h4 { margin: 0 0 14px; font-size: 16px; font-weight: 650; letter-spacing: -.01em; }
.ba-modern label { display: block; font-size: 12px; font-weight: 600; color: #667085; margin-bottom: 5px; }
.ba-modern .field { margin-bottom: 14px; }
.ba-modern input {
  width: 100%; box-sizing: border-box; font: 14px ui-sans-serif, system-ui, sans-serif;
  padding: 9px 11px; border-radius: 8px; border: 1px solid #d6dbe2; background: #fbfcfd;
}
.ba-modern .go {
  width: 100%; font: 600 14px ui-sans-serif, system-ui, sans-serif; color: #fff;
  padding: 11px 14px; border: 0; border-radius: 9px; background: #10161f;
}
.ba-modern .hint { margin-top: 10px; font-size: 12px; color: #98a2b3; text-align: center; }
`;

const MODERN_HTML = `
<div class="ba-modern">
  <h4>Start your trial</h4>
  <div class="field"><label>Email</label><input value="you@example.com"></div>
  <div class="field"><label>Plan</label><input value="Standard — $19/mo"></div>
  <button class="go">Create account</button>
  <div class="hint">No card required for 14 days.</div>
</div>
`;

function specimen(content: UIContent, scale: number, tint: string, ticks: string): string {
  return `<div style="position:absolute;inset:0;background:#fff;border:1px solid ${INK}22;box-shadow:0 10px 26px rgba(29,36,48,0.10);overflow:hidden;">
    <style>${content.css}</style>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
      <div style="transform:scale(${scale.toFixed(3)});transform-origin:50% 50%;">${content.html}</div>
    </div>
    <div style="position:absolute;inset:0;background:${tint};pointer-events:none;"></div>
    ${ticks}
  </div>`;
}

const TICK_CORNERS = ["left:0;top:0", "right:0;top:0", "left:0;bottom:0", "right:0;bottom:0"];

function cornerTicks(color: string, opacity: number): string {
  const arm = 22;
  const marks = TICK_CORNERS.map(
    (anchor) =>
      `<div style="position:absolute;${anchor};width:${arm}px;height:2px;background:${color};"></div>
       <div style="position:absolute;${anchor};width:2px;height:${arm}px;background:${color};"></div>`,
  ).join("");
  return `<div style="position:absolute;inset:-1px;opacity:${opacity.toFixed(3)};pointer-events:none;">${marks}</div>`;
}

export default video<BeforeAfterUIData>({
  duration: "6s",
  poster: "4.6s",
  fonts: [googleFont("Archivo:wght@600;800"), googleFont("DM+Mono:wght@400;500")],
  sample: {
    title: "Sign-up form",
    before: { html: LEGACY_HTML, css: LEGACY_CSS, label: "Rev A — 2011" },
    after: { html: MODERN_HTML, css: MODERN_CSS, label: "Rev B — today" },
    transition: "wipe",
    accentColor: "#C2382B",
  },
  variants: {
    split: { transition: "split" },
  },
  render(ctx: RenderContext<BeforeAfterUIData>) {
    const { std, width, height, data } = ctx;
    const { title, before, after, transition, accentColor } = data;

    const t = ctx.director({
      lay: "15%",
      read: "19%",
      pull: "28%",
      settle: "26%",
      out: "12%",
    });

    const layP = t.in("lay");
    const pullP = t.in("pull");
    const settleP = t.in("settle");
    const outP = t.in("out");

    const swap =
      settleP > 0 || outP > 0
        ? 1
        : std.interpolate(pullP, [0, 1], [0, 1], "easeInOutCubic");

    const sheetMotion = t.motion({
      id: "sheet",
      during: "lay",
      at: "0%",
      for: "80%",
      y: 30,
      scale: 0.985,
    });
    const titleMotion = t.motion({ id: "title", during: "lay", at: "8%", for: "62%", y: 14 });

    const fade = 1 - std.interpolate(outP, [0, 1], [0, 1], "easeInCubic");

    const pad = Math.round(width * 0.07);
    const headH = Math.round(height * 0.15);
    const footH = Math.round(height * 0.1);
    const stageW = width - pad * 2;
    const stageH = height - headH - footH - Math.round(height * 0.06);

    let artHtml: string;

    if (transition === "split") {
      const gap = Math.round(stageW * 0.05);
      const half = Math.round((stageW - gap) / 2);
      const boxH = Math.round(Math.min(stageH, half * 0.72));
      const top = Math.round((stageH - boxH) / 2);
      const veil = (on: number) => `rgba(244,241,232,${(0.52 * (1 - on)).toFixed(3)})`;
      artHtml = `<div style="position:absolute;inset:0;">
        <div style="position:absolute;left:0;top:${top}px;width:${half}px;height:${boxH}px;">
          ${specimen(before, 1, veil(1 - swap), cornerTicks(accentColor, 1 - swap))}
        </div>
        <div style="position:absolute;left:${half + gap}px;top:${top}px;width:${half}px;height:${boxH}px;">
          ${specimen(after, 1, veil(swap), cornerTicks(accentColor, swap))}
        </div>
        <div style="position:absolute;left:${(half + gap / 2 - 1).toFixed(1)}px;top:${top}px;width:2px;height:${boxH}px;background:${INK}22;"></div>
      </div>`;
    } else {
      const boxW = Math.round(Math.min(stageW, stageH * 1.5));
      const boxH = Math.round(Math.min(stageH, boxW * 0.6));
      const left = Math.round((stageW - boxW) / 2);
      const top = Math.round((stageH - boxH) / 2);
      const cut = boxW * swap;
      const moving = swap > 0.001 && swap < 0.999;
      artHtml = `<div style="position:absolute;inset:0;">
        <div style="position:absolute;left:${left}px;top:${top}px;width:${boxW}px;height:${boxH}px;">
          ${specimen(before, 1, "transparent", "")}
        </div>
        <div style="position:absolute;left:${left}px;top:${top}px;width:${boxW}px;height:${boxH}px;clip-path:inset(0 ${(boxW - cut).toFixed(1)}px 0 0);">
          ${specimen(after, 1, "transparent", "")}
        </div>
        <div style="position:absolute;left:${left}px;top:${top}px;width:${boxW}px;height:${boxH}px;">
          ${cornerTicks(accentColor, swap)}
        </div>
        <div style="position:absolute;left:${(left + cut - 1).toFixed(1)}px;top:${(top - 14).toFixed(0)}px;width:2px;height:${boxH + 28}px;background:${accentColor};opacity:${moving ? 1 : 0};"></div>
        <div style="position:absolute;left:${(left + cut - 6).toFixed(1)}px;top:${(top - 22).toFixed(0)}px;width:12px;height:12px;background:${accentColor};opacity:${moving ? 1 : 0};transform:rotate(45deg);"></div>
      </div>`;
    }

    const penRule = Math.round(stageW * 0.22 * std.clamp01(layP * 1.4));
    const arrowFill = Math.round(140 * swap);

    return Frame(
      { id: "desk", width: "fill", height: "fill" },
      Fill({
        gradient: {
          kind: "linear",
          angle: 160,
          stops: [`${PAPER} 0%`, `${PAPER_EDGE} 100%`],
        },
      }),
      Html({
        id: "graph",
        html: `<div style="position:absolute;inset:0;background-image:
          linear-gradient(${GRID} 1px, transparent 1px),
          linear-gradient(90deg, ${GRID} 1px, transparent 1px),
          linear-gradient(${GRID_FINE} 1px, transparent 1px),
          linear-gradient(90deg, ${GRID_FINE} 1px, transparent 1px);
          background-size: 96px 96px, 96px 96px, 16px 16px, 16px 16px;"></div>`,
      }),
      Frame(
        {
          id: "sheet",
          x: pad,
          y: Math.round(height * 0.04),
          width: stageW,
          height: height - Math.round(height * 0.08),
          style: { opacity: fade },
          motion: sheetMotion,
        },
        Stack(
          { direction: "column", width: stageW, height: headH, justify: "center", gap: 10 },
          Stack(
            { direction: "row", width: stageW, justify: "space-between", align: "center" },
            Text(
              {
                variant: "title",
                size: Math.round(height * 0.05),
                weight: 800,
                color: INK,
                fontFamily: "'Archivo', system-ui, sans-serif",
                letterSpacing: -1,
                motion: titleMotion,
              },
              title,
            ),
            Text(
              {
                variant: "label",
                size: 18,
                weight: 500,
                color: GRAPHITE,
                fontFamily: "'DM Mono', ui-monospace, monospace",
                letterSpacing: 4,
              },
              transition === "split" ? "SHEET 02 · PAIR" : "SHEET 01 · OVERDRAW",
            ),
          ),
          Frame({
            width: Math.max(1, penRule),
            height: 3,
            fill: accentColor,
            style: { opacity: penRule > 1 ? 1 : 0 },
          }),
        ),
        Html({ id: "stage", x: 0, y: headH, width: stageW, height: stageH, html: artHtml }),
        Frame({ id: "footer", y: headH + stageH, width: stageW, height: footH },
        Stack(
          {
            direction: "row",
            width: stageW,
            height: footH,
            align: "center",
            gap: 18,
            style: { opacity: 0.4 + layP * 0.6 },
          },
          Text(
            {
              variant: "caption",
              size: 20,
              weight: 500,
              color: swap < 0.5 ? INK : GRAPHITE,
              fontFamily: "'DM Mono', ui-monospace, monospace",
              letterSpacing: 3,
            },
            before.label.toUpperCase(),
          ),
          Frame(
            { width: 140, height: 3, fill: `${GRAPHITE}44` },
            Frame({
              width: Math.max(1, arrowFill),
              height: 3,
              fill: accentColor,
              style: { opacity: arrowFill > 1 ? 1 : 0 },
            }),
          ),
          Text(
            {
              variant: "caption",
              size: 20,
              weight: 500,
              color: swap < 0.5 ? GRAPHITE : accentColor,
              fontFamily: "'DM Mono', ui-monospace, monospace",
              letterSpacing: 3,
            },
            after.label.toUpperCase(),
          ),
        ),
        ),
      ),
    );
  },
});
