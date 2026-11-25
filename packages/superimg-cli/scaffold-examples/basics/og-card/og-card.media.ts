// Open Graph card — a printed title page, not a product screenshot.
// Warm black stock, condensed display type, and a contact sheet of frames
// standing in for the program that made it.

import { ogImage, Frame, Fill, Stack, Text, googleFont } from "@foxworth/superimg";

const STOCK = "#12100E";
const CREAM = "#F4EFE4";
const MUTED = "#8C8375";

const DISPLAY = "'Anton', 'Haettenschweiler', Impact, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

const SHEET_COLS = 3;
const SHEET_ROWS = 3;

export default ogImage({
  editions: {
    compact: { size: { width: 600, height: 315 } },
  },
  sample: {
    title: "SuperImg",
    tagline: "Media programs that render themselves.",
    accentColor: "#E9A72B",
  },
  fonts: [googleFont("Anton"), googleFont("JetBrains+Mono:wght@400;500")],

  render(ctx) {
    const { std, width, height, data } = ctx;
    const { title, tagline, accentColor } = data;

    const s = width / 1200;
    const pad = Math.round(width * 0.075);
    const hair = std.color.alpha(CREAM, 0.16);

    const cell = { w: Math.round(84 * s), h: Math.round(48 * s) };
    const cellGap = Math.round(12 * s);
    const sheetWidth = cell.w * SHEET_COLS + cellGap * (SHEET_COLS - 1);
    const columnGap = Math.round(72 * s);
    const copyWidth = width - pad * 2 - sheetWidth - columnGap;
    const railHeight = Math.round(30 * s);
    const railGap = Math.round(18 * s);

    // Each cell holds the same bar one beat further along — a program, sampled.
    const sheet = Stack(
      { id: "sheet", gap: cellGap },
      ...Array.from({ length: SHEET_ROWS }, (_, row) =>
        Stack(
          { direction: "row", gap: cellGap },
          ...Array.from({ length: SHEET_COLS }, (_, col) => {
            const step = (row * SHEET_COLS + col) / (SHEET_ROWS * SHEET_COLS - 1);
            const barWidth = Math.max(3, Math.round((cell.w - 16 * s) * (0.12 + 0.88 * step)));
            return Frame(
              {
                width: cell.w,
                height: cell.h,
                style: { border: `1px solid ${hair}` },
                radius: 2,
              },
              Fill({
                x: Math.round(8 * s),
                y: cell.h - Math.round(16 * s),
                width: barWidth,
                height: Math.max(3, Math.round(6 * s)),
                color: step > 0.72 ? accentColor : std.color.alpha(CREAM, 0.28 + 0.4 * step),
              }),
            );
          }),
        ),
      ),
    );

    const rowText = (id: string, text: string, color: string) =>
      Text(
        {
          id,
          variant: "label",
          size: Math.round(17 * s),
          weight: 500,
          letterSpacing: Math.round(2 * s),
          color,
          fontFamily: MONO,
        },
        text,
      );

    return Frame(
      { id: "stage", width, height },
      Fill({ color: STOCK }),
      Stack(
        {
          id: "card",
          width: "fill",
          height: "fill",
          pad: { x: pad, y: Math.round(pad * 0.72) },
        },
        Stack(
          {
            direction: "row",
            width: "fill",
            height: railHeight,
            align: "center",
            justify: "space-between",
          },
          rowText("mark", "SUPERIMG", CREAM),
          rowText("kicker", `OPEN GRAPH · ${width}×${height}`, MUTED),
        ),
        Stack(
          {
            direction: "row",
            width: "fill",
            height: "fill",
            align: "center",
            justify: "space-between",
            gap: columnGap,
          },
          Stack(
            { id: "copy", gap: Math.round(20 * s) },
            Fill({
              id: "index",
              width: Math.round(64 * s),
              height: Math.max(3, Math.round(6 * s)),
              color: accentColor,
            }),
            Text(
              {
                id: "title",
                variant: "display",
                size: Math.round(92 * s),
                weight: 400,
                lineHeight: 1.0,
                letterSpacing: Math.round(-1 * s),
                maxWidth: copyWidth,
                color: CREAM,
                fontFamily: DISPLAY,
              },
              title,
            ),
            Text(
              {
                id: "tagline",
                variant: "body",
                size: Math.round(25 * s),
                weight: 400,
                lineHeight: 1.35,
                maxWidth: copyWidth,
                color: MUTED,
                fontFamily: MONO,
              },
              tagline,
            ),
          ),
          sheet,
        ),
        Stack(
          {
            id: "footer",
            width: "fill",
            height: railHeight + railGap + 1,
            gap: railGap,
          },
          Fill({ width: "fill", height: 1, color: hair }),
          Stack(
            {
              direction: "row",
              width: "fill",
              height: railHeight,
              align: "center",
              justify: "space-between",
            },
            rowText("url", "superimg.dev", CREAM),
            rowText("format", "TYPESET BY THE PROGRAM", accentColor),
          ),
        ),
      ),
    );
  },
});
