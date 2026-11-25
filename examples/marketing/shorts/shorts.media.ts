// Shorts — a 9:16 title built like a screen-printed poster: flat acid field,
// ink type wiped in behind a hard edge, and a ticker that floods the frame on
// the way out. Designed for the vertical column, not cropped from a 16:9.

import { video, Fill, Frame, Stack, Text, googleFont } from "@foxworth/superimg";

export interface ShortsData extends Record<string, unknown> {
  title: string;
  subtitle: string;
  accentColor: string;
}

const ACID = "#E4FF3F";
const INK = "#111208";
const TICKER_SEGMENT = 920;
const TICKER_SPEED = 96; // px per second, linear — the one place linear belongs
const TITLE_SIZE = 132;

export default video<ShortsData>({
  duration: "6s",
  size: { width: 1080, height: 1920 },
  fonts: [googleFont("Syne:wght@700;800"), googleFont("Space+Mono:wght@400;700")],
  sample: {
    title: "One file. Every format.",
    subtitle: "Programmatic video for people who ship",
    accentColor: "#FF3B1F",
  },

  render(ctx) {
    const { std, width, height, timeline, data } = ctx;
    const { title, subtitle, accentColor } = data;

    const t = ctx.director({
      rail: "12%",
      wipe: "22%",
      tag: "16%",
      hold: "36%",
      flood: "14%",
    });

    const margin = Math.round(width * 0.089);
    const columnWidth = width - margin * 2;
    const tickerCopies = Math.ceil(width / TICKER_SEGMENT) + 2;
    const barHeight = Math.round(120 * (height / 1920));

    const railIn = t.motion({ id: "rail", during: "rail", at: "0%", for: "70%", y: -18, exit: false });
    const wipeP = std.interpolate(t.in("wipe"), [0, 1], [0, 1], "easeOutQuint");
    const tagIn = t.motion({ id: "tag", during: "tag", at: "0%", for: "52%", y: 20, exit: false });
    const ruleP = std.interpolate(t.in("tag"), [0.25, 1], [0, 1], "easeOutQuint");

    // The ticker bar becomes the exit: ink floods up and the type rides out.
    const flood = std.interpolate(t.in("flood"), [0, 1], [0, 1], "easeInCubic");
    const barTop = Math.round(height - barHeight - (height - barHeight) * flood);
    const barBox = height - barTop;
    const tickerOffset = (timeline.seconds * TICKER_SPEED) % TICKER_SEGMENT;

    const titleWidth = Math.max(2, Math.round(columnWidth * wipeP));
    const edgeVisible = wipeP > 0.01 && wipeP < 0.995;

    // Size the wipe box to the copy so the leading edge never outruns the type.
    const perLine = Math.max(6, Math.floor(columnWidth / (TITLE_SIZE * 0.52)));
    // Reserve at least three lines for the wide Syne display face.
    const titleLines = Math.max(3, Math.ceil(title.length / perLine));
    const titleBox = Math.round(TITLE_SIZE * 0.98 * (titleLines + 0.35));

    return Frame(
      { id: "stage", width, height },
      Fill({ color: ACID }),
      Frame(
        { id: "rail", x: margin, y: Math.round(height * 0.13), width: columnWidth, height: 34 },
        Stack(
          { direction: "row", width: "fill", height: "fill", align: "center", gap: 16 },
          Fill({ width: 18, height: 18, color: accentColor }),
          Text(
            {
              id: "slug",
              variant: "label",
              size: 24,
              weight: 700,
              letterSpacing: 6,
              color: INK,
              fontFamily: "'Space Mono', ui-monospace, monospace",
              motion: railIn,
            },
            `SHORTS · ${width}×${height}`,
          ),
        ),
      ),
      // Hard-edge wipe: the headline is uncovered left to right behind a bar.
      Frame(
        { id: "headline", x: margin, y: Math.round(height * 0.3), width: columnWidth, height: titleBox },
        Frame(
          { width: titleWidth, height: titleBox, overflow: "hidden" },
          Frame(
            { width: columnWidth, height: titleBox },
            Text(
              {
                id: "title",
                variant: "display",
                size: TITLE_SIZE,
                weight: 800,
                lineHeight: 0.98,
                letterSpacing: -5,
                maxWidth: columnWidth,
                color: INK,
                fontFamily: "'Syne', system-ui, sans-serif",
              },
              title,
            ),
          ),
        ),
        edgeVisible
          ? Fill({
              x: titleWidth,
              y: 0,
              width: 10,
              height: titleBox,
              color: accentColor,
            })
          : null,
      ),
      Frame(
        { id: "tag", x: margin, y: Math.round(height * 0.63), width: columnWidth, height: Math.round(height * 0.12) },
        Stack(
          { width: "fill", height: "fill", gap: 26 },
          Fill({
            width: Math.max(2, Math.round(240 * ruleP)),
            height: 9,
            color: accentColor,
          }),
          Text(
            {
              id: "subtitle",
              variant: "body",
              size: 32,
              weight: 700,
              lineHeight: 1.4,
              letterSpacing: 1,
              maxWidth: columnWidth,
              color: "rgba(17,18,8,0.72)",
              fontFamily: "'Space Mono', ui-monospace, monospace",
              motion: tagIn,
            },
            subtitle.toUpperCase(),
          ),
        ),
      ),
      Frame(
        { id: "ticker", x: 0, y: barTop, width, height: barBox, overflow: "hidden" },
        Fill({ color: INK }),
        Frame(
          {
            x: -Math.round(tickerOffset),
            y: barBox - barHeight,
            width: TICKER_SEGMENT * tickerCopies,
            height: barHeight,
          },
          Stack(
            { direction: "row", width: "fill", height: "fill", align: "center" },
            ...Array.from({ length: tickerCopies }, (_, i) =>
              Frame(
                { width: TICKER_SEGMENT, height: barHeight },
                Stack(
                  { width: "fill", height: "fill", direction: "row", align: "center", gap: 22 },
                  Frame({ width: 245, height: 38 }, Text(
                    {
                      variant: "label",
                      size: 28,
                      weight: 700,
                      letterSpacing: 7,
                      color: ACID,
                      fontFamily: "'Space Mono', ui-monospace, monospace",
                    },
                    "SUPERIMG",
                  )),
                  Fill({ width: 12, height: 12, color: accentColor }),
                  Text(
                    {
                      variant: "label",
                      size: 28,
                      weight: 400,
                      letterSpacing: 7,
                      color: "rgba(228,255,63,0.6)",
                      fontFamily: "'Space Mono', ui-monospace, monospace",
                    },
                    i % 2 === 0 ? "RENDER ANYWHERE" : "SAME BYTES TWICE",
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  },
});
