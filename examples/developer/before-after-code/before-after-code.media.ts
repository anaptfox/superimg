// Before / After Code — one transition, done for real: the diff collapses.
// Removed lines are struck and fold to nothing; added lines grow into the gap.

import { video, Frame, Stack, Text, Html, type RenderContext, googleFont } from "@foxworth/superimg";
import type { LangName } from "@foxworth/superimg/stdlib/code";

export interface CodeContent {
  code: string;
  language?: string;
  filename?: string;
  label?: string;
}

export interface BeforeAfterCodeData extends Record<string, unknown> {
  before: CodeContent;
  after: CodeContent;
  title: string;
  accentColor: string;
}

type OpKind = "keep" | "remove" | "add";
interface Op {
  kind: OpKind;
  text: string;
}

const PAPER = "#F5F2EA";
const PLATE = "#FDFCF8";
const INK = "#1C1E22";
const MUTED = "#797468";
const HAIR = "rgba(28,30,34,0.14)";
const CUT = "#B4232A";
const GROW = "#1B7A44";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

/** Line-level LCS so the transition folds only what actually changed. */
function diffLines(a: string[], b: string[]): Op[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      ops.push({ kind: "keep", text: a[i]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      ops.push({ kind: "remove", text: a[i]! });
      i++;
    } else {
      ops.push({ kind: "add", text: b[j]! });
      j++;
    }
  }
  while (i < m) ops.push({ kind: "remove", text: a[i++]! });
  while (j < n) ops.push({ kind: "add", text: b[j++]! });
  return ops;
}



