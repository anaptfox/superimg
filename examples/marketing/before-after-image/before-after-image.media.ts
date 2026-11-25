// Before / After (image) — a gallery wall with one matted print.
// Film: warm-black room, a single pool of light, bone mat, brick-red plate.
// Two transitions, both implemented: `wipe` drags a handle across one print,
// `split` hangs the pair and hands the light from left to right.

import { video, Frame, Fill, Stack, Text, Image, type MediaElement, type RenderContext, googleFont } from "@foxworth/superimg";
import { plate } from "./plates";

export type TransitionStyle = "wipe" | "split";

export interface ImageContent {
  /** Inline data URI — generated at author time, never fetched. */
  url: string;
  label: string;
}

export interface BeforeAfterImageData extends Record<string, unknown> {
  before: ImageContent;
  after: ImageContent;
  title: string;
  transition: TransitionStyle;
  accentColor: string;
}

const WALL = "#191512";
const WALL_DEEP = "#0C0A09";
const MAT = "#D3C9B8";
const CHALK = "#EDE6D9";
const DUST = "#8E8477";

function print(id: string, url: string, width: number, height: number, mat: number, radius: number): MediaElement {
  return Frame({ id, width, height, fill: MAT, radius, pad: mat,
    style: { boxShadow: "0 34px 70px rgba(0,0,0,0.55), 0 2px 0 rgba(255,255,255,0.08) inset" } },
    Image({ id: `${id}-image`, src: url, fit: "cover", width: "fill", height: "fill" }),
  );
}

