// Scene 2 — Midday. The sun keeps climbing from where scene one left it,
// three posts stand on the same horizon, and the copy finally has light.

import { video, Fill, Frame, Stack, Text } from "@foxworth/superimg";
import {
  DAWN,
  DAY,
  DISPLAY,
  FILM_FONTS,
  FILM_SAMPLE,
  type FilmData,
  MONO,
  mixHex,
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

const POSTS = [0.62, 1, 0.78];
const DURATION_SECONDS = 6;

export default video<FilmData>({
  duration: `${DURATION_SECONDS}s`,
  fonts: FILM_FONTS,
  sample: FILM_SAMPLE,

  render(ctx) {
    const { std, width, height, data } = ctx;
    const g = geometry(width, height);

    const t = ctx.director({ climb: "20%", read: "20%", hold: "60%" });

    const climbP = std.interpolate(t.in("climb"), [0, 1], [0, 1], "easeOutCubic");
    const paint = mixSky(DAWN, DAY, std.interpolate(t.in("climb"), [0, 0.75], [0, 1], "easeOutCubic"));
    const disc = lerpSun(sunKey(g, width, height, "low"), sunKey(g, width, height, "high"), climbP);

    const label = t.motion({ id: "slug", during: "climb", at: "36%", for: "44%", y: -14, exit: false });
    const heading = t.motion({ id: "heading", during: "read", at: "0%", for: "42%", y: 26, exit: false });
    const body = t.motion({ id: "body", during: "read", at: "20%", for: "42%", y: 18, exit: false });
    const postP = std.stagger.ms(POSTS.length, t.in("climb"), {
      windowSeconds: t.clip({ during: "climb" }).durationSeconds,
      eachMs: 90,
      capMs: 320,
    });

    const postWidth = Math.round(30 * g.s);
    const postGap = Math.round(38 * g.s);
    const tallest = Math.round(260 * g.s);
    const postsRight = width - g.margin;
    const postsLeft = postsRight - (postWidth * POSTS.length + postGap * (POSTS.length - 1));

    return Frame(
      { id: "stage", width, height },
      sky(paint),
      sun(g, width, { ...disc, color: mixHex(data.accentColor, "#FFF3DC", climbP) }),
      ground(g, width, height, paint),
      horizon(g, { x: 0, width, color: std.color.alpha(paint.ink, 0.9) }),
      Frame(
        { id: "posts", x: postsLeft, y: 0, width: postsRight - postsLeft, height: g.horizonY },
        ...POSTS.map((scale, i) => {
          const p = std.interpolate(postP[i] ?? 1, [0, 1], [0, 1], "easeOutQuint");
          const drawn = Math.max(2, Math.round(tallest * scale * p));
          return Fill({
            x: i * (postWidth + postGap),
            y: g.horizonY - drawn,
            width: postWidth,
            height: drawn,
            color: i === 1 ? "#C4562F" : paint.land,
          });
        }),
      ),
      Frame(
        { id: "copy", x: g.margin, y: 0, width: Math.round(width * 0.46), height: g.horizonY },
        Stack(
          {
            width: "fill",
            height: "fill",
            justify: "end",
            gap: Math.round(22 * g.s),
            pad: { bottom: Math.round(56 * g.s) },
          },
          Text(
            {
              id: "heading",
              variant: "display",
              size: Math.round(88 * g.s),
              weight: 400,
              lineHeight: 1.06,
              letterSpacing: Math.round(-1 * g.s),
              maxWidth: Math.round(width * 0.46),
              color: paint.ink,
              fontFamily: DISPLAY,
              motion: heading,
            },
            data.heading,
          ),
          Text(
            {
              id: "body",
              variant: "body",
              size: Math.round(26 * g.s),
              weight: 400,
              lineHeight: 1.55,
              maxWidth: Math.round(width * 0.42),
              color: std.color.alpha(paint.ink, 0.66),
              fontFamily: MONO,
              motion: body,
            },
            data.body,
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
        Stack(
          { direction: "row", width: "fill", height: "fill", align: "center", justify: "space-between" },
          slug(g, "02 / MIDDAY", std.color.alpha(paint.ink, 0.5), label),
          data.brandName
            ? Text(
                {
                  id: "brand",
                  variant: "label",
                  size: Math.round(21 * g.s),
                  weight: 500,
                  letterSpacing: Math.round(4 * g.s),
                  color: std.color.alpha(paint.ink, 0.5),
                  fontFamily: MONO,
                  motion: label,
                },
                data.brandName.toUpperCase(),
              )
            : null,
        ),
      ),
    );
  },
});
