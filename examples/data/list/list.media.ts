// List — a countdown set like a magazine spread: oversized rank numerals, a spine that
// fills as the list counts, and exactly one lit row at a time.

import { video, layoutTimeline, Frame, Stack, Text, Fill, Html, Spacer, googleFont } from "@foxworth/superimg";

export type ListDirection = "up" | "down";
export type NumberStyle = "circle" | "square" | "plain";

export interface ListItem {
  title: string;
  subtitle?: string;
}

export interface ListVideoData extends Record<string, unknown> {
  title: string;
  items: ListItem[];
  direction: ListDirection;
  theme: "light" | "dark";
  numberStyle: NumberStyle;
  accentColor: string;
}

const DISPLAY = "'Archivo', 'Inter', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

function itemWeight(item: ListItem): number {
  return Math.max(1, 1 + (item.subtitle?.length ?? 0) / 80);
}

/** Silence at the head of the count so the masthead can be read first. */
const ITEMS_LEAD_S = 0.6;

function estimateListTimeline(data: ListVideoData) {
  const weights = data.items.map(itemWeight);
  const itemsS = Math.round(Math.max(2, weights.reduce((a, w) => a + w, 0)) * 20) / 20;
  const itemsSeconds = itemsS + ITEMS_LEAD_S;
  return {
    itemsSeconds,
    ...layoutTimeline({
      // The masthead snaps in; the read beat lives at the head of `items` as stack lead.
      intro: 0.4,
      items: itemsSeconds,
      // The last row is the payoff — give it a real beat, never less than a read.
      hold: Math.round(Math.max(2.2, itemsS * 0.26) * 20) / 20,
      // Exits are shorter than enters — leaving should never outlast arriving.
      outro: 0.3,
    }),
  };
}