export default video<BeforeAfterImageData>({
  duration: "6s",
  poster: "4.6s",
  fonts: [googleFont("Archivo:wght@600;800"), googleFont("DM+Mono:wght@400;500")],
  sample: {
    title: "Colour grade",
    before: { url: plate("flat"), label: "1998 scan" },
    after: { url: plate("graded"), label: "2024 grade" },
    transition: "wipe",
    accentColor: "#B8502E",
  },
  variants: {
    split: { transition: "split" },
  },
  render(ctx: RenderContext<BeforeAfterImageData>) {
    const { std, width, height, data } = ctx;
    const { title, before, after, transition, accentColor } = data;

    const t = ctx.director({
      hang: "15%",
      read: "19%",
      pull: "28%",
      settle: "26%",
      out: "12%",
    });

    const hangP = t.in("hang");
    const pullP = t.in("pull");
    const settleP = t.in("settle");
    const outP = t.in("out");

    // 0 = before, 1 = after. Monotonic across pull, then locked.
    const swap =
      settleP > 0 || outP > 0
        ? 1
        : std.interpolate(pullP, [0, 1], [0, 1], "easeInOutCubic");

    const hangMotion = t.motion({
      id: "print",
      during: "hang",
      at: "0%",
      for: "80%",
      y: 42,
      scale: 0.97,
    });
    const titleMotion = t.motion({ id: "title", during: "hang", at: "10%", for: "70%", y: 16 });

    const fade = 1 - std.interpolate(outP, [0, 1], [0, 1], "easeInCubic");
    const lift = std.interpolate(outP, [0, 1], [0, -18], "easeInCubic");

    const pad = Math.round(width * 0.075);
    const headH = Math.round(height * 0.13);
    const plateH = Math.round(height * 0.11);
    const stageW = width - pad * 2;
    const stageH = height - headH - plateH - Math.round(height * 0.06);
    const mat = Math.round(Math.min(stageW, stageH) * 0.035);
    const radius = Math.round(mat * 0.5);

    let art: MediaElement;
    if (transition === "split") {
      const gap = Math.round(stageW * 0.035);
      const half = Math.round((stageW - gap) / 2);
      const halfH = Math.round(Math.min(stageH, half * 0.68));
      const top = Math.round((stageH - halfH) / 2);
      const dim = (on: number) => ({
        filter: `saturate(${0.55 + on * 0.45}) brightness(${0.62 + on * 0.38})`,
        transform: `scale(${0.975 + on * 0.025})`, transformOrigin: "50% 50%",
      });
      art = Frame({ width: stageW, height: stageH },
        Frame({ x: 0, y: top, width: half, height: halfH, style: dim(1 - swap) }, print("before", before.url, half, halfH, mat, radius)),
        Frame({ x: half + gap, y: top, width: half, height: halfH, style: dim(swap) }, print("after", after.url, half, halfH, mat, radius)),
        Fill({ x: half + gap / 2 - 1, y: top + halfH * 0.18, width: 2, height: halfH * 0.64, color: `${DUST}55` }),
      );
    } else {
      const frameH = Math.round(Math.min(stageH, stageW * 0.54));
      const top = Math.round((stageH - frameH) / 2);
      const cut = stageW * swap;
      const gripY = top + frameH / 2;
      const moving = swap > 0.001 && swap < 0.999;
      art = Frame({ width: stageW, height: stageH },
        Frame({ y: top, width: stageW, height: frameH }, print("before", before.url, stageW, frameH, mat, radius)),
        Frame({ y: top, width: stageW, height: frameH, style: { clipPath: `inset(0 ${stageW - cut}px 0 0)` } }, print("after", after.url, stageW, frameH, mat, radius)),
        Fill({ id: "handle-line", x: cut - 1, y: top - 10, width: 2, height: frameH + 20, color: CHALK, style: { opacity: moving ? 0.9 : 0 } }),
        Fill({ id: "handle", x: cut - 17, y: gripY - 17, width: 34, height: 34, radius: "50%", color: CHALK, style: { opacity: moving ? 1 : 0, boxShadow: "0 6px 18px rgba(0,0,0,0.55)" } }),
        Fill({ id: "handle-dot", x: cut - 5, y: gripY - 5, width: 10, height: 10, radius: "50%", color: accentColor, style: { opacity: moving ? 1 : 0 } }),
      );
    }

    const labelRow = (text: string, on: number, active: boolean) =>
      Stack(
        { direction: "column", align: active ? "end" : "start", gap: 8 },
        Text(
          {
            variant: "label",
            size: 22,
            weight: 500,
            color: active ? accentColor : DUST,
            fontFamily: "'DM Mono', ui-monospace, monospace",
            letterSpacing: 6,
            style: { opacity: 0.35 + on * 0.65 },
          },
          text.toUpperCase(),
        ),
        Frame({
          width: Math.max(1, Math.round(120 * on)),
          height: 2,
          fill: active ? accentColor : DUST,
          style: { opacity: on > 0.02 ? 1 : 0 },
        }),
      );

    return Frame(
      { id: "room", width: "fill", height: "fill" },
      Fill({
        gradient: {
          kind: "radial",
          at: "50% 26%",
          size: "95% 85%",
          stops: [`${WALL} 0%`, `${WALL_DEEP} 100%`],
        },
      }),
      Frame(
        {
          id: "sheet",
          x: pad,
          y: Math.round(height * 0.045),
          width: stageW,
          height: height - Math.round(height * 0.09),
          style: { opacity: fade, transform: `translateY(${lift.toFixed(2)}px)` },
        },
        Stack(
          { direction: "column", width: stageW, height: headH, justify: "center", gap: 12 },
          Text(
            {
              variant: "title",
              size: Math.round(height * 0.052),
              weight: 800,
              color: CHALK,
              fontFamily: "'Archivo', system-ui, sans-serif",
              letterSpacing: -1,
              motion: titleMotion,
            },
            title,
          ),
          Stack(
            { direction: "row", width: stageW, justify: "space-between", align: "start" },
            labelRow(before.label, 1 - swap, false),
            labelRow(after.label, swap, true),
          ),
        ),
        Frame(
          {
            id: "stage",
            x: 0,
            y: headH,
            width: stageW,
            height: stageH,
            motion: hangMotion,
          },
          art,
        ),
        Frame({ id: "footer", y: headH + stageH, width: stageW, height: plateH },
        Stack(
          {
            direction: "row",
            width: stageW,
            height: plateH,
            align: "center",
            justify: "space-between",
            style: { opacity: 0.35 + hangP * 0.65 },
          },
          Text(
            {
              variant: "caption",
              size: 19,
              weight: 400,
              color: DUST,
              fontFamily: "'DM Mono', ui-monospace, monospace",
              letterSpacing: 3,
            },
            transition === "split" ? "HUNG AS A PAIR" : "ONE PRINT, ONE PASS",
          ),
          Text(
            {
              variant: "caption",
              size: 19,
              weight: 500,
              color: `${CHALK}99`,
              fontFamily: "'DM Mono', ui-monospace, monospace",
              letterSpacing: 3,
            },
            `${Math.round(swap * 100)}%`,
          ),
        ),
        ),
      ),
    );
  },
});
