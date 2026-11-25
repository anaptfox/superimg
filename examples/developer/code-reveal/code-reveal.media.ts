// Code Reveal — the code door. A full-bleed listing sheet, not a window skin.
// Lines land in a cascade; the gutter rail draws down behind them.

import { video, layoutTimeline, Frame, Stack, Text, Html, type RenderContext, googleFont } from "@foxworth/superimg";
import type { LangName, ThemeName } from "@foxworth/superimg/stdlib/code";

export interface CodeRevealData extends Record<string, unknown> {
  code: string;
  language: string;
  filename: string;
  theme: "dark" | "light";
  showLineNumbers: boolean;
}

interface Palette {
  bg: string;
  plate: string;
  ink: string;
  gutter: string;
  hair: string;
  accent: string;
  shiki: ThemeName;
}

const PALETTES: Record<"dark" | "light", Palette> = {
  dark: {
    bg: "#080B11",
    plate: "#0D111A",
    ink: "#C7D1E3",
    gutter: "#758299",
    hair: "rgba(199,209,227,0.10)",
    accent: "#FF7A45",
    shiki: "dark-plus",
  },
  light: {
    bg: "#EFEBE2",
    plate: "#FCFAF6",
    ink: "#1E232E",
    gutter: "#777063",
    hair: "rgba(30,35,46,0.12)",
    accent: "#C2410C",
    shiki: "github-light",
  },
};

const SAMPLE_CODE = `import { userSchema } from "./schema";

export async function getUser(id: string) {
  const res = await fetch(\`/api/users/\${id}\`);

  if (!res.ok) {
    throw new HttpError(res.status, "user lookup failed");
  }

  return userSchema.parse(await res.json());
}`;

function codeLines(data: CodeRevealData): string[] {
  const src = typeof data.code === "string" && data.code.length > 0 ? data.code : SAMPLE_CODE;
  return src.replace(/\s+$/, "").split("\n");
}

/** One pure plan so resolve() and render() agree on the cascade window. */
function plan(data: CodeRevealData) {
  const lines = codeLines(data);
  return layoutTimeline({
    open: 0.55,
    listing: Math.max(1.1, 0.42 + lines.length * 0.15),
    hold: 1.5,
    out: 0.4,
  });
}



