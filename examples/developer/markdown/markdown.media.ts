// Markdown — prose that sets itself. Blocks are wiped in one at a time with the
// source marker in the gutter; emphasis and code land a beat after the line does.

import { video, Frame, Stack, Text, Html, type RenderContext, googleFont } from "@foxworth/superimg";

export interface MarkdownVideoData extends Record<string, unknown> {
  html: string;
  raw: string;
  wordCount: number;
  theme: "light" | "dark";
  fontSize: "small" | "medium" | "large";
  showWordCount: boolean;
}

interface Palette {
  ground: string;
  ink: string;
  muted: string;
  accent: string;
  hair: string;
  chip: string;
}

const PALETTES: Record<"light" | "dark", Palette> = {
  dark: {
    ground: "#15110F",
    ink: "#F4EEE5",
    muted: "#8E8578",
    accent: "#E8A33D",
    hair: "rgba(244,238,229,0.14)",
    chip: "rgba(244,238,229,0.08)",
  },
  light: {
    ground: "#FAF7F1",
    ink: "#1A1714",
    muted: "#807769",
    accent: "#B4671A",
    hair: "rgba(26,23,20,0.14)",
    chip: "rgba(26,23,20,0.06)",
  },
};

const SCALE: Record<string, number> = { small: 0.82, medium: 1, large: 1.22 };
const MONO = "'JetBrains Mono', ui-monospace, monospace";

interface Block {
  tag: string;
  marker: string;
  inner: string;
}

const MARKERS: Record<string, string> = {
  h1: "#",
  h2: "##",
  h3: "###",
  p: "¶",
  li: "-",
  blockquote: ">",
  pre: "```",
};

/** Split authored HTML into top-level blocks so a reveal never cuts a tag. */
function blocksOf(html: string): Block[] {
  const out: Block[] = [];
  const re = /<(h1|h2|h3|p|ul|ol|blockquote|pre)\b[^>]*>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;
  let cursor = 0;
  while ((match = re.exec(html)) !== null) {
    const loose = html.slice(cursor, match.index).trim();
    if (loose) out.push({ tag: "p", marker: MARKERS.p!, inner: loose });
    cursor = match.index + match[0].length;
    const tag = match[1]!;
    const inner = match[2]!;
    if (tag === "ul" || tag === "ol") {
      const items = inner.match(/<li\b[^>]*>([\s\S]*?)<\/li>/g) ?? [];
      for (const [index, item] of items.entries()) {
        out.push({
          tag: "li",
          marker: tag === "ol" ? `${index + 1}.` : MARKERS.li!,
          inner: item.replace(/<\/?li\b[^>]*>/g, ""),
        });
      }
      continue;
    }
    out.push({ tag, marker: MARKERS[tag] ?? "¶", inner });
  }
  const tail = html.slice(cursor).trim();
  if (tail) out.push({ tag: "p", marker: MARKERS.p!, inner: tail });
  return out.length > 0 ? out : [{ tag: "p", marker: MARKERS.p!, inner: html }];
}

