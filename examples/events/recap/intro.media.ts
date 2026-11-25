// Recap · scene 1 — the slate. Establishes the film, the night, and the place.

import { video, Frame, Text, Html, type RenderContext } from "@foxworth/superimg";
import { chrome, picture, CREAM, PINK, DISPLAY, MONO, RECAP_CSS, RECAP_FONTS } from "./recap-kit.js";

export interface RecapIntroData extends Record<string, unknown> {
  kicker: string;
  eventName: string;
  dateLine: string;
  reel: string;
}

export default video<RecapIntroData>({
  duration: "3.6s",
  fps: 30,
  fonts: RECAP_FONTS,
  inlineCss: RECAP_CSS,
  sample: {
    kicker: "TECHLAHOMA · OKLAHOMA CITY",
    eventName: "Coffee & Code",
    dateLine: "March 18 · 8th Street Market",
    reel: "REEL 03 · 2026",
  },

  render(ctx: RenderContext<RecapIntroData>) {
    const { std, width, height, data } = ctx;
    const s = Math.min(width, height) / 1080;
    const px = (n: number) => Math.round(n * s);
    const alpha = (c: string, a: number) => std.color.alpha(c, a);

    const t = ctx.director({ slate: "42%", title: "58%" });
    const slate = t.in("slate");
    const title = t.in("title");
    const reveal = std.interpolate(slate, [0, 0.35], [0, 1], "easeOutCubic");

    // A strip of stills runs behind the slate, out of focus.
    const stripY = Math.round(height * 0.5 - px(150));
    const tileW = px(300);
    const tileH = px(300);
    const drift = -std.interpolate(ctx.timeline.progress, [0, 1], [0, tileW * 1.4], "linear");
    const strip = Array.from({ length: 9 }, (_, i) =>
      Frame(
        {
          x: Math.round(-tileW + i * (tileW + px(18)) + drift),
          y: stripY + (i % 3) * px(26) - px(26),
          width: tileW,
          height: tileH,
          radius: px(3),
          style: {
            opacity: 0.16 * reveal,
            filter: `blur(${px(5)}px)`,
          },
        },
        Html({ width: tileW, height: tileH, html: picture(`intro-${i}`, tileW, tileH) }),
      ),
    );

    const wipe = std.interpolate(slate, [0.1, 0.8], [0, 1], "easeInOutCubic");
    const lift = (p: number) => `translateY(${((1 - p) * px(120)).toFixed(1)}px)`;
    const l1 = std.interpolate(title, [0, 0.44], [0, 1], "easeOutQuint");
    const l2 = std.interpolate(title, [0.12, 0.58], [0, 1], "easeOutQuint");
    const kick = std.interpolate(slate, [0.35, 0.9], [0, 1], "easeOutCubic");

    const nameSize = px(178);
    const centerY = Math.round(height * 0.5);

    return Frame(
      { id: "stage", width, height },
      ...chrome({
        width,
        height,
        px,
        alpha,
        sceneNo: "01",
        sceneLabel: "SLATE",
        reel: data.reel,
        progress: ctx.timeline.progress * 0.26,
        reveal,
      }),
      ...strip,
      // the pink bar that the title sits on
      Frame({
        x: 0,
        y: centerY - px(122),
        width,
        height: px(250),
        fill: alpha(PINK, 0.14),
        style: { transformOrigin: "left center", transform: `scaleX(${wipe.toFixed(4)})` },
      }),
      Frame(
        { x: px(150), y: centerY - px(196), width: width - px(300), height: px(30), style: { opacity: kick } },
        Text(
          { variant: "label", size: px(20), weight: 600, letterSpacing: px(6), fontFamily: MONO, color: PINK },
          data.kicker,
        ),
      ),
      // title — masked lift, one line at a time
      Frame(
        { x: px(150), y: centerY - px(146), width: width - px(300), height: px(200), style: { overflow: "hidden" } },
        Frame(
          { x: 0, y: 0, width: width - px(300), height: px(200), style: { transform: lift(l1), opacity: l1 } },
          Text(
            {
              variant: "display",
              size: nameSize,
              weight: 400,
              letterSpacing: px(-6),
              lineHeight: 1,
              fontFamily: DISPLAY,
              color: CREAM,
            },
            data.eventName.toUpperCase(),
          ),
        ),
      ),
      Frame(
        { x: px(150), y: centerY + px(72), width: width - px(300), height: px(60), style: { overflow: "hidden" } },
        Frame(
          { x: 0, y: 0, width: width - px(300), height: px(60), style: { transform: lift(l2), opacity: l2 } },
          Text(
            { variant: "title", size: px(34), weight: 500, letterSpacing: px(1), color: alpha(CREAM, 0.72) },
            data.dateLine,
          ),
        ),
      ),
      // the word that names the film, set as an outline behind everything
      Frame(
        {
          x: px(150),
          y: centerY + px(150),
          width: width - px(300),
          height: px(120),
          style: {
            opacity: std.interpolate(title, [0.3, 1], [0, 1], "easeOutCubic"),
          },
        },
        Text(
          {
            variant: "display",
            size: px(112),
            weight: 400,
            letterSpacing: px(24),
            lineHeight: 1,
            fontFamily: DISPLAY,
            color: "transparent",
            style: { WebkitTextStroke: `${px(2)}px ${alpha(CREAM, 0.34)}` },
          },
          "RECAP",
        ),
      ),
    );
  },
});