export default video<BeforeAfterCodeData>({
  duration: "7.4s",
  fonts: [googleFont("JetBrains+Mono:wght@400;500;700"), googleFont("Inter:wght@400;500;600;700;800")],
  inlineCss: [
    "* { margin: 0; padding: 0; box-sizing: border-box; }",
    "body { overflow: hidden; }",
    "pre.shiki { margin: 0; padding: 0; background: transparent !important; }",
    "pre.shiki code { background: transparent !important; }",
    ".diff { display: flex; flex-direction: column; justify-content: center; }",
    ".drow { display: flex; align-items: center; overflow: hidden; white-space: pre; background-repeat: no-repeat; }",
    ".mark { flex-shrink: 0; text-align: center; }",
  ],
  sample: {
    title: "Four calls become one",
    before: {
      code: "const res = await fetch('/api/user');\nconst data = await res.json();\nif (!res.ok) throw new Error();\nconsole.log(data.name);",
      language: "javascript",
      filename: "raw-fetch.js",
      label: "MANUAL FETCH",
    },
    after: {
      code: "const user = await sdk.users.get();\nconsole.log(user.name);",
      language: "typescript",
      filename: "with-sdk.ts",
      label: "USING SDK",
    },
    accentColor: "#B4232A",
  },

  render(ctx: RenderContext<BeforeAfterCodeData>) {
    const { std, width, height, data } = ctx;
    const ease = (v: number, fn: Parameters<typeof std.interpolate>[3]) =>
      std.interpolate(v, [0, 1], [0, 1], fn);
    const before = data.before ?? { code: "" };
    const after = data.after ?? { code: "" };
    const title = String(data.title ?? "");
    const accent = String(data.accentColor ?? CUT);

    const beforeLines = String(before.code ?? "").replace(/\s+$/, "").split("\n");
    const afterLines = String(after.code ?? "").replace(/\s+$/, "").split("\n");
    const ops = diffLines(beforeLines, afterLines);
    const removals = ops.filter((o) => o.kind === "remove");
    const additions = ops.filter((o) => o.kind === "add");

    const t = ctx.director({
      open: "0.9s",
      before: "1.8s",
      fold: "1.3s",
      after: "2.8s",
      out: "0.6s",
    });

    const openP = ease(t.in("open"), "easeOutCubic");
    const foldP = ease(t.in("fold"), "easeInOutCubic");
    const afterP = t.in("after");
    const outP = ease(t.in("out"), "easeInCubic");

    const px = (v: number) => Math.round(Math.min(width, height * 1.78) * v);
    const plateW = Math.round(Math.min(width * 0.68, 1300));
    const longest = ops.reduce((max, op) => Math.max(max, op.text.length), 1);
    const codePx = Math.round(
      std.math.clamp((plateW - px(0.05) - px(0.06)) / (longest * 0.605), 18, 34),
    );
    const lineH = Math.round(codePx * 1.85);
    const markW = Math.round(codePx * 1.6);
    const restRows = Math.max(beforeLines.length, afterLines.length);
    const plateInnerH = restRows * lineH;

    function highlight(line: string, lang: string): string {
      if (!line.trim()) return "&nbsp;";
      try {
        const html = std.code.highlight(line, {
          lang: (lang || "typescript") as LangName,
          theme: "github-light",
        });
        return html.match(/<code[^>]*>([\s\S]*?)<\/code>/)?.[1]?.replace(/\n$/, "") ?? std.text.escapeHtml(line);
      } catch {
        return std.text.escapeHtml(line);
      }
    }

    const removalProgress = std.stagger(removals.length, std.clamp01(foldP / 0.78), { duration: 0.75, easing: "linear" });
    const additionProgress = std.stagger(additions.length, std.clamp01((foldP - 0.5) / 0.5), { duration: 0.8 });
    let removeIdx = 0;
    let addIdx = 0;
    const rowsHtml = ops
      .map((op) => {
        if (op.kind === "keep") {
          return `<div class="drow" style="height:${lineH}px;line-height:${lineH}px;font-size:${codePx}px;"><span class="mark" style="width:${markW}px;color:${HAIR};">·</span><span>${highlight(op.text, after.language ?? "typescript")}</span></div>`;
        }

        if (op.kind === "remove") {
          const i = removeIdx++;
          const progress = removalProgress[i]!;
          const strike = std.clamp01(progress / 0.42);
          const fold = std.clamp01((progress - 0.42) / 0.58);
          const h = lineH * (1 - fold);
          const op1 = (1 - fold) * (1 - fold * 0.4);
          return `<div class="drow" style="height:${h.toFixed(2)}px;line-height:${lineH}px;font-size:${codePx}px;opacity:${op1.toFixed(3)};background-color:rgba(180,35,42,${(0.07 * (1 - fold)).toFixed(3)});background-image:linear-gradient(${CUT},${CUT});background-size:${(strike * 100).toFixed(1)}% 2px;background-position:left center;"><span class="mark" style="width:${markW}px;color:${CUT};font-weight:700;">−</span><span>${highlight(op.text, before.language ?? "javascript")}</span></div>`;
        }

        const i = addIdx++;
        const grow = additionProgress[i]!;
        const h = lineH * grow;
        const slide = (1 - grow) * -14;
        return `<div class="drow" style="height:${h.toFixed(2)}px;line-height:${lineH}px;font-size:${codePx}px;opacity:${grow.toFixed(3)};transform:translateX(${slide.toFixed(2)}px);background-color:rgba(27,122,68,${(0.08 * (1 - afterP)).toFixed(3)});"><span class="mark" style="width:${markW}px;color:${GROW};font-weight:700;">+</span><span>${highlight(op.text, after.language ?? "typescript")}</span></div>`;
      })
      .join("");

    const showAfter = foldP > 0.5;
    const labelMix = std.interpolate(foldP, [0.42, 0.68], [0, 1], "easeInOutCubic");
    const beforeLabel = String(before.label ?? "BEFORE");
    const afterLabel = String(after.label ?? "AFTER");
    const filename = showAfter ? String(after.filename ?? "after") : String(before.filename ?? "before");

    const counted = Math.round(
      std.interpolate(foldP, [0.3, 0.95], [beforeLines.length, afterLines.length], "easeInOutCubic"),
    );

    const page = t.motion({ id: "page", during: "open", y: 20, exit: { y: -16 } });

    return Frame(
      { id: "stage", width, height, fill: PAPER, style: { opacity: 1 - outP } },
      Frame({
        width,
        height,
        fill: "radial-gradient(110% 80% at 50% 0%, rgba(255,255,255,0.75), transparent 68%)",
      }),
      Stack(
        {
          id: "page",
          width: "fill",
          height: "fill",
          align: "center",
          justify: "center",
          gap: px(0.026),
          motion: page,
        },

        title
          ? Stack(
              {
                gap: px(0.008),
                width: plateW,
                align: "center",
                style: { opacity: std.interpolate(openP, [0, 0.6], [0, 1], "easeOutCubic") },
              },
              Text(
                { variant: "label", color: accent, size: px(0.0135), weight: 700, letterSpacing: 4.4 },
                "REFACTOR",
              ),
              Text(
                {
                  variant: "display",
                  color: INK,
                  size: px(0.046),
                  weight: 800,
                  align: "center",
                  letterSpacing: -1.4,
                },
                title,
              ),
            )
          : null,

        Frame(
          {
            id: "plate",
            width: plateW,
            height: plateInnerH + px(0.09),
            radius: 12,
            fill: PLATE,
            overflow: "hidden",
            style: {
              border: `1px solid ${HAIR}`,
              boxShadow: "0 18px 46px rgba(28,30,34,0.10)",
              opacity: std.interpolate(openP, [0.2, 1], [0, 1], "easeOutCubic"),
            },
          },
          Stack(
            { width: "fill", height: "fill", pad: { x: px(0.016), y: px(0.012) }, gap: px(0.008) },
            Stack(
              {
                direction: "row",
                width: "fill",
                height: px(0.026),
                align: "center",
                justify: "space-between",
              },
              Text({ variant: "label", color: MUTED, size: px(0.0145), fontFamily: MONO }, filename),
              Frame(
                { width: Math.round(plateW * 0.3), height: px(0.026) },
                Stack(
                  {
                    direction: "row",
                    width: "fill",
                    height: px(0.026),
                    justify: "end",
                    align: "center",
                    style: { opacity: 1 - labelMix },
                  },
                  Text(
                    { variant: "label", color: MUTED, size: px(0.0135), weight: 700, letterSpacing: 2.6 },
                    beforeLabel,
                  ),
                ),
                Stack(
                  {
                    direction: "row",
                    width: "fill",
                    height: px(0.026),
                    justify: "end",
                    align: "center",
                    style: { opacity: labelMix },
                  },
                  Text(
                    { variant: "label", color: GROW, size: px(0.0135), weight: 700, letterSpacing: 2.6 },
                    afterLabel,
                  ),
                ),
              ),
            ),
            Frame({ width: "fill", height: 1, fill: HAIR }),
            Html({
              id: "diff",
              width: plateW - px(0.032),
              height: plateInnerH,
              html: `<div class="diff" style="width:100%;height:100%;font-family:${MONO};">${rowsHtml}</div>`,
            }),
          ),
        ),

        Stack(
          {
            direction: "row",
            width: plateW,
            height: px(0.032),
            align: "center",
            justify: "space-between",
            style: { opacity: std.interpolate(openP, [0.45, 1], [0, 1], "easeOutCubic") },
          },
          Text(
            {
              variant: "label",
              color: MUTED,
              size: px(0.0145),
              fontFamily: MONO,
            },
            `−${removals.length}  +${additions.length}`,
          ),
          Stack(
            { direction: "row", gap: px(0.008), align: "center", height: px(0.032) },
            Text(
              {
                variant: "title",
                color: afterP > 0 ? GROW : INK,
                size: px(0.024),
                weight: 700,
                fontFamily: MONO,
              },
              String(counted),
            ),
            Text({ variant: "label", color: MUTED, size: px(0.0145) }, "lines"),
          ),
        ),
      ),
    );
  },
});