export default video<MarkdownVideoData>({
  duration: "4.8s",
  fonts: [googleFont("Newsreader:wght@400;500;600"), googleFont("Inter:wght@400;500;600;700"), googleFont("JetBrains+Mono:wght@400;500")],
  inlineCss: [
    "* { margin: 0; padding: 0; box-sizing: border-box; }",
    "body { overflow: hidden; }",
    ".md { font-family: Newsreader, Georgia, serif; }",
    ".md strong { font-weight: 600; background-repeat: no-repeat; background-position: 0 88%; }",
    ".md em { font-style: italic; }",
    ".md a { text-decoration: none; background-repeat: no-repeat; background-position: 0 96%; }",
    ".md code { font-family: 'JetBrains Mono', ui-monospace, monospace; border-radius: 6px; }",
    ".gut { font-family: 'JetBrains Mono', ui-monospace, monospace; text-align: right; }",
  ],
  sample: {
    html: "<h1>🚀 Version 2.0 Released</h1><p>We've completely redesigned the dashboard with new features including <strong>real-time analytics</strong>, <code>API v2</code> support, and improved performance.</p>",
    raw: "# 🚀 Version 2.0 Released\n\nWe've completely redesigned the dashboard with new features including **real-time analytics**, `API v2` support, and improved performance.",
    wordCount: 24,
    theme: "dark",
    fontSize: "medium",
    showWordCount: true,
  },

  render(ctx: RenderContext<MarkdownVideoData>) {
    const { std, width, height, timeline, data } = ctx;
    const ease = (v: number, fn: Parameters<typeof std.interpolate>[3]) =>
      std.interpolate(v, [0, 1], [0, 1], fn);
    const p = PALETTES[data.theme === "light" ? "light" : "dark"] ?? PALETTES.dark;
    const scale = SCALE[String(data.fontSize)] ?? 1;
    const blocks = blocksOf(String(data.html ?? ""));

    const t = ctx.director({
      open: "0.5s",
      set: "2.6s",
      read: "1.2s",
      out: "0.5s",
    });
    const openP = ease(t.in("open"), "easeOutCubic");
    const setP = ease(t.in("set"), "easeInOutCubic");
    const readP = t.in("read");
    const outP = ease(t.in("out"), "easeInCubic");

    const px = (v: number) => Math.round(Math.min(width, height * 1.78) * v);
    const padX = Math.round(width * 0.09);
    const gutterW = px(0.038);
    const colW = Math.round(width * 0.6);
    const bodyPx = Math.round(px(0.026) * scale);

    const sizeOf = (tag: string) =>
      tag === "h1"
        ? Math.round(bodyPx * 1.85)
        : tag === "h2"
          ? Math.round(bodyPx * 1.45)
          : tag === "h3"
            ? Math.round(bodyPx * 1.2)
            : bodyPx;

    const landed = std.stagger.ms(blocks, setP, {
      windowSeconds: 2.6,
      eachMs: 260,
      capMs: 900,
      from: "start",
    });

    const rows = landed
      .map((entry, i) => {
        const block = blocks[i]!;
        const enter = entry.progress;
        const wipe = ((1 - enter) * 100).toFixed(2);
        const lift = ((1 - enter) * 12).toFixed(2);
        // Emphasis lands a beat after its line.
        const swipe = std.math.clamp((enter - 0.55) / 0.45, 0, 1);
        const size = sizeOf(block.tag);
        const weight = block.tag.startsWith("h") ? 600 : 400;
        const leading = block.tag.startsWith("h") ? 1.15 : 1.5;
        const gap = block.tag === "h1" ? px(0.02) : px(0.014);
        const tint = std.color.alpha(p.accent, 0.28);
        const inner = block.inner
          .replace(
            /<strong>/g,
            `<strong style="color:${p.ink};background-image:linear-gradient(${tint},${tint});background-size:${(swipe * 100).toFixed(1)}% 0.42em;">`,
          )
          .replace(
            /<code>/g,
            `<code style="background:${p.chip};color:${p.accent};padding:0.06em 0.3em;font-size:0.86em;opacity:${swipe.toFixed(3)};">`,
          )
          .replace(
            /<a /g,
            `<a style="color:${p.accent};background-image:linear-gradient(${p.accent},${p.accent});background-size:${(swipe * 100).toFixed(1)}% 2px;" `,
          );

        return `<div style="display:flex;gap:${px(0.018)}px;margin-bottom:${gap}px;opacity:${enter.toFixed(3)};transform:translateY(${lift}px);clip-path:inset(0 ${wipe}% -0.35em 0);">
          <span class="gut" style="width:${gutterW}px;flex:0 0 ${gutterW}px;color:${p.muted};font-size:${Math.round(bodyPx * 0.46)}px;line-height:${(size * leading).toFixed(1)}px;opacity:${(enter * 0.75).toFixed(3)};">${std.text.escapeHtml(block.marker)}</span>
          <span style="white-space:${block.tag === "pre" ? "pre-wrap" : "normal"};color:${p.ink};font-size:${size}px;line-height:${leading};font-weight:${weight};letter-spacing:${block.tag.startsWith("h") ? "-0.02em" : "0"};">${inner}</span>
        </div>`;
      })
      .join("");

    // Composition caret: deterministic blink from the timeline, never a CSS keyframe.
    const caretOn = readP > 0 ? (Math.floor(timeline.seconds * 2) % 2 === 0 ? 1 : 0) : 1;
    const caret = `<div style="height:${Math.round(bodyPx * 1.1)}px;width:3px;background:${p.accent};opacity:${(caretOn * std.math.clamp(setP * 2, 0, 1) * (1 - readP * 0.2)).toFixed(3)};margin-left:${gutterW + px(0.018)}px;"></div>`;

    const proseH = Math.round(height * 0.52);
    const prose = `<div class="md" style="width:${colW}px;">${rows}${caret}</div>`;

    const readMinutes = Math.max(1, Math.round(Number(data.wordCount ?? 0) / 200));
    const railH = Math.round(height * 0.5);

    return Frame(
      { id: "page", width, height, fill: p.ground, style: { opacity: 1 - outP } },

      // Margin rule the reading rides down.
      Frame({
        x: padX - px(0.03),
        y: Math.round((height - railH) / 2),
        width: 1,
        height: railH,
        fill: p.hair,
        style: { opacity: openP },
      }),
      Frame({
        x: padX - px(0.03) - 1,
        y: Math.round((height - railH) / 2),
        width: 3,
        height: Math.max(2, Math.round(railH * std.math.clamp(setP, 0, 1))),
        fill: p.accent,
        style: { opacity: std.interpolate(openP, [0.4, 1], [0, 1], "easeOutCubic") * Math.min(1, setP * 6) },
      }),

      Stack(
        {
          id: "sheet",
          width: "fill",
          height: "fill",
          justify: "space-between",
          pad: { x: padX, y: Math.round(height * 0.085) },
        },

        Stack(
          {
            direction: "row",
            width: "fill",
            height: px(0.026),
            align: "center",
            justify: "space-between",
            motion: t.motion({ id: "kicker", during: "open", y: 10 }),
          },
          Text(
            { variant: "label", color: p.accent, size: px(0.0135), weight: 700, letterSpacing: 5 },
            "MARKDOWN",
          ),
          Text(
            { variant: "label", color: p.muted, size: px(0.0135), fontFamily: MONO },
            `${blocks.length} blocks · ${readMinutes} min read`,
          ),
        ),

        Html({ id: "prose", width: colW + gutterW, height: proseH, html: prose }),

        Stack(
          {
            width: "fill",
            height: px(0.05),
            gap: px(0.012),
            style: { opacity: std.interpolate(setP, [0.5, 1], [0, 1], "easeOutCubic") },
          },
          Frame({ width: "fill", height: 1, fill: p.hair }),
          Stack(
            {
              direction: "row",
              width: "fill",
              height: px(0.028),
              align: "center",
              justify: "space-between",
            },
            Text(
              { variant: "label", color: p.muted, size: px(0.0145), fontFamily: MONO },
              data.showWordCount ? `${Number(data.wordCount ?? 0)} words` : "rendered from html",
            ),
            Text(
              { variant: "label", color: p.muted, size: px(0.0145), fontFamily: MONO },
              String(data.raw ?? "").split("\n")[0]?.slice(0, 48) ?? "",
            ),
          ),
        ),
      ),
    );
  },
});
