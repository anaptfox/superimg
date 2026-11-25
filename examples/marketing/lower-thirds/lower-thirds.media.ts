// Lower Thirds — a risograph paper slab keyed over footage.
// Film: bone stock, ink type, one terracotta bar, deliberate misregistration.
// Background stays transparent so this can be composited straight onto video.

import {
  video,
  Frame,
  Stack,
  Text,
  Safe,
  type MediaChild,
  type MediaElement,
  googleFont,
} from "@foxworth/superimg";

export interface LowerThirdData extends Record<string, unknown> {
  name: string;
  title: string;
  accentColor: string;
}

const PAPER = "#F2ECE1";
const INK = "#17140F";

/** This lower-third lockup is a local overlay recipe built from the layout kernel. */
function LowerThirdSlab(...children: MediaChild[]): MediaElement {
  return Stack(
    { id: "overlay-placement", width: "fill", height: "fill", justify: "end", align: "start" },
    Frame({ id: "lower-third" }, ...children),
  );
}

export default video<LowerThirdData>({
  duration: "4s",
  size: { width: 1920, height: 1080 },
  editions: {
    portrait: { size: { width: 1080, height: 1920 } },
  },
  fonts: [googleFont("Archivo:wght@500;700;800"), googleFont("DM+Mono:wght@400;500")],
  inlineCss: [`html, body { background: transparent; margin: 0; }`],
  sample: {
    name: "Jane Doe",
    title: "Senior Engineer, Acme Corp",
    accentColor: "#C8452F",
  },
  render(ctx) {
    const { std, isPortrait, data } = ctx;
    const { name, title, accentColor } = data;

    const nameSize = isPortrait ? 46 : 58;
    const titleSize = isPortrait ? 22 : 26;
    const padH = isPortrait ? 26 : 38;
    const padV = isPortrait ? 20 : 26;
    const barW = isPortrait ? 12 : 16;
    const slabW = isPortrait ? 620 : 900;
    const slabH = isPortrait ? 132 : 158;

    const t = ctx.director({ enter: "0.85s", hold: "2.5s", exit: "0.65s" });

    // Four beats: bar grows, paper unrolls, name rises, title follows.
    const enter = std.stagger.ms(4, t.in("enter"), {
      windowSeconds: 0.85,
      eachMs: 70,
      capMs: 280,
    });
    const exit = std.stagger.ms(4, t.in("exit"), {
      windowSeconds: 0.65,
      eachMs: 45,
      capMs: 180,
      from: "end",
      easing: "easeInCubic",
    });

    const beat = (i: number) => std.clamp01(enter[i]! - exit[i]!);

    const barGrow = std.interpolate(enter[0]!, [0, 1], [0, 1], "easeOutExpo");
    const barShrink = std.interpolate(exit[0]!, [0, 1], [0, 1], "easeInCubic");
    const barScale = Math.max(0.001, barGrow - barShrink);

    // Paper unrolls left→right, then rolls back the same way on exit.
    const unroll = std.interpolate(enter[1]!, [0, 1], [0, 1], "easeOutExpo");
    const reroll = std.interpolate(exit[1]!, [0, 1], [0, 1], "easeInCubic");
    const paperCut = (1 - Math.max(0, unroll - reroll)) * 100;

    const nameY = std.interpolate(beat(2), [0, 1], [18, 0], "easeOutCubic");
    const titleY = std.interpolate(beat(3), [0, 1], [12, 0], "easeOutCubic");

    // Riso misregistration: the ink plate settles onto the accent plate late.
    const slip = std.interpolate(beat(2), [0, 1], [7, 0], "easeOutCubic");
    const ruleW = Math.round((slabW - padH * 2) * beat(3));

    return Frame(
      { id: "stage", width: "fill", height: "fill" },
      Safe(
        { preset: "broadcast" },
        LowerThirdSlab(
          Stack(
            { direction: "row", align: "stretch", height: slabH },
            Frame({
              width: barW,
              height: slabH,
              fill: accentColor,
              style: {
                transformOrigin: "50% 100%",
                transform: `scaleY(${barScale.toFixed(4)})`,
              },
            }),
            Frame(
              {
                id: "slab",
                width: slabW,
                height: slabH,
                fill: PAPER,
                overflow: "hidden",
                pad: { x: padH, y: padV },
                style: { clipPath: `inset(0 ${paperCut.toFixed(2)}% 0 0)` },
              },
              Frame({
                x: slabW - padH - 14,
                y: 0,
                width: 14,
                height: 14,
                fill: accentColor,
                style: { opacity: beat(1) * 0.85 },
              }),
              Stack(
                {
                  direction: "column",
                  align: "start",
                  justify: "center",
                  gap: isPortrait ? 8 : 10,
                },
                Frame(
                  { width: slabW - padH * 2, height: nameSize * 1.15 },
                  Text(
                    {
                      variant: "title",
                      size: nameSize,
                      weight: 800,
                      color: accentColor,
                      fontFamily: "'Archivo', system-ui, sans-serif",
                      letterSpacing: -1,
                      style: {
                        opacity: beat(2) * 0.55,
                        transform: `translate(${slip.toFixed(2)}px, ${(nameY + slip * 0.4).toFixed(2)}px)`,
                      },
                    },
                    name,
                  ),
                  Text(
                    {
                      variant: "title",
                      size: nameSize,
                      weight: 800,
                      color: INK,
                      fontFamily: "'Archivo', system-ui, sans-serif",
                      letterSpacing: -1,
                      style: {
                        opacity: beat(2),
                        transform: `translateY(${nameY.toFixed(2)}px)`,
                      },
                    },
                    name,
                  ),
                ),
                Frame({
                  width: Math.max(1, ruleW),
                  height: 2,
                  fill: `${INK}33`,
                  style: { opacity: ruleW > 1 ? 1 : 0 },
                }),
                Text(
                  {
                    variant: "caption",
                    size: titleSize,
                    weight: 500,
                    color: `${INK}B8`,
                    fontFamily: "'DM Mono', ui-monospace, monospace",
                    letterSpacing: 2,
                    style: {
                      opacity: beat(3),
                      transform: `translateY(${titleY.toFixed(2)}px)`,
                    },
                  },
                  title.toUpperCase(),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  },
});
