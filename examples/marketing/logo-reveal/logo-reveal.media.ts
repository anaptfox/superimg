// Logo Reveal — a printed brand intro: cobalt stock, bone type, ochre rule.
// Two reveals, both real: `press` prints the wordmark under a sweeping bar,
// `cut` splits it at the rule and closes the seam. Nothing else is claimed.

import { video, Frame, Fill, Stack, Text, type MediaElement, googleFont } from "@foxworth/superimg";

export type RevealStyle = "press" | "cut";

export interface LogoRevealData extends Record<string, unknown> {
  logoText: string;
  tagline: string | null;
  style: RevealStyle;
  accentColor: string;
}

const FIELD = "#173F8A";
const FIELD_DEEP = "#0E2A63";
const BONE = "#F1EADA";

export default video<LogoRevealData>({
  duration: "4.5s",
  poster: "3.4s",
  fonts: [googleFont("Archivo:wght@700;800"), googleFont("DM+Mono:wght@500")],
  sample: {
    logoText: "ACME",
    tagline: "Building the future",
    style: "press",
    accentColor: "#E0A32E",
  },
  variants: {
    cut: { style: "cut" },
  },
  render(ctx) {
    const { std, width, height, data } = ctx;
    const { logoText, tagline, style, accentColor } = data;

    const t = ctx.director({
      reveal: "26%",
      land: "10%",
      tag: "14%",
      hold: "38%",
      out: "12%",
    });

    const revealP = t.in("reveal");
    const settleP = t.in("land");
    const tagP = t.in("tag");
    const outP = t.in("out");

    const mark = logoText.toUpperCase();
    const bandW = Math.round(width * 0.74);
    const glyph = Math.min(height * 0.26, (bandW * 0.94) / Math.max(1, mark.length * 0.66));
    const bandH = Math.round(glyph * 1.24);

    // Reveal runs 0 → 1 across the reveal phase; settle only adds the landing.
    const revealed = revealP >= 1 || settleP > 0 || tagP > 0 || t.in("hold") > 0 || outP > 0;
    const p = revealed ? 1 : revealP;

    const lockupScale = std.spring(0.985, 1, std.clamp01(settleP / 0.8), "snappy");
    const fade = 1 - std.interpolate(outP, [0, 1], [0, 1], "easeInCubic");
    const lift = std.interpolate(outP, [0, 1], [0, -22], "easeInCubic");

    // Keep the wordmark in the tree so check/inspect can see and measure it.
    const wordmark = (id: string) => Text({
      id, maxWidth: bandW, variant: "display",
      fontFamily: "'Archivo', system-ui, sans-serif", weight: 800,
      size: glyph, lineHeight: bandH / glyph, letterSpacing: -glyph * 0.035,
      color: BONE, align: "center",
    }, mark);

    let band: MediaElement;
    if (style === "cut") {
      const open = std.interpolate(p, [0, 1], [0, 1], "easeOutExpo");
      const drop = (1 - open) * glyph * 0.55;
      const seam = Math.round(bandW * std.clamp01(p * 1.6));
      band = Frame({ id: "cut", width: bandW, height: bandH, overflow: "hidden" },
        Frame({ width: bandW, height: bandH, style: { clipPath: "inset(0 0 50% 0)", transform: `translateY(${-drop}px)` } }, wordmark("mark-top")),
        Frame({ width: bandW, height: bandH, style: { clipPath: "inset(50% 0 0 0)", transform: `translateY(${drop}px)` } }, wordmark("mark-bottom")),
        Fill({ id: "seam", x: (bandW - seam) / 2, y: bandH / 2 - 1, width: Math.max(1, seam), height: 2, color: accentColor,
          style: { opacity: seam > 0 ? 1 - std.clamp01((p - 0.7) / 0.3) : 0 } }),
      );
    } else {
      const sweep = std.interpolate(p, [0, 1], [0, 1], "easeInOutQuart");
      const barW = Math.round(bandW * 0.14);
      const edge = -barW + sweep * (bandW + barW);
      const printed = Math.max(0, Math.min(bandW, edge));
      const barFade = 1 - std.clamp01((p - 0.86) / 0.14);
      band = Frame({ id: "press", width: bandW, height: bandH, overflow: "hidden" },
        Frame({ width: bandW, height: bandH, style: { clipPath: `inset(0 ${bandW - printed}px 0 0)` } }, wordmark("mark")),
        Fill({ id: "roller", x: edge, width: barW, height: bandH, color: BONE, style: { opacity: barFade } }),
        Fill({ id: "edge", x: edge + barW, width: 2, height: bandH, color: accentColor, style: { opacity: barFade } }),
      );
    }

    const ruleW = Math.round(bandW * 0.34 * std.interpolate(tagP, [0, 1], [0, 1], "easeOutCubic"));
    const tagY = std.interpolate(tagP, [0, 1], [14, 0], "easeOutCubic");

    return Frame(
      { id: "stage", width: "fill", height: "fill" },
      Fill({
        gradient: {
          kind: "radial",
          at: "50% 42%",
          size: "110% 110%",
          stops: [`${FIELD} 0%`, `${FIELD_DEEP} 100%`],
        },
      }),
      Fill({
        id: "press-grain",
        style: { backgroundImage: "radial-gradient(rgba(241,234,218,0.055) 1.1px, transparent 1.2px)", backgroundSize: "11px 11px" },
      }),
      Stack(
        {
          id: "lockup",
          width: "fill",
          height: "fill",
          direction: "column",
          align: "center",
          justify: "center",
          gap: Math.round(glyph * 0.26),
          style: {
            opacity: fade,
            transform: `translateY(${lift.toFixed(2)}px) scale(${lockupScale.toFixed(4)})`,
          },
        },
        Frame(
          { id: "band", width: bandW, height: bandH, overflow: "hidden" },
          band,
        ),
        Frame({
          width: Math.max(1, ruleW),
          height: 2,
          fill: accentColor,
          style: { opacity: ruleW > 1 ? 1 : 0 },
        }),
        tagline
          ? Text(
              {
                variant: "caption",
                size: Math.round(glyph * 0.15),
                weight: 500,
                color: `${BONE}CC`,
                fontFamily: "'DM Mono', ui-monospace, monospace",
                letterSpacing: Math.round(glyph * 0.045),
                align: "center",
                style: {
                  opacity: tagP,
                  transform: `translateY(${tagY.toFixed(2)}px)`,
                },
              },
              tagline.toUpperCase(),
            )
          : null,
      ),
    );
  },
});
