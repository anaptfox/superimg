import { Fill, Frame, Text, video, type RenderContext } from "@foxworth/superimg";
import { tile } from "./tile";

const BG = "#08090B";
const INK = "#F4F4F1";
const MUTED = "#90959E";
const BLUE = "#147DFF";
const RULE = "#252931";
const SANS = "'Helvetica Neue', Arial, sans-serif";
const MONO = "'SFMono-Regular', Consolas, 'Liberation Mono', monospace";
const BEATS = ["function", "source", "time", "delivery", "close"] as const;

function render(ctx: RenderContext) {
  const { width: w, height: h } = ctx;
  const s = Math.min(w / 1080, h / 1080);
  const portrait = h > w * 1.2;
  const compact = w / h < 1.4;
  const u = (n: number) => n * s;
  const margin = u(compact ? 80 : 120);
  const inner = w - margin * 2;
  const d = ctx.director({ function: "5s", source: "9s", time: "8s", delivery: "8s", close: "6s" });
  const active = d.active === "idle" ? "close" : d.active;
  const clip = d.clip({ during: active });
  const local = clip.director({ enter: "0.65s", hold: `${Math.max(0.1, clip.durationSeconds - 0.9)}s`, exit: "0.25s" });
  const enter = local.motion({ id: `${active}.entry`, during: "enter", y: u(24), exit: false });
  const opacity = active === "close" ? 1 : 1 - local.in("exit");

  function txt(id: string, value: string, x: number, y: number, size: number, options: { color?: string; mono?: boolean; weight?: number; width?: number } = {}) {
    return Frame(
      { id: `${id}.box`, x, y, width: options.width ?? inner, height: size * 1.5 },
      Text({ id, size, color: options.color ?? INK, fontFamily: options.mono ? MONO : SANS,
        weight: options.weight ?? 500, letterSpacing: options.mono ? 0 : -size * 0.045, lineHeight: 1.08,
        style: options.mono ? { whiteSpace: "pre" } : undefined }, value),
    );
  }
  function rule(id: string, x: number, y: number, width: number, color = RULE) {
    return Fill({ id, x, y, width: Math.max(1, width), height: u(1), color });
  }
  function header(number: string, title: string, note: string) {
    return [
      txt(`${active}.index`, number, margin, u(190), u(21), { color: BLUE, mono: true }),
      txt(`${active}.heading`, title, margin, u(244), u(compact ? 59 : 78), { weight: 600 }),
      txt(`${active}.note`, note, margin, u(350), u(compact ? 22 : 28), { color: MUTED, mono: true }),
    ];
  }
  function sampleCard(id: string, progress: number, x: number, y: number, size: number, label: string, selected = false) {
    return Frame(
      { id, x, y, width: size, height: size + u(75) },
      tile(progress, size, `${id}.tile`),
      rule(`${id}.underline`, 0, size + u(24), size, selected ? BLUE : RULE),
      txt(`${id}.caption`, label, 0, size + u(43), u(20), { color: selected ? INK : MUTED, mono: true, width: size }),
    );
  }

  const heroSize = compact ? u(92) : u(132);
  const heroTileSize = compact ? u(310) : u(420);
  const heroTileX = compact ? (w - heroTileSize) / 2 : w - margin - heroTileSize;
  const heroTileY = compact ? u(portrait ? 760 : 520) : u(350);
  const hero = () => Frame(
    { id: "works.function", width: w, height: h },
    txt("function.eyebrow", "A TYPESCRIPT LIBRARY FOR MEDIA", margin, u(236), u(22), { color: MUTED, mono: true }),
    txt("function.line1", "Media.", margin, u(310), heroSize, { weight: 600 }),
    txt("function.line2", "As a function.", margin, u(compact ? 414 : 452), heroSize, { weight: 600 }),
    Frame({ id: "function.specimen", x: heroTileX, y: heroTileY, width: heroTileSize, height: heroTileSize,
      motion: local.motion({ id: "function.tile-enter", during: "enter", at: "12%", for: "88%", scale: 0.9 }) },
      tile(local.tween(0, 1, { id: "function.tile-state", during: "enter", easing: "easeOutCubic" }), heroTileSize, "function.tile")),
    txt("function.signature", "render(context) → media tree", margin, compact ? heroTileY + heroTileSize + u(70) : u(767), u(compact ? 25 : 31), { mono: true }),
  );

  const codeX = margin;
  const codeY = u(458);
  const codeWidth = compact ? inner : u(930);
  const lineSize = u(compact ? 21 : 28);
  const lineHeight = u(compact ? 31 : 43);
  const code = [
    ['import { video } from "@foxworth/superimg";', BLUE],
    ['import { tile } from "./tile";', MUTED],
    ["", MUTED],
    ["export default video({", INK],
    ['  duration: "3s",', INK],
    ["  size: { width: 360, height: 360 },", INK],
    ["  render(ctx) {", INK],
    ["    return tile(ctx.timeline.progress);", BLUE],
    ["  },", INK],
    ["});", INK],
  ];
  const sourceTileSize = compact ? u(portrait ? 410 : 120) : u(360);
  const sourceTileX = compact ? w - margin - sourceTileSize : w - margin - sourceTileSize - u(36);
  const sourceTileY = compact ? u(portrait ? 970 : 840) : u(482);
  const source = () => Frame(
    { id: "works.source", width: w, height: h },
    header("01 / AUTHOR", "Write the scene.", "A real program. An actual rendered tree."),
    Frame({ id: "source.code", x: codeX, y: codeY, width: codeWidth, height: lineHeight * 10 + u(54) },
      Fill({ color: "#101216" }),
      rule("source.code-top", 0, 0, codeWidth),
      ...code.flatMap(([line, color], i) => line ? [txt(`source.line-${i}`, line, u(28), u(30) + i * lineHeight, lineSize, { color, mono: true, width: codeWidth - u(55) })] : [])),
    Frame({ id: "source.output", x: sourceTileX, y: sourceTileY, width: sourceTileSize, height: sourceTileSize },
      tile(local.transition("1.5s", "2.2s", "easeInOutCubic"), sourceTileSize, "source.tile")),
    txt("source.output-label", "Frame / Fill / Text", compact ? margin : sourceTileX, compact ? u(940) : sourceTileY + sourceTileSize + u(45), u(compact ? 19 : 23), { color: MUTED, mono: true, width: inner }),
  );

  // The selected input jumps backwards, then returns. The specimen is a pure
  // function, so repeated p=0.5 calls produce the same authored tree.
  const selected = clip.seconds < 2.6 ? 1 : clip.seconds < 4.3 ? 2 : 1;
  const sampleSize = compact ? u(238) : u(340);
  const sampleGap = (inner - sampleSize * 3) / 2;
  const sampleY = u(portrait ? 700 : 440);
  const time = () => Frame(
    { id: "works.time", width: w, height: h },
    header("02 / EVALUATE", "Time is an input.", "Seek. Sample. Return to the same state."),
    ...[0, 0.5, 1].map((p, i) => sampleCard(`time.sample-${i}`, p, margin + i * (sampleSize + sampleGap), sampleY, sampleSize,
      ["p = 0.0", "p = 0.5", "p = 1.0"][i], selected === i)),
    rule("time.axis", margin, sampleY + sampleSize + u(100), inner),
    Fill({ id: "time.playhead", x: margin + selected * (sampleSize + sampleGap) + sampleSize / 2 - u(5),
      y: sampleY + sampleSize + u(94), width: u(10), height: u(14), color: BLUE }),
    txt("time.expression", `tile(${["0.0", "0.5", "1.0"][selected]})`, margin, sampleY + sampleSize + u(140), u(30), { mono: true }),
    txt("time.invariant", "same input → same authored state", compact ? margin : w - margin - u(620), sampleY + sampleSize + u(compact ? 188 : 146), u(compact ? 23 : 25), { color: MUTED, mono: true, width: u(700) }),
  );

  function rendition(id: string, x: number, y: number, rw: number, rh: number, caption: string) {
    const tileSize = Math.min(rw, rh) * 0.46;
    const square = Math.abs(rw - rh) < 1;
    const tall = rh > rw;
    return Frame({ id, x, y, width: rw, height: rh + u(55) },
      Frame({ id: `${id}.screen`, width: rw, height: rh },
        Fill({ color: "#14171C" }),
        rule(`${id}.top-edge`, 0, 0, rw, "#4A505A"),
        Frame({ id: `${id}.art`, x: tall || square ? (rw - tileSize) / 2 : rw - tileSize - rw * 0.08,
          y: tall || square ? rh * 0.18 : (rh - tileSize) / 2, width: tileSize, height: tileSize }, tile(0.5, tileSize, `${id}.tile`)),
        txt(`${id}.wordmark`, "SuperImg", tall || square ? rw * 0.12 : rw * 0.08,
          tall ? rh * 0.7 : square ? rh * 0.78 : rh * 0.39, rw * (tall ? 0.15 : 0.088), { weight: 600, width: rw * 0.82 })),
      txt(`${id}.dimensions`, caption, 0, rh + u(25), u(compact ? 16 : 21), { color: MUTED, mono: true, width: rw }),
    );
  }
  const deliveryBase = u(portrait ? 1180 : 760);
  const landscapeW = Math.min(inner * 0.435, u(600));
  const squareW = Math.min(inner * 0.265, u(330));
  const portraitW = Math.min(inner * 0.15, u(180));
  const delivery = () => Frame(
    { id: "works.delivery", width: w, height: h },
    header("03 / DELIVER", "Author once.", "Direct each format."),
    rendition("delivery.landscape", margin, deliveryBase - landscapeW * 9 / 16, landscapeW, landscapeW * 9 / 16, "1920 × 1080"),
    rendition("delivery.square", margin + inner * 0.478, deliveryBase - squareW, squareW, squareW, "1080 × 1080"),
    rendition("delivery.portrait", margin + inner * 0.825, deliveryBase - portraitW * 16 / 9, portraitW, portraitW * 16 / 9, "1080 × 1920"),
    rule("delivery.divider", margin, deliveryBase + u(92), inner),
    txt("delivery.command", "$ superimg export works.media.ts", margin, deliveryBase + u(125), u(compact ? 21 : 27), { mono: true }),
    txt("delivery.targets", "  --for youtube --for instagram-square", margin, deliveryBase + u(167), u(compact ? 21 : 27), { mono: true, color: BLUE }),
  );

  const close = () => Frame(
    { id: "works.close", width: w, height: h },
    txt("close.import", 'import { video } from "@foxworth/superimg";', margin, u(portrait ? 500 : 330), u(compact ? 25 : 33), { color: BLUE, mono: true }),
    Frame(
      // Literal source transform is intentionally editable through Edit interactions.
      { id: "works.end.title", x: 120, y: 420, width: 1680, height: 220,
        style: compact ? { transform: `translate(${margin - 120}px, ${u(portrait ? 650 : 430) - 420}px) scale(${s * 0.58})`, transformOrigin: "top left" } : undefined },
      Text({ id: "close.wordmark", size: 184, weight: 600, color: INK, letterSpacing: -11, fontFamily: SANS }, "SuperImg")),
    txt("close.tagline", "Build media like software.", margin, u(portrait ? 835 : 680), u(compact ? 38 : 52), { weight: 400 }),
    txt("close.capabilities", "TypeScript  /  explicit time  /  portable output", margin, u(portrait ? 960 : 817), u(compact ? 19 : 24), { color: MUTED, mono: true }),
  );

  const content = { function: hero, source, time, delivery, close }[active]();
  return Frame({ id: "works.stage", width: w, height: h },
    Fill({ id: "works.background", color: BG }),
    ...Array.from({ length: 9 }, (_, i) => Fill({ id: `grid.vertical-${i}`, x: margin + inner * i / 8, y: u(133), width: u(1), height: h - u(245), color: "#14171B" })),
    txt("brand", "SuperImg", margin, u(64), u(31), { weight: 600 }),
    txt("film-id", "LIBRARY / WORKS 001", w - margin - u(310), u(72), u(19), { color: MUTED, mono: true, width: u(315) }),
    rule("top-rule", margin, u(133), inner),
    Frame({ id: `scene.${active}`, width: w, height: h, style: { opacity }, motion: enter }, content),
    rule("footer.rule", margin, h - u(105), inner),
    txt("footer.left", "AUTHORED WITH SUPERIMG", margin, h - u(76), u(18), { mono: true, color: MUTED }),
    txt("footer.right", `0${BEATS.indexOf(active) + 1} / 05`, w - margin - u(105), h - u(76), u(18), { mono: true, color: MUTED, width: u(110) }),
    Fill({ id: "footer.progress", x: margin, y: h - u(105), width: Math.max(u(1), inner * ctx.timeline.progress), height: u(2), color: BLUE }),
  );
}

export default video({
  duration: "36s",
  fps: 30,
  size: { width: 1920, height: 1080 },
  render,
  editions: { square: { size: { width: 1080, height: 1080 }, render } },
});
