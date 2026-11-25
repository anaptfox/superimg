// Scene 3 — Dusk. The sun goes down and the horizon collapses into the
// underline of the last line. Then the film leaves.

import { video, Frame, Stack, Text } from "@foxworth/superimg";
import {
  DAY,
  DISPLAY,
  DUSK,
  FILM_FONTS,
  FILM_SAMPLE,
  type FilmData,
  geometry,
  ground,
  horizon,
  lerpSun,
  mixSky,
  sky,
  slug,
  sun,
  sunKey,
} from "./film";

export default video<FilmData>({
  duration: "2.4s",
  fonts: FILM_FONTS,
  sample: FILM_SAMPLE,

  render(ctx) {
    const { std, width, height, data } = ctx;
    const g = geometry(width, height);

    const t = ctx.director({ fall: "42%", hold: "38%", out: "20%" });

    const fallP = std.interpolate(t.in("fall"), [0, 1], [0, 1], "easeInOutCubic");
    const paint = mixSky(DAY, DUSK, std.interpolate(t.in("fall"), [0, 0.8], [0, 1], "easeOutCubic"));
    const disc = lerpSun(sunKey(g, width, height, "high"), sunKey(g, width, height, "set"), fallP);

    const label = t.motion({ id: "slug", during: "fall", at: "0%", for: "34%", y: -14 });
    const cta = t.motion({ id: "cta", during: "fall", at: "38%", for: "54%", y: 24 });

    // The full-width horizon contracts until it is only as wide as the last line.
    const underline = Math.round(width * 0.42);
    const lineWidth = std.interpolate(fallP, [0, 1], [width, underline]);
    const lineX = (width - lineWidth) / 2;

    const leave = std.interpolate(t.in("out"), [0, 1], [0, 1], "easeInCubic");

    return Frame(
      { id: "stage", width, height, style: { opacity: 1 - leave * 0.94 } },
      sky(paint),
      sun(g, width, { ...disc, color: data.accentColor }),
      ground(g, width, height, paint),
      horizon(g, {
        x: lineX,
        width: lineWidth,
        color: std.color.alpha(paint.ink, 0.9),
        thickness: 3,
      }),
      Frame(
        { id: "titles", x: 0, y: 0, width, height: g.horizonY },
        Stack(
          {
            width: "fill",
            height: "fill",
            justify: "end",
            align: "center",
            pad: { bottom: Math.round(40 * g.s) },
          },
          Text(
            {
              id: "cta",
              variant: "display",
              size: Math.round(112 * g.s),
              weight: 400,
              align: "center",
              lineHeight: 1.0,
              letterSpacing: Math.round(-1 * g.s),
              color: paint.ink,
              fontFamily: DISPLAY,
              motion: cta,
            },
            data.cta,
          ),
        ),
      ),
      Frame(
        {
          id: "rail",
          x: g.margin,
          y: Math.round(72 * g.s),
          width: width - g.margin * 2,
          height: Math.round(30 * g.s),
        },
        slug(g, "03 / DUSK", std.color.alpha(paint.ink, 0.5), label),
      ),
    );
  },
});
