// Scene 1 — First light. The sun clears the land and the title comes up with it.

import { video, Frame, Stack, Text } from "@foxworth/superimg";
import {
  DAWN,
  DISPLAY,
  FILM_FONTS,
  FILM_SAMPLE,
  type FilmData,
  geometry,
  ground,
  horizon,
  lerpSun,
  sky,
  slug,
  sun,
  sunKey,
} from "./film";

export default video<FilmData>({
  duration: "2.2s",
  fonts: FILM_FONTS,
  sample: FILM_SAMPLE,

  render(ctx) {
    const { std, width, height, data } = ctx;
    const g = geometry(width, height);

    // Last act holds — the cut into scene two is the exit.
    const t = ctx.director({ rise: "48%", hold: "52%" });

    const riseP = std.interpolate(t.in("rise"), [0, 1], [0, 1], "easeOutCubic");
    const lineP = t.tween(0, 1, {
      id: "horizon",
      during: "rise",
      at: "0%",
      for: "70%",
      easing: "easeOutQuint",
    });
    const label = t.motion({ id: "slug", during: "rise", at: "6%", for: "40%", y: -14, exit: false });
    const heading = t.motion({ id: "title", during: "rise", at: "30%", for: "60%", y: 46, exit: false });

    const disc = lerpSun(sunKey(g, width, height, "under"), sunKey(g, width, height, "low"), riseP);

    return Frame(
      { id: "stage", width, height },
      sky(DAWN),
      sun(g, width, { ...disc, color: data.accentColor }),
      ground(g, width, height, DAWN),
      horizon(g, { x: 0, width: width * lineP, color: std.color.alpha(DAWN.ink, 0.85) }),
      Frame(
        { id: "titles", x: g.margin, y: 0, width: width - g.margin * 2, height: g.horizonY },
        Stack(
          { width: "fill", height: "fill", justify: "end", pad: { bottom: Math.round(56 * g.s) } },
          Text(
            {
              id: "title",
              variant: "display",
              size: Math.round(148 * g.s),
              weight: 400,
              lineHeight: 1.0,
              letterSpacing: Math.round(-2 * g.s),
              color: DAWN.ink,
              fontFamily: DISPLAY,
              motion: heading,
            },
            data.title,
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
        slug(g, "01 / FIRST LIGHT", std.color.alpha(DAWN.ink, 0.55), label),
      ),
    );
  },
});
