// Code focus — keep the whole function in view while one step owns the explanation.
// Code owns highlighting and escaping; the director only changes the focus paint.
import { video, Frame, Stack, Text, Code, Fill, googleFont } from "@foxworth/superimg";

const STEPS = [
  {
    id: "lookup",
    title: "Check the cache",
    note: "Return immediately when the value is already available.",
    code: "const cached = cache.get(id);\nif (cached !== undefined) return cached;",
  },
  {
    id: "load",
    title: "Load the missing value",
    note: "Only a cache miss reaches the data source.",
    code: "const user = await fetchUser(id);",
  },
  {
    id: "remember",
    title: "Remember the result",
    note: "The next call with this id can take the fast path.",
    code: "cache.set(id, user);\nreturn user;",
  },
] as const;

export default video({
  duration: "10s",
  poster: "9s",
  fonts: [googleFont("JetBrains+Mono:wght@400;500"), googleFont("Inter:wght@400;600;700")],
  inlineCss: [
    "* { margin: 0; box-sizing: border-box; } body { overflow: hidden; }",
    ".focus-code pre, .focus-code code { font: inherit; line-height: 1.6; background: transparent !important; }",
  ],
  editions: { square: { size: { width: 1080, height: 1080 } } },
  sample: { title: "A cache, in three steps", filename: "get-user.ts", accent: "#285DAB" },
  render(ctx) {
    const { width, height, data, std } = ctx;
    const t = ctx.director({ enter: "0.6s", explain: "7.8s", hold: "1.6s" });
    const beat = t.beats({ during: "explain", of: STEPS.map((step) => step.id), cross: "12%" });
    const narrow = width < height * 1.3;
    const pad = Math.round(width * 0.065);
    const contentW = width - pad * 2;
    const headerH = 128;
    const gap = 22;
    const rowH = (height - pad * 2 - headerH - gap * 2) / STEPS.length;
    const codeW = narrow ? contentW - 48 : Math.round(contentW * 0.59);
    const codeSize = narrow ? 26 : 31;

    return Frame(
      { id: "stage", width, height, fill: "#F2F4F7" },
      Frame(
        { id: "sheet", x: pad, y: pad, width: contentW, height: height - pad * 2, motion: t.motion({ id: "sheet", during: "enter", y: 18 }) },
        Stack(
          { width: contentW, gap: 14 },
          Text({ id: "title", variant: "title", size: narrow ? 44 : 58, color: "#17212F", weight: 700 }, data.title),
          Text({ id: "filename", variant: "label", size: 23, color: "#586779", fontFamily: "JetBrains Mono, monospace" }, data.filename),
        ),
        ...STEPS.map((step, index) => {
          const focus = beat.crossing
            ? step.id === beat.from ? 1 - beat.mix : step.id === beat.to ? beat.mix : 0
            : step.id === beat.name ? 1 : 0;
          return Frame(
            { id: `step-${step.id}`, x: 0, y: headerH + index * (rowH + gap), width: contentW, height: rowH, radius: 12, style: { border: `2px solid ${std.color.mix(data.accent, "#D8DEE8", focus)}` } },
            Fill({ id: `panel-${step.id}`, width: "fill", height: "fill", radius: 12, color: "#FFFFFF" }),
            Fill({ id: `focus-${step.id}`, x: 0, y: 16, width: 5, height: rowH - 32, radius: 3, color: data.accent, style: { opacity: focus } }),
            Code({
              id: `code-${step.id}`,
              className: "focus-code",
              x: 24,
              y: narrow ? 12 : (rowH - 132) / 2,
              width: codeW,
              height: 132,
              code: step.code,
              lang: "typescript",
              theme: "github-light",
              pad: 0,
              style: { fontFamily: "JetBrains Mono, monospace", fontSize: codeSize, fontVariantLigatures: "none" },
            }),
            Frame(
              { id: `note-${step.id}`, x: narrow ? 24 : codeW + 48, y: narrow ? 122 : 42, width: narrow ? codeW : contentW - codeW - 72, height: narrow ? rowH - 130 : rowH - 70 },
              Stack(
                { width: "fill", gap: 10 },
                Text({ variant: "label", size: narrow ? 25 : 29, color: "#17212F", weight: 700 }, `${index + 1}. ${step.title}`),
                Text({ variant: "body", size: narrow ? 21 : 25, color: "#586779", style: { opacity: 0.75 + focus * 0.25 } }, step.note),
              ),
            ),
          );
        }),
      ),
    );
  },
});
