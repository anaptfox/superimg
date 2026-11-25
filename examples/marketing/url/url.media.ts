// URL card — a link rendered as a paper filing slip, not a browser screenshot.
// Four structures share one art direction: slip, minimal, wireframe, social.
// Sample data is fully offline: no image, no favicon, no network at render time.

import { video, Frame, Fill, Image, Stack, Text, type TextProps, type RenderContext, googleFont } from "@foxworth/superimg";

export type UrlCardStyle = "card" | "minimal" | "browser" | "social";

export interface UrlVideoData extends Record<string, unknown> {
  url: string;
  title: string;
  description: string;
  image: string | null;
  siteName: string;
  favicon: string | null;
  domain: string;
  style: UrlCardStyle;
  theme: "light" | "dark";
  /** Decorative scan strip derived from the URL; it is not a machine-readable code. */
  showScanStrip: boolean;
}

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const SANS = "'Fraunces', Georgia, serif";

interface Tokens {
  field: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  stamp: string;
}

function slipTokens(theme: "light" | "dark"): Tokens {
  return theme === "dark"
    ? {
        field: "#0E1513",
        surface: "#16201C",
        ink: "#E8EEE6",
        muted: "#8DA096",
        line: "rgba(232,238,230,0.18)",
        accent: "#5BC08C",
        stamp: "#E4705F",
      }
    : {
        field: "#DDE4DC",
        surface: "#F4F7F1",
        ink: "#16211C",
        muted: "#5E6B63",
        line: "rgba(22,33,28,0.16)",
        accent: "#1F6F4A",
        stamp: "#B23A2E",
      };
}

/** Deterministic bar widths from the link itself — a scan strip, not a QR code. */
function scanBars(seed: string, count: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    out.push(1 + ((h >>> 17) % 3));
  }
  return out;
}