export default video<ListVideoData>({
  duration: "9s", // AST fallback; resolve() owns the real clock
  fonts: [googleFont("Archivo:wght@600;700;800"), googleFont("Inter:wght@400;500"), googleFont("IBM+Plex+Mono:wght@500")],
  inlineCss: ["* { margin: 0; padding: 0; box-sizing: border-box; }", "body { overflow: hidden; }"],

  sample: {
    title: "Top 5 Reasons to Use TypeScript",
    items: [
      { title: "Type Safety", subtitle: "Catch errors at compile time" },
      { title: "Better IDE Support", subtitle: "Autocomplete and refactoring" },
      { title: "Self-Documenting Code", subtitle: "Types serve as documentation" },
      { title: "Easier Refactoring", subtitle: "Confident large-scale changes" },
      { title: "Growing Ecosystem", subtitle: "First-class library support" },
    ],
    direction: "down",
    theme: "dark",
    numberStyle: "plain",
    accentColor: "#FF5A1F",
  },

  resolve({ data }) {
    const { totalSeconds, phases } = estimateListTimeline(data);
    return { duration: `${Math.round(totalSeconds * 100) / 100}s`, phases };
  },

  render(ctx) {
    const { std, width, height, data } = ctx;
    const { title, items, direction, theme, numberStyle, accentColor } = data;

    const dark = theme !== "light";
    const page = dark ? "#0B0B0C" : "#EDE8E1";
    const ink = dark ? "#EDE8E1" : "#111112";
    const faint = dark ? "rgba(237,232,225,0.34)" : "rgba(17,17,18,0.38)";
    const hair = dark ? "rgba(237,232,225,0.14)" : "rgba(17,17,18,0.16)";

    if (items.length === 0) {
      return Frame(
        { id: "empty-state", width, height, fill: page },
        Stack(
          { width: "fill", height: "fill", align: "center", justify: "center", gap: 24, pad: 96 },
          Text({ variant: "title", size: 52, color: ink }, title),
          Text({ variant: "body", size: 30, color: ink }, "No list items yet"),
        ),
      );
    }

    const { phases, itemsSeconds } = estimateListTimeline(data);
    const t = ctx.director(phases);

    // "down" counts 5→1 so the payoff lands on #1.
    const ordered = direction === "down" ? [...items].reverse() : items;
    const count = ordered.length;
    const rankOf = (i: number) => (direction === "down" ? count - i : i + 1);

    const weights = ordered.map(itemWeight);
    const stk = std.stack(ordered, {
      id: "countdown",
      itemIds: ordered.map((_item, i) => `rank-${rankOf(i)}`),
      during: t.in("items"),
      weights,
      lead: ITEMS_LEAD_S / itemsSeconds,
      trail: 0.06,
    });

    // ── Page geometry ───────────────────────────────────────────────────────
    const margin = 112;
    const headH = 176;
    const listY = margin + headH;
    const listH = height - listY - margin;
    const rowH = Math.min(150, listH / count);
    const listTop = listY + (listH - rowH * count) / 2;
    const spineX = margin;
    const numW = 168;
    const textX = margin + 44 + numW;
    const textW = width - textX - margin;

    const introP = t.in("intro");
    const headOp = std.interpolate(introP, [0, 0.8], [0, 1], "easeOutCubic");
    const headY = std.interpolate(introP, [0, 1], [18, 0], "easeOutQuint");
    const outro = t.in("outro");
    const pageOp = 1 - std.interpolate(outro, [0, 1], [0, 1], "easeInCubic");
    const pageScale = std.interpolate(outro, [0, 1], [1, 0.985], "easeInCubic");

    // ── Spine: fills as rows land, so the countdown has a gauge ─────────────
    const landed = ordered.reduce((acc, _item, i) => acc + std.clamp01(stk.state(i).enter), 0);
    const spineFill = count > 0 ? landed / count : 0;
    const spineH = rowH * count;
    const spineSvg = `<svg width="3" height="${spineH}" viewBox="0 0 3 ${spineH}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="3" height="${spineH}" fill="${hair}"/>
  <rect x="0" y="0" width="3" height="${(spineH * spineFill).toFixed(2)}" fill="${accentColor}"/>
</svg>`;

    // ── Rank numeral — numberStyle stays an honest author dial ──────────────
    function numeral(rank: number, lit: number, pop: number) {
      const label = String(rank);
      const color = lit > 0.5 ? accentColor : faint;
      const scale = std.interpolate(pop, [0, 1], [0.82, 1], "easeOutBack");
      const common = {
        style: {
          transform: `scale(${scale.toFixed(4)})`,
          transformOrigin: "center center",
          opacity: pop,
        },
      };

      if (numberStyle === "square") {
        const size = Math.min(96, rowH - 34);
        return Frame(
          { width: numW, height: rowH },
          Frame(
            { x: numW - size, y: (rowH - size) / 2, width: size, height: size, radius: 8, fill: color, ...common },
            Stack(
              { width: size, height: size, align: "center", justify: "center" },
              Text({ variant: "display", color: page, size: size * 0.56, weight: 800, fontFamily: DISPLAY }, label),
            ),
          ),
        );
      }

      if (numberStyle === "circle") {
        const size = Math.min(96, rowH - 34);
        return Frame(
          { width: numW, height: rowH },
          Frame(
            {
              x: numW - size,
              y: (rowH - size) / 2,
              width: size,
              height: size,
              radius: size / 2,
              ...common,
              style: { ...common.style, border: `3px solid ${color}` },
            },
            Stack(
              { width: size, height: size, align: "center", justify: "center" },
              Text({ variant: "display", color, size: size * 0.5, weight: 700, fontFamily: DISPLAY }, label),
            ),
          ),
        );
      }

      // plain — the poster setting: a bare, oversized numeral flush right
      return Frame(
        { width: numW, height: rowH, ...common },
        Stack(
          { width: numW, height: rowH, justify: "center" },
          Text(
            {
              variant: "display",
              color,
              size: Math.min(112, rowH * 0.82),
              weight: 800,
              fontFamily: DISPLAY,
              align: "right",
              letterSpacing: -5,
              style: { lineHeight: 1 },
            },
            label,
          ),
        ),
      );
    }

    // ── Rows ────────────────────────────────────────────────────────────────
    const rows = ordered.map((item, i) => {
      const state = stk.state(i);
      if (state.state === "hidden") return null;

      const enter = std.clamp01(state.enter);
      const pop = std.interpolate(enter, [0, 1], [0, 1], "easeOutCubic");
      const textP = std.interpolate(std.clamp01((enter - 0.18) / 0.82), [0, 1], [0, 1], "easeOutQuint");

      // Lit while it is the newest row; earlier rows recede but stay legible.
      const nextStarted = i + 1 < count ? std.clamp01(stk.state(i + 1).enter * 2.2) : 0;
      const lit = 1 - nextStarted;
      const rowOp = std.interpolate(lit, [0, 1], [0.42, 1], "easeOutCubic") * pop;

      const y = listTop + i * rowH;
      const ruleP = std.interpolate(enter, [0, 1], [0, 1], "easeOutQuart");

      // The last row to land keeps a slab of accent behind it — the payoff.
      const isFinal = i === count - 1;
      const payoff = isFinal ? std.clamp01(t.in("hold") * 3) * lit : 0;

      return Frame(
        { id: `row-${rankOf(i)}`, x: 0, y, width, height: rowH },

        payoff > 0
          ? Frame({
              x: margin,
              y: 8,
              width: (width - margin * 2) * payoff,
              height: rowH - 16,
              radius: 4,
              fill: std.color.alpha(accentColor, 0.1),
            })
          : null,

        // Baseline rule sweeps out from the spine.
        Frame({
          x: margin,
          y: rowH - 1,
          width: width - margin * 2,
          height: 1,
          fill: hair,
          style: { transform: `scaleX(${ruleP.toFixed(3)})`, transformOrigin: "left center" },
        }),

        Frame(
          { x: margin + 44, y: 0, width: width - margin - 44, height: rowH, style: { opacity: rowOp } },
          Stack(
            { direction: "row", width: width - margin * 2 - 44, height: rowH, gap: 44, align: "center" },
            numeral(rankOf(i), lit, pop),
            Frame(
              {
                width: textW,
                height: rowH,
                style: { transform: `translateX(${((1 - textP) * 42).toFixed(2)}px)`, opacity: textP },
              },
              Stack(
                { width: textW, height: rowH, gap: 8, justify: "center" },
                Text(
                  {
                    variant: "title",
                    color: ink,
                    size: Math.min(50, rowH * 0.34),
                    weight: 700,
                    fontFamily: DISPLAY,
                    letterSpacing: -1,
                    maxWidth: textW,
                  },
                  item.title,
                ),
                item.subtitle
                  ? Text(
                      { variant: "caption", color: faint, size: Math.min(25, rowH * 0.17), maxWidth: textW },
                      item.subtitle,
                    )
                  : null,
              ),
            ),
          ),
        ),
      );
    });

    return Frame(
      { id: "page", width, height },
      Fill({ color: page }),
      Fill({
        gradient: {
          kind: "radial",
          at: "88% 6%",
          size: "64% 58%",
          stops: [std.color.alpha(accentColor, dark ? 0.13 : 0.1), "transparent"],
        },
      }),

      Frame(
        {
          x: 0,
          y: 0,
          width,
          height,
          style: { opacity: pageOp, transform: `scale(${pageScale.toFixed(4)})`, transformOrigin: "center center" },
        },

        // Masthead
        Frame(
          { x: margin, y: margin, width: width - margin * 2, height: headH, style: { opacity: headOp, transform: `translateY(${headY.toFixed(2)}px)` } },
          Stack(
            { width: width - margin * 2, gap: 18 },
            Stack(
              { direction: "row", height: 22, gap: 16, align: "center" },
              Frame({ width: 34, height: 3, fill: accentColor }),
              Text({ variant: "label", color: accentColor, size: 15, weight: 600, fontFamily: MONO, letterSpacing: 5 }, direction === "down" ? "COUNTDOWN" : "THE LIST"),
              Text({ variant: "label", color: faint, size: 15, weight: 500, fontFamily: MONO, letterSpacing: 2 }, `${count} ENTRIES`),
            ),
            Text(
              {
                variant: "display",
                color: ink,
                size: 68,
                weight: 800,
                fontFamily: DISPLAY,
                letterSpacing: -2.4,
                maxWidth: width - margin * 2 - 120,
                style: { lineHeight: 1.05 },
              },
              title,
            ),
          ),
        ),

        Frame({ x: spineX, y: listTop, width: 3, height: spineH }, Html({ width: 3, height: spineH, html: spineSvg })),
        ...rows,
      ),
    );
  },
});
