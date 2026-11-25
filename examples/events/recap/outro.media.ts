// Recap · scene 3 — the tail: thank the room, name the next one, then end frame.

import { video, Frame, Text, Html, type RenderContext } from "@foxworth/superimg";
import { chrome, picture, CREAM, PINK, SUN, DISPLAY, MONO, RECAP_CSS, RECAP_FONTS } from "./recap-kit.js";

export interface RecapOutroData extends Record<string, unknown> {
  thanks: string;
  nextLine: string;
  url: string;
  reel: string;
}

export default video<RecapOutroData>({
  duration: "3.4s",
  fps: 30,
  poster: "3s",
  fonts: RECAP_FONTS,
  inlineCss: RECAP_CSS,
  sample: {
    thanks: "Thanks for coming",
    nextLine: "Next: April 15 · Same corner table",
    url: "meetup.com/techlahoma",
    reel: "REEL 03 · 2026",
  },

  render(ctx: RenderContext<RecapOutroData>) {
    const { std, width, height, data } = ctx;
    const s = Math.min(width, height) / 1080;
    const px = (n: number) => Math.round(n * s);
    const alpha = (c: string, a: number) => std.color.alpha(c, a);

    const t = ctx.director({ land: "44%", hold: "56%" });
    const land = t.in("land");
    const hold = t.in("hold");

    const centerY = Math.round(height * 0.5);
    const thanksIn = std.interpolate(land, [0, 0.55], [0, 1], "easeOutQuint");
    const nextIn = std.interpolate(land, [0.3, 0.9], [0, 1], "easeOutCubic");
    const urlIn = std.interpolate(hold, [0, 0.4], [0, 1], "easeOutCubic");
    const stampIn = std.interpolate(hold, [0.18, 0.62], [0, 1], "easeOutQuint");

    // The last three frames of the reel settle into a little stack.
    const tileW = px(240);
    const tileH = px(168);
    const stack = [0, 1, 2].map((i) => {
      const p = std.interpolate(land, [0.1 + i * 0.12, 0.7 + i * 0.12], [0, 1], "easeOutCubic");
      const rot = [-7, 3, 9][i]!;
      return Frame(
        {
          x: Math.round(width - px(150) - tileW - i * px(26)),
          y: Math.round(centerY - tileH / 2 + i * px(34)),
          width: tileW,
          height: tileH,
          radius: px(3),
          style: {
            opacity: p * 0.9,
            transformOrigin: "center center",
            transform: `rotate(${(rot * p).toFixed(2)}deg) translateY(${((1 - p) * px(40)).toFixed(1)}px)`,
            boxShadow: `0 ${px(18)}px ${px(40)}px rgba(0,0,0,0.42)`,
          },
        },
        Html({ width: tileW, height: tileH, html: picture(`tail-${i}`, tileW, tileH) }),
      );
    });

    return Frame(
      { id: "stage", width, height },
      ...chrome({
        width,
        height,
        px,
        alpha,
        sceneNo: "03",
        sceneLabel: "TAIL",
        reel: data.reel,
        progress: 0.81 + ctx.timeline.progress * 0.19,
        reveal: 1,
      }),
      ...stack,
      Frame({
        x: px(150),
        y: centerY - px(126),
        width: px(96),
        height: px(8),
        fill: PINK,
        style: { transformOrigin: "left center", transform: `scaleX(${thanksIn.toFixed(3)})` },
      }),
      Frame(
        {
          x: px(150),
          y: centerY - px(96),
          width: Math.round(width * 0.72),
          height: px(140),
          style: { overflow: "hidden" },
        },
        Frame(
          {
            x: 0,
            y: 0,
            width: Math.round(width * 0.72),
            height: px(140),
            style: {
              opacity: thanksIn,
              transform: `translateY(${((1 - thanksIn) * px(110)).toFixed(1)}px)`,
            },
          },
          Text(
            {
              variant: "display",
              size: px(96),
              weight: 400,
              letterSpacing: px(-4),
              lineHeight: 1,
              fontFamily: DISPLAY,
              color: CREAM,
            },
            data.thanks.toUpperCase(),
          ),
        ),
      ),
      Frame(
        {
          x: px(150),
          y: centerY + px(62),
          width: Math.round(width * 0.58),
          height: px(44),
          style: { opacity: nextIn, transform: `translateY(${((1 - nextIn) * px(18)).toFixed(1)}px)` },
        },
        Text(
          { variant: "title", size: px(34), weight: 500, letterSpacing: px(0.4), color: alpha(CREAM, 0.74) },
          data.nextLine,
        ),
      ),
      Frame(
        {
          x: px(150),
          y: centerY + px(128),
          width: Math.round(width * 0.5),
          height: px(34),
          style: { opacity: urlIn },
        },
        Text(
          { variant: "label", size: px(24), weight: 600, letterSpacing: px(2.2), fontFamily: MONO, color: SUN },
          data.url,
        ),
      ),
      // end-of-reel mark
      Frame(
        {
          x: px(150),
          y: centerY + px(196),
          width: px(230),
          height: px(46),
          radius: px(4),
          style: {
            opacity: stampIn,
            boxShadow: `inset 0 0 0 ${px(2)}px ${alpha(CREAM, 0.34)}`,
            transform: `scale(${std.interpolate(stampIn, [0, 1], [1.08, 1]).toFixed(3)})`,
          },
        },
        Frame(
          { x: px(18), y: px(14), width: px(200), height: px(20) },
          Text(
            { variant: "label", size: px(16), weight: 600, letterSpacing: px(4), fontFamily: MONO, color: alpha(CREAM, 0.62) },
            "END OF REEL",
          ),
        ),
      ),
    );
  },
});