export default video<UrlVideoData>({
  duration: "8s",
  fonts: [googleFont("Fraunces:opsz,wght@9..144,600;9..144,700"), googleFont("IBM+Plex+Mono:wght@400;500;600")],
  sample: {
    url: "https://superimg.dev/docs/getting-started",
    title: "Write the frame, not the timeline",
    description:
      "A pure function of time — same input, same file.",
    image: null,
    siteName: "SuperImg Docs",
    favicon: null,
    domain: "superimg.dev",
    style: "card",
    theme: "light",
    showScanStrip: true,
  },

  variants: {
    minimal: { style: "minimal" },
    browser: { style: "browser" },
    social: { style: "social", theme: "dark" },
  },

  render(ctx: RenderContext<UrlVideoData>) {
    const { std, width, height, data } = ctx;
    const { url, title, description, image, siteName, favicon, domain, style, theme, showScanStrip } =
      data;

    const t = ctx.director({
      enter: "12%",
      type: "22%",
      seal: "10%",
      hold: "46%",
      exit: "10%",
    });

    const tk = slipTokens(theme);
    const inverted = style === "social";
    const surface = inverted ? tk.ink : tk.surface;
    const onSurface = inverted ? tk.surface : tk.ink;
    const onSurfaceMuted = inverted ? std.color.alpha(tk.surface, 0.62) : tk.muted;
    const onSurfaceLine = inverted ? std.color.alpha(tk.surface, 0.22) : tk.line;

    const s = Math.min(width, height) / 1080;
    const isVertical = height > width;
    const cardWidth = Math.round(width * (isVertical ? 0.88 : 0.62));
    const pad = Math.round(56 * s);
    const gap = Math.round(26 * s);
    const copyWidth = cardWidth - pad * 2;

    // ---- beats: the slip lands, the copy reads, the stamp seals, the page lifts ----
    const slip = t.motion({
      id: "slip",
      during: "enter",
      at: "0%",
      for: "58%",
      y: Math.round(46 * s),
      scale: 0.965,
      easing: "easeOutBack",
      exit: false,
    });
    const head = t.motion({
      id: "head",
      during: "enter",
      at: "26%",
      for: "42%",
      y: -Math.round(14 * s),
      exit: false,
    });
    const heading = t.motion({
      id: "title",
      during: "type",
      at: "0%",
      for: "38%",
      y: Math.round(22 * s),
      exit: false,
    });
    const blurb = t.motion({
      id: "blurb",
      during: "type",
      at: "18%",
      for: "38%",
      y: Math.round(14 * s),
      exit: false,
    });
    const address = t.motion({
      id: "address",
      during: "type",
      at: "36%",
      for: "36%",
      x: -Math.round(20 * s),
      exit: false,
    });
    const plateP = std.interpolate(t.in("enter"), [0.2, 0.8], [0, 1], "easeOutCubic");
    const sealP = t.in("seal");
    const sealScale = std.spring(1.42, 1, std.interpolate(sealP, [0, 0.6], [0, 1]), "snappy");
    const sealOpacity = std.interpolate(sealP, [0, 0.25], [0, 1], "easeOutCubic");
    const stripP = std.interpolate(sealP, [0.15, 0.9], [0, 1], "easeOutQuart");
    const typed = std.text.type(url, std.interpolate(t.in("type"), [0.1, 0.9], [0, 1]), {
      by: "char",
    });

    const leave = std.interpolate(t.in("exit"), [0, 1], [0, 1], "easeInCubic");
    const pageStyle = {
      opacity: 1 - leave,
      transform: `translateY(${-Math.round(26 * s) * leave}px)`,
    };

    // ---- shared pieces ----
    const unit = Math.max(2, Math.round(3 * s));
    const stripHeight = Math.round(44 * s);
    const bars = scanBars(url, 34);
    const stripWidth = bars.reduce((sum, w) => sum + w * unit, 0) + bars.length * unit;
    const scanStrip = (tint: string) =>
      Frame(
        {
          width: Math.max(2, Math.round(stripWidth * stripP)),
          height: stripHeight,
          overflow: "hidden",
        },
        Stack(
          { direction: "row", gap: unit, height: stripHeight },
          ...bars.map((w, i) =>
            Fill({
              width: w * unit,
              height: stripHeight,
              color: i % 2 === 0 ? tint : "transparent",
            }),
          ),
        ),
      );

    const perforation = (tint: string) =>
      Stack(
        { direction: "row", width: "fill", gap: Math.round(10 * s), height: 2 },
        ...Array.from({ length: 28 }, () =>
          Fill({ width: Math.round(14 * s), height: 2, color: tint }),
        ),
      );

    const eyebrow = (text: string, color: string, motion?: TextProps["motion"]) =>
      Text(
        {
          variant: "label",
          size: Math.round(22 * s),
          weight: 500,
          letterSpacing: Math.round(3 * s),
          color,
          fontFamily: MONO,
          ...(motion ? { motion } : {}),
        },
        text.toUpperCase(),
      );

    const headline = (size: number, color: string, align?: "left" | "center") =>
      Text(
        {
          id: "headline",
          variant: "display",
          size: Math.round(size * s),
          weight: 700,
          lineHeight: 1.08,
          letterSpacing: Math.round(-1.5 * s),
          maxWidth: align === "center" ? Math.round(width * 0.66) : copyWidth,
          ...(align ? { align } : {}),
          color,
          fontFamily: SANS,
          motion: heading,
        },
        title,
      );

    const body = (size: number, color: string, maxWidth: number, align?: "left" | "center") =>
      Text(
        {
          id: "blurb",
          variant: "body",
          size: Math.round(size * s),
          weight: 400,
          lineHeight: 1.5,
          maxWidth,
          ...(align ? { align } : {}),
          color,
          fontFamily: MONO,
          motion: blurb,
        },
        description,
      );

    // Optional attachment — clipped open from the top edge, never a stretched thumb.
    const plate = (boxHeight: number) =>
      image
        ? Frame(
            { width: "fill", height: boxHeight, radius: Math.round(4 * s), overflow: "hidden" },
            Frame(
              {
                width: "fill",
                height: Math.max(2, Math.round(boxHeight * plateP)),
                overflow: "hidden",
              },
              Image({ src: image, width: "fill", height: boxHeight, fit: "cover" }),
            ),
          )
        : null;

    // ---- style: card (the filing slip) ----
    function cardSlip() {
      return Frame(
        { id: "slip", width: cardWidth, height: "fill", motion: slip },
        Frame({ width: "fill", height: "fill", fill: surface, style: { border: `2px solid ${tk.line}` } }),
        Stack(
          { width: "fill", height: "fill", pad, gap, justify: "center" },
          Stack(
            {
              direction: "row",
              width: "fill",
              height: Math.round(30 * s),
              align: "center",
              justify: "space-between",
            },
            eyebrow(siteName, onSurfaceMuted, head),
            eyebrow("filed", tk.accent, head),
          ),
          Fill({ width: "fill", height: 1, color: onSurfaceLine }),
          plate(Math.round(220 * s)),
          headline(64, onSurface),
          Frame({ width: "fill", height: Math.round(84 * s) }, body(26, onSurfaceMuted, copyWidth)),
          perforation(onSurfaceLine),
          Stack(
            {
              direction: "row",
              width: "fill",
              height: stripHeight,
              align: "center",
              justify: "space-between",
              gap: Math.round(24 * s),
            },
            Text(
              {
                id: "address",
                variant: "body",
                size: Math.round(24 * s),
                weight: 500,
                color: tk.accent,
                fontFamily: MONO,
                motion: address,
              },
              url,
            ),
            showScanStrip ? scanStrip(onSurface) : eyebrow(domain, onSurfaceMuted),
          ),
        ),
        Frame(
          {
            x: cardWidth - Math.round(250 * s),
            y: Math.round(46 * s),
            width: Math.round(200 * s),
            height: Math.round(86 * s),
            style: { opacity: sealOpacity, transform: `scale(${sealScale.toFixed(4)})` },
          },
          Frame(
            {
              width: Math.round(200 * s),
              height: Math.round(86 * s),
              radius: Math.round(6 * s),
              style: { border: `${Math.round(4 * s)}px solid ${tk.stamp}`, transform: "rotate(-7deg)" },
            },
            Stack(
              { width: "fill", height: "fill", align: "center", justify: "center" },
              Text(
                {
                  variant: "label",
                  size: Math.round(24 * s),
                  weight: 600,
                  letterSpacing: Math.round(2 * s),
                  color: tk.stamp,
                  align: "center",
                  fontFamily: MONO,
                },
                domain.toUpperCase(),
              ),
            ),
          ),
        ),
      );
    }

    // ---- style: minimal (no card at all) ----
    function minimalSlip() {
      return Stack(
        {
          id: "slip",
          width: "fill",
          height: "fill",
          align: "center",
          justify: "center",
          gap: Math.round(30 * s),
          pad: { x: Math.round(width * 0.12) },
          motion: slip,
        },
        Stack(
          { direction: "row", align: "center", gap: Math.round(14 * s), height: Math.round(30 * s) },
          Fill({ width: Math.round(12 * s), height: Math.round(12 * s), radius: 999, color: tk.accent }),
          eyebrow(domain, tk.muted, head),
        ),
        headline(96, tk.ink, "center"),
        body(28, tk.muted, Math.round(width * 0.52), "center"),
        Fill({
          width: Math.max(2, Math.round(width * 0.3 * stripP)),
          height: Math.round(5 * s),
          color: tk.accent,
        }),
        showScanStrip ? scanStrip(std.color.alpha(tk.ink, 0.72)) : eyebrow(siteName, tk.muted),
      );
    }

    // ---- style: browser (wireframe chrome, never a fake screenshot) ----
    function browserSlip() {
      const barHeight = Math.round(74 * s);
      return Frame(
        { id: "slip", width: cardWidth, height: "fill", motion: slip },
        Frame({
          width: "fill",
          height: "fill",
          fill: surface,
          style: { border: `2px solid ${tk.line}` },
          radius: Math.round(12 * s),
        }),
        Stack(
          { width: "fill", height: "fill" },
          Stack(
            {
              direction: "row",
              width: "fill",
              height: barHeight,
              align: "center",
              gap: Math.round(12 * s),
              pad: { x: Math.round(24 * s) },
            },
            ...Array.from({ length: 3 }, () =>
              Frame(
                {
                  width: Math.round(16 * s),
                  height: Math.round(16 * s),
                  radius: 999,
                  style: { border: `1px solid ${tk.line}` },
                },
                Fill({ width: Math.round(4 * s), height: Math.round(4 * s), color: "transparent" }),
              ),
            ),
            Frame(
              {
                width: cardWidth - Math.round(160 * s),
                height: Math.round(42 * s),
                radius: 999,
                style: { border: `1px solid ${tk.line}` },
                pad: { x: Math.round(18 * s) },
              },
              Stack(
                { width: "fill", height: "fill", justify: "center" },
                Text(
                  {
                    id: "address",
                    variant: "body",
                    size: Math.round(21 * s),
                    weight: 500,
                    color: tk.accent,
                    fontFamily: MONO,
                  },
                  typed.visible || " ",
                ),
              ),
            ),
          ),
          Fill({ width: "fill", height: 1, color: tk.line }),
          Stack(
            {
              width: "fill",
              height: "fill",
              pad,
              gap,
              justify: "center",
            },
            eyebrow(siteName, tk.muted, head),
            plate(Math.round(200 * s)),
            headline(58, tk.ink),
            body(25, tk.muted, copyWidth),
            Stack(
              {
                direction: "row",
                width: "fill",
                height: stripHeight,
                align: "center",
                justify: "space-between",
              },
              eyebrow(domain, tk.muted, address),
              showScanStrip ? scanStrip(std.color.alpha(tk.ink, 0.7)) : eyebrow("link", tk.accent),
            ),
          ),
        ),
      );
    }

    // ---- style: social (inverted slip with an accent spine) ----
    function socialSlip() {
      return Frame(
        { id: "slip", width: cardWidth, height: "fill", motion: slip },
        Frame({ width: "fill", height: "fill", fill: surface, radius: Math.round(6 * s) }),
        Frame(
          { width: Math.round(10 * s), height: "fill" },
          Fill({ color: tk.accent }),
        ),
        Stack(
          {
            width: "fill",
            height: "fill",
            pad: { left: pad + Math.round(20 * s), right: pad, top: pad, bottom: pad },
            gap,
            justify: "center",
          },
          Stack(
            {
              direction: "row",
              width: "fill",
              height: Math.round(30 * s),
              align: "center",
              justify: "space-between",
            },
            eyebrow(siteName, onSurfaceMuted, head),
            eyebrow(domain, tk.accent, head),
          ),
          plate(Math.round(240 * s)),
          headline(68, onSurface),
          body(26, onSurfaceMuted, copyWidth - Math.round(20 * s)),
          Fill({ width: "fill", height: 1, color: onSurfaceLine }),
          Stack(
            {
              direction: "row",
              width: "fill",
              height: stripHeight,
              align: "center",
              justify: "space-between",
              gap: Math.round(24 * s),
            },
            Text(
              {
                id: "address",
                variant: "body",
                size: Math.round(23 * s),
                weight: 500,
                color: onSurfaceMuted,
                fontFamily: MONO,
                motion: address,
              },
              favicon ? `${domain} · shared` : url,
            ),
            showScanStrip ? scanStrip(std.color.alpha(tk.surface, 0.8)) : eyebrow("share", tk.accent),
          ),
        ),
      );
    }

    const slipTree =
      style === "minimal"
        ? minimalSlip()
        : style === "browser"
          ? browserSlip()
          : style === "social"
            ? socialSlip()
            : cardSlip();

    return Frame(
      { id: "stage", width, height },
      Fill({ color: tk.field }),
      Frame(
        { id: "sheet", x: 0, y: 0, width, height, style: pageStyle },
        Stack(
          {
            width: "fill",
            height: "fill",
            align: "center",
            justify: "center",
            pad: { y: Math.round(height * (style === "minimal" ? 0.06 : 0.16)) },
          },
          slipTree,
        ),
      ),
    );
  },
});