export default video<CodeRevealData>({
  duration: "4s", // AST fallback; resolve() owns the real length
  fonts: [googleFont("JetBrains+Mono:wght@400;500;700"), googleFont("Inter:wght@500;600;700")],
  inlineCss: [
    "* { margin: 0; padding: 0; box-sizing: border-box; }",
    "body { overflow: hidden; }",
    ".listing { position: relative; font-family: 'JetBrains Mono', ui-monospace, monospace; }",
    ".row { display: flex; position: relative; white-space: pre; }",
    ".num { flex-shrink: 0; text-align: right; font-variant-numeric: tabular-nums; }",
    ".src { flex: 1; }",
  ],
  sample: {
    code: SAMPLE_CODE,
    language: "typescript",
    filename: "lib/get-user.ts",
    theme: "dark",
    showLineNumbers: true,
  },

  resolve({ data }) {
    const { totalSeconds, phases } = plan(data as CodeRevealData);
    return { duration: `${totalSeconds}s`, phases };
  },

  render(ctx: RenderContext<CodeRevealData>) {
    const { std, width, height, data } = ctx;
    const ease = (v: number, fn: Parameters<typeof std.interpolate>[3]) =>
      std.interpolate(v, [0, 1], [0, 1], fn);
    const language = String(data.language ?? "typescript");
    const filename = String(data.filename ?? "untitled.ts");
    const showNumbers = data.showLineNumbers !== false;
    const p = PALETTES[data.theme === "light" ? "light" : "dark"];

    const lines = codeLines(data);
    const timings = plan(data);
    const t = ctx.director(timings.phases);
    const openP = ease(t.in("open"), "easeOutCubic");
    const listingP = t.in("listing");
    const holdP = t.in("hold");

    const sheetW = Math.round(Math.min(width * 0.74, 1420));
    const chromeH = Math.round(height * 0.075);
    const plateH = Math.round(height - chromeH * 2 - height * 0.16);

    // Fit the listing to the sheet instead of trusting a fontSize enum.
    const longest = lines.reduce((max, line) => Math.max(max, line.length), 1);
    const gutterW = showNumbers ? Math.round(sheetW * 0.055) : 0;
    const byWidth = (sheetW - gutterW - 96) / (longest * 0.6);
    const byHeight = plateH / (lines.length * 1.66 + 1.2);
    const codePx = Math.round(std.math.clamp(Math.min(byWidth, byHeight), 16, 40));
    const lineH = Math.round(codePx * 1.66);

    const cascade = std.stagger.ms(lines, listingP, {
      windowSeconds: Math.max(1.1, 0.42 + lines.length * 0.15),
      eachMs: 55,
      capMs: 520,
      from: "start",
    });

    function highlightLine(line: string): string {
      if (!line.trim()) return "&nbsp;";
      try {
        const html = std.code.highlight(line, {
          lang: language as LangName,
          theme: p.shiki,
        });
        const inner = html.match(/<code[^>]*>([\s\S]*?)<\/code>/)?.[1];
        return inner ? inner.replace(/\n$/, "") || "&nbsp;" : std.text.escapeHtml(line);
      } catch {
        return std.text.escapeHtml(line);
      }
    }

    const rows = cascade
      .map((entry, i) => {
        const eased = entry.progress;
        const y = (1 - eased) * 10;
        const numColor = eased >= 1 ? p.gutter : std.color.mix(p.gutter, p.accent, eased);
        const num = showNumbers
          ? `<span class="num" style="width:${gutterW}px;padding-right:${Math.round(codePx * 0.9)}px;color:${numColor};opacity:${(0.55 + eased * 0.45).toFixed(3)};">${i + 1}</span>`
          : "";
        return `<div class="row" style="height:${lineH}px;line-height:${lineH}px;opacity:${eased.toFixed(3)};transform:translateY(${y.toFixed(2)}px);">${num}<span class="src">${highlightLine(lines[i]!)}</span></div>`;
      })
      .join("");

    // The cascade front is the focal point; it dissolves once the code settles.
    const front = cascade.findIndex((entry) => entry.progress < 1);
    const frontIndex = front === -1 ? lines.length - 1 : front;
    const bandOp = std.interpolate(listingP, [0, 0.08], [0, 1], "easeOutCubic") * (1 - holdP);
    const band = `<div style="position:absolute;left:0;right:0;top:${frontIndex * lineH}px;height:${lineH}px;background:linear-gradient(90deg, ${std.color.alpha(p.accent, 0.16)}, ${std.color.alpha(p.accent, 0.02)} 62%, transparent);opacity:${bandOp.toFixed(3)};"></div>`;

    const railRows = listingP >= 1 ? lines.length : frontIndex + cascade[frontIndex]!.progress;
    const rail = showNumbers
      ? `<div style="position:absolute;left:${gutterW - Math.round(codePx * 0.45)}px;top:0;width:2px;height:${(railRows * lineH).toFixed(1)}px;background:${std.color.alpha(p.accent, holdP > 0 ? 0.3 : 0.65)};"></div>`
      : "";

    const plateHtml = `<div class="listing" style="width:100%;height:100%;font-size:${codePx}px;color:${p.ink};">${band}${rail}${rows}</div>`;

    const sheet = t.motion({ id: "sheet", during: "open", y: 22, exit: { y: -16 } });
    const labelPx = Math.round(Math.min(width, height) * 0.019);
    const contentH = lines.length * lineH;

    return Frame(
      { id: "stage", width, height, fill: p.bg },
      Frame({
        width,
        height,
        fill:
          data.theme === "light"
            ? "radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,0.9), transparent 65%)"
            : "radial-gradient(110% 80% at 50% 8%, rgba(255,122,69,0.10), transparent 62%)",
      }),
      Stack(
        {
          id: "sheet",
          width: "fill",
          height: "fill",
          align: "center",
          justify: "center",
          gap: Math.round(chromeH * 0.42),
          motion: sheet,
        },
        Stack(
          {
            direction: "row",
            width: sheetW,
            height: Math.round(labelPx * 2.1),
            align: "center",
            justify: "space-between",
            style: { opacity: std.interpolate(openP, [0.15, 1], [0, 1], "easeOutCubic") },
          },
          Stack(
            { direction: "row", gap: Math.round(labelPx * 0.8), align: "center", height: Math.round(labelPx * 2.1) },
            Frame({ width: 3, height: Math.round(labelPx * 1.5), fill: p.accent }),
            Text(
              {
                variant: "label",
                color: p.ink,
                size: labelPx,
                weight: 500,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              },
              filename,
            ),
          ),
          Text(
            {
              variant: "label",
              color: p.gutter,
              size: Math.round(labelPx * 0.82),
              weight: 600,
              letterSpacing: 3,
            },
            language.toUpperCase(),
          ),
        ),
        Frame(
          {
            id: "plate",
            width: sheetW,
            height: Math.max(contentH + Math.round(codePx * 1.6), Math.round(codePx * 4)),
            radius: 10,
            fill: p.plate,
            overflow: "hidden",
            pad: { x: Math.round(codePx * 1.4), y: Math.round(codePx * 0.8) },
            style: { border: `1px solid ${p.hair}` },
          },
          Html({
            id: "listing",
            width: sheetW - Math.round(codePx * 2.8),
            height: contentH,
            html: plateHtml,
          }),
        ),
        Stack(
          {
            direction: "row",
            width: sheetW,
            height: Math.round(labelPx * 1.8),
            align: "center",
            justify: "space-between",
            style: { opacity: std.interpolate(openP, [0.35, 1], [0, 1], "easeOutCubic") },
          },
          Text(
            {
              variant: "label",
              color: p.gutter,
              size: Math.round(labelPx * 0.82),
              weight: 500,
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            },
            `${lines.length} lines`,
          ),
          Text(
            {
              variant: "label",
              color: holdP > 0 ? p.accent : p.gutter,
              size: Math.round(labelPx * 0.82),
              weight: 600,
              letterSpacing: 2.4,
            },
            holdP > 0 ? "READY" : `${Math.round(listingP * 100)}%`,
          ),
        ),
      ),
    );
  },
});
