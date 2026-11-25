// Hello, world — the smallest complete media program.
// A two-ink riso print: the bars register, the line lands, the page holds.
// Edit sample.title / sample.accent, then export.

import { video, Frame, Fill, Stack, Text, googleFont } from "@foxworth/superimg";

const PAPER = "#F1EBE1";
const INK = "#17140F";
const COOL = "#1B4A9B";

const SANS = "'Archivo', 'Helvetica Neue', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

export default video({
  duration: "5.5s",
  fonts: [googleFont("Archivo:wght@500;800"), googleFont("IBM+Plex+Mono:wght@400;500")],
  sample: {
    title: "Hello, world",
    accent: "#E2452B",
  },

  render(ctx) {
    const { std, width, height, data } = ctx;
    const { title, accent } = data;

    const t = ctx.director({ enter: "18%", hold: "66%", exit: "16%" });

    const s = Math.min(width / 1920, height / 1080);
    const px = (value: number) => Math.round(value * s);
    const margin = Math.round(width * 0.115);
    const barSpan = Math.round(width * 0.4);
    const barHeight = Math.round(height * 0.014);

    // Two ink passes, off by a beat — the misregistration is the picture.
    const warm = t.tween(0, 1, { id: "ink.warm", during: "enter", at: "0%", for: "44%", easing: "easeOutQuint" });
    const cool = t.tween(0, 1, { id: "ink.cool", during: "enter", at: "12%", for: "44%", easing: "easeOutQuint" });
    const label = t.motion({ id: "slug", during: "enter", at: "6%", for: "26%", y: -12 });
    const hero = t.motion({ id: "title", during: "enter", at: "22%", for: "34%", y: 34 });
    const note = t.motion({ id: "note", during: "enter", at: "46%", for: "30%", y: 16 });

    // Exit pulls the two passes apart before the page leaves.
    const part = std.interpolate(t.in("exit"), [0, 0.8], [0, 1], "easeInCubic");
    const inkOpacity = 1 - std.interpolate(t.in("exit"), [0.3, 1], [0, 1], "easeInCubic");

    return Frame(
      { id: "stage", width, height },
      Fill({ color: PAPER }),
      Frame(
        { id: "trim", x: margin - px(56), y: 0, width: 2, height },
        Fill({ color: std.color.alpha(INK, 0.1) }),
      ),
      Stack(
        {
          id: "page",
          width: "fill",
          height: "fill",
          justify: "center",
          pad: { x: margin },
          gap: 10,
        },
        Text(
          {
            id: "slug",
            variant: "label",
            size: px(22),
            weight: 500,
            color: std.color.alpha(INK, 0.5),
            letterSpacing: px(3),
            fontFamily: MONO,
            motion: label,
          },
          "hello-world.media.ts",
        ),
        Text(
          {
            id: "title",
            variant: "display",
            size: px(156),
            weight: 800,
            color: INK,
            letterSpacing: px(-6),
            lineHeight: 1.02,
            maxWidth: width - margin * 2,
            fontFamily: SANS,
            motion: hero,
          },
          title,
        ),
        Frame(
          { id: "rule", width: "fill", height: Math.round(barHeight * 4.2) },
          Fill({
            id: "ink-warm",
            x: -part * 44,
            y: barHeight,
            width: Math.max(2, Math.round(barSpan * warm)),
            height: barHeight,
            color: accent,
            opacity: inkOpacity,
          }),
          Fill({
            id: "ink-cool",
            x: Math.round(barSpan * 0.24) + part * 44,
            y: Math.round(barHeight * 1.9),
            width: Math.max(2, Math.round(barSpan * 0.62 * cool)),
            height: barHeight,
            color: COOL,
            opacity: inkOpacity,
            blendMode: "multiply",
          }),
        ),
        Text(
          {
            id: "note",
            variant: "body",
            size: px(30),
            weight: 400,
            color: std.color.alpha(INK, 0.62),
            fontFamily: MONO,
            motion: note,
          },
          "one file · a function of time · any destination",
        ),
      ),
    );
  },
});
