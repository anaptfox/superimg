// SuperImg launch film: one scene, reused, revised and published again.
//
//   reuse     a film of Peg on a pencil-test sheet becomes a poster, then a website
//   batch     the same scene is printed as two campaign kits (poster, social card, banner)
//   revise    Peg learns a new trick: it deals its blue slab, and a tiny sun hops on it
//   world     the slab's hills grow into the surroundings
//   again     the richer film is printed as a poster and published as a website
//   close     the campaign kit returns under "Media as code."
//
// Everything is a pure function of ctx.timeline.seconds through one director
// plan (./cut/plan.ts). Peg is one shared visual (./peg/visual.ts) mounted for
// each performance and print; its clay art is the accepted painter, drawn as
// opaque SVG. Every word is typed text.
//
// The composition is authored in "stage units": the stage is 546 units tall
// and as wide as the output's aspect needs; one unit is height / 546 pixels.

import { Frame, Image, Instance, Scene, Spacer, Stack, Text, Vector, vector, video, type MediaChild } from "@foxworth/superimg";
import { clamp, lerp } from "@foxworth/superimg/stdlib/math";
import { easeInOutCubic, easeInQuad, easeOutQuad } from "@foxworth/superimg/stdlib/easing";
import { fanSvg, PEG_BOX, SCENE_BOX, svgUri, trickSvg, type Clock } from "./peg/art";
import { peg } from "./peg/visual";
import { sampleDirector } from "./peg/clock";
import { tint } from "./peg/kit";
import { studio } from "./peg/world";
import type { Place } from "./peg/clay";
import { END, fanTime, performer, plan, sceneTime, trickTime, type Act, type Cue } from "./cut/plan";
import { camera, marks, paperSvg, sheet, viewBox, viewFor } from "./cut/sheet";
import { ENTRIES, FORMATS, arrangement, print } from "./cut/prints";
import { FILM, POSTER, STAGE, artFor, hopDots, type Mount } from "./cut/land";
import { FONT, fontsAt } from "./cut/type";

type Rect = { x: number; y: number; w: number; h: number };
type Anchor = { x: number; y: number; s: number };

/** Stage height in units: the accepted wide layout's height. */
const STAGE_H = 546;

const colour = {
  desk: sheet.desk,
  paper: sheet.paper[1],
  stock: "#1e1915",
  page: "#f8f6f1",
  stage: "#ece9f3",
  ink: "#191b21",
  soft: "#5d6170",
  cream: "#f3ebda",
  accent: "#ff8552",
};
const places: Record<"film" | "poster" | "site", Place> = {
  film: sheet.place,
  poster: { fx: "#f3ebda", shadow: "#000000" },
  site: { fx: "#1d2a44", shadow: "#c7c2d6" },
};
const copy = {
  name: "SuperImg",
  headline: ["Media", "as code"],
  line: "You can reuse it. Imagine that.",
  eyebrow: "Media as code",
  heading: "Generate something reusable for once.",
  reclaim: "Take it back",
  pause: "Pause scene",
  steps: [
    ["Reuse", "The same scene in a film, a poster and this page."],
    ["Revise", "Change its source once."],
    ["Publish again", "Rebuild every place it appears."],
  ],
};

const mixRect = (a: Rect, b: Rect, u: number): Rect => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), w: lerp(a.w, b.w, u), h: lerp(a.h, b.h, u) });
const mixAnchor = (a: Anchor, b: Anchor, u: number): Anchor => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), s: a.s * Math.pow(b.s / a.s, u) });
/** Peg's lent colours, mixed by the painter's own tint so a world's colours arrive exactly. */
const mixPlace = (a: Place, b: Place, u: number): Place => ({ fx: tint(a.fx, b.fx, u), shadow: tint(a.shadow, b.shadow, u) });
/** Lent colours change in eight steps, as in the accepted opening. */
const steps = (u: number) => Math.round(u * 8) / 8;
const scaleAbout = (r: Rect, ox: number, oy: number, k: number): Rect => ({ x: ox + (r.x - ox) * k, y: oy + (r.y - oy) * k, w: r.w * k, h: r.h * k });
/** Where a composition placed with "slice" (xMid, yMid or yMax) puts its floor point. */
function sliceAnchor(R: Rect, cw: number, ch: number, m: Mount, yMax = false): Anchor {
  const k = Math.max(R.w / cw, R.h / ch);
  const ox = R.x + (R.w - cw * k) / 2, oy = yMax ? R.y + R.h - ch * k : R.y + (R.h - ch * k) / 2;
  return { x: ox + m.fx * k, y: oy + m.fy * k, s: m.s * k };
}
/** A kit (4:5 poster beside a 1:1 card, a 3:1 banner under both), as large as fits in `area`. */
function kitIn(area: Rect, g: number): [Rect, Rect, Rect] {
  const h1 = Math.min((area.w - g) / 1.8, (area.h - g - g / 3) / 1.6);
  const rowW = 1.8 * h1 + g, total = h1 + g + rowW / 3;
  const x = area.x + (area.w - rowW) / 2, y = area.y + (area.h - total) / 2;
  return [{ x, y, w: 0.8 * h1, h: h1 }, { x: x + 0.8 * h1 + g, y, w: h1, h: h1 }, { x, y: y + h1 + g, w: rowW, h: rowW / 3 }];
}

/** Everything that depends only on the output size, in stage units. */
function layoutFor(W: number) {
  const H = STAGE_H;
  const film: Rect = { x: 0, y: 0, w: W, h: H };
  const cam: Rect = { x: -W * 0.015, y: -H * 0.015, w: W * 1.03, h: H * 1.03 };
  const view = viewFor(W / H);
  const poster: Rect = { x: (W - (H - 48) * 0.8) / 2, y: 24, w: (H - 48) * 0.8, h: H - 48 };

  // The opening's website: nav across, copy left, the stage and its controls right.
  const inner = W - 64, col1 = (inner - 30) * 0.41, col2 = (inner - 30) * 0.59;
  const rowTop = 24 + 34, rowH = H - 28 - rowTop;
  const stageH = (col2 * 222) / 300;
  const demoTop = rowTop + (rowH - (stageH + 44)) / 2;
  const stage: Rect = { x: 32 + col1 + 30, y: demoTop, w: col2, h: stageH };
  const copyH = 17.4 + 8 + 3 * 30 * 1.08 + 12 + 16;
  const copyTop = rowTop + (rowH - copyH) / 2;
  const site = {
    stage,
    controls: { x: stage.x, y: stage.y + stage.h + 10, w: col2, h: 34 },
    wm: { x: 32, y: 24, size: 15 },
    navRule: { x: 32, y: 49, w: inner },
    eyebrow: { x: 32, y: copyTop },
    heading: { x: 32, y: copyTop + 25.4, w: col1 },
    body: { x: 32, y: copyTop + 17.4 + 8 + 97.2 + 12, size: 16 },
  };

  // The website, published again: nav, land and Peg in the hero, steps along the foot.
  const navH = 13 + 13.5 * 1.45 + 9 + 1, stepsH = 10 + 3 * 12 * 1.3 + 12;
  const hero: Rect = { x: 0, y: navH, w: W, h: H - navH - stepsH };

  // The campaign kits: the first entry alone, both side by side, and the close under its headline.
  const m = 28, g = 12;
  const box: Rect = { x: m, y: m, w: W - 2 * m, h: H - 2 * m };
  const halves = (r: Rect): [Rect, Rect] => [{ ...r, w: (r.w - 2 * g) / 2 }, { ...r, x: r.x + (r.w + 2 * g) / 2, w: (r.w - 2 * g) / 2 }];
  const band = 44, gap = 22;
  const below: Rect = { ...box, y: box.y + band + gap, h: box.h - band - gap };
  const [a, b] = halves(box), [ea, eb] = halves(below);
  const kit = { single: kitIn(box, g), a: kitIn(a, g * 0.75), b: kitIn(b, g * 0.75), endA: kitIn(ea, g * 0.75), endB: kitIn(eb, g * 0.75) };
  const closeTop = Math.min(kit.endA[0].y, kit.endB[0].y) - gap - band;

  // Peg's floor point and scale in each use.
  const fs = cam.w / view.w;
  const ps = poster.w / 400;
  const ss = Math.min(stage.w / 300, stage.h / 222);
  const first = arrangement(ENTRIES[0], FORMATS[0]).peg;
  const anchor = {
    film: { x: cam.x - view.x * fs, y: cam.y - view.y * fs, s: fs },
    poster: { x: poster.x + 196 * ps, y: poster.y + 418 * ps, s: 1.32 * ps },
    site: { x: stage.x + (stage.w - 300 * ss) / 2 + 150 * ss, y: stage.y + (stage.h - 222 * ss) / 2 + 196 * ss, s: ss },
    studio: sliceAnchor(film, FILM.W, FILM.H, FILM.mount),
    poster2: { x: poster.x + POSTER.mount.fx * ps, y: poster.y + POSTER.mount.fy * ps, s: POSTER.mount.s * ps },
    site2: sliceAnchor(hero, STAGE.W, STAGE.H, STAGE.mount, true),
    /** The first print's own Peg, in whichever rect that print occupies. */
    inPrint: (R: Rect): Anchor => { const k = R.w / 1080; return { x: R.x + first.x * k, y: R.y + first.floor * k, s: first.scale * k }; },
  };
  return { W, H, film, cam, view, poster, site, hero, kit, closeTop, anchor };
}

export default video({
  duration: `${END}s`,
  fps: 30,
  size: { width: 1920, height: 1080 },
  fonts: fontsAt(file => new URL(`./assets/fonts/${file}`, import.meta.url).pathname),
  sample: {},
  render(ctx) {
    const { std } = ctx;
    const u = ctx.height / STAGE_H;
    const L = layoutFor(ctx.width / u);
    const t = ctx.timeline.seconds;
    const d = ctx.director(plan);
    const color = std.color;
    const art = artFor(color);
    const clock: Clock = { director: sampleDirector(ctx), oscillate: std.oscillate, radToDeg: std.math.radToDeg };

    /**
     * a → b with the stdlib's mix. The accepted cut mixed in linear light: a page
     * brightens early and darkens late. The weight follows that shape, so type
     * flips from cream to ink while the page behind it is already light.
     */
    const mixc = (a: string, b: string, v: number) => {
      if (v <= 0) return a;
      if (v >= 1) return b;
      const toLight = color.isLight(b) && !color.isLight(a), toDark = color.isLight(a) && !color.isLight(b);
      return color.mix(b, a, toLight ? easeOutQuad(v) : toDark ? easeInQuad(v) : v);
    };
    const fd = (c: Cue) => d.span(c, { ease: "inOutCubic" });
    const lin = (c: Cue) => d.span(c, { ease: "linear" });
    const out = (c: Cue) => d.span(c, { ease: "outCubic" });
    const bell = (c: Cue) => d.tween(0, 1, { id: `${c}-arc`, during: c, pattern: "sine" });
    const after = (a: Act) => t >= plan.acts[a][0] - 1e-9;

    // Stage units → pixels.
    const px = (v: number) => v * u;
    const at = (r: Rect) => ({ x: px(r.x), y: px(r.y), width: px(r.w), height: px(r.h) });
    const op = (a: number) => (a >= 0.999 ? undefined : { opacity: Number(a.toFixed(3)) });
    const shown = (a: number) => a > 0.004;
    const shadowCss = (k: number, y: number, blur: number, spread: number, a1: number, a2: number) =>
      k > 0.01 ? `0 ${px(1)}px ${px(2)}px rgba(0,0,0,${(a1 * k).toFixed(3)}),0 ${px(y)}px ${px(blur)}px ${px(spread)}px rgba(0,0,0,${(a2 * k).toFixed(3)})` : undefined;
    const sans = (text: string, size: number, color_: string, weight = 400, extra: { ls?: number; lh?: number; align?: "left" | "center" | "right"; maxWidth?: number } = {}) =>
      Text({ fontFamily: FONT.sans, size: px(size), color: color_, weight, lineHeight: extra.lh ?? 1, letterSpacing: extra.ls ? px(extra.ls) : undefined, align: extra.align, maxWidth: extra.maxWidth ? px(extra.maxWidth) : undefined }, text);

    // ── the opening, as the accepted passage sets it ──────────────────────
    const toP = fd("toPoster"), toS = fd("toSite");
    const stockU = fd("stock"), lightU = fd("lightUp"), siteU = fd("toSite");
    const placeT = steps(stockU), placeS = steps(lightU);
    const inkU = easeInOutCubic(clamp((lightU - 0.06) / 0.2, 0, 1));
    const S = {
      peg: toS > 0 ? mixAnchor(L.anchor.poster, L.anchor.site, toS) : mixAnchor(L.anchor.film, L.anchor.poster, toP),
      place: placeS > 0 ? mixPlace(places.poster, places.site, placeS) : mixPlace(places.film, places.poster, placeT),
      camera: t < plan.cues.camOut[0] ? 1 : 1 - fd("camOut"),
      rect: toS > 0 ? mixRect(L.poster, L.site.stage, toS) : mixRect(L.film, L.poster, toP),
      fill: lightU > 0 ? mixc(colour.stock, colour.stage, lightU) : mixc(colour.paper, colour.stock, stockU),
      radius: toS > 0 ? lerp(2, 14, toS) : lerp(0, 2, toP),
      shadow: fd("toPoster") * (1 - siteU),
      sheet: { paper: 1 - stockU, clock: 1 - fd("clock"), floor: 1 - fd("floor"), guides: (["guide0", "guide1", "guide2", "guide3"] as const).map(c => 1 - fd(c)) },
      pool: fd("pool") * (1 - siteU),
      dots: lightU,
      retype: fd("retype"),
      rule: fd("ruleIn"),
      footRule: fd("ruleIn") * (1 - fd("footRuleOut")),
      head: (["headA", "headB"] as const).map(c => ({ a: out(c) * (1 - fd("headOut")), rise: 1 - out(c) })),
      headOut: fd("headOut"),
      small: fd("small"), eyebrow: fd("eyebrow"), heading: fd("heading"), controls: fd("controlIn"),
    };
    const pegT = fanTime(t, (c, ease) => d.span(c, { ease }), lerp);
    const filmT = Math.min(Math.max(Math.min(t, 9), 0), 2.4);

    // ── background ────────────────────────────────────────────────────────
    let bg = mixc(colour.desk, colour.page, lightU);
    if (after("batch")) bg = mixc(colour.page, colour.desk, fd("lightDown"));
    if (after("revise")) bg = colour.desk;
    if (after("website")) bg = mixc(colour.desk, art.land.sky, fd("skyUp"));
    if (after("close")) bg = mixc(art.land.sky, colour.desk, fd("skyDown"));

    // ── the opening's frame: film gate → print → stage card → the first batch print ──
    const poster1 = mixRect(L.kit.single[0], L.kit.a[0], fd("toOverview"));
    let Rf = S.rect, fill = S.fill, radius = S.radius, frameShadow = S.shadow, frameA = 1;
    if (after("batch")) {
      const v = fd("toPrint");
      Rf = mixRect(L.site.stage, poster1, v);
      fill = mixc(colour.stage, ENTRIES[0].world.stock, fd("lightDown"));
      radius = lerp(14, 2, v);
      frameShadow = v;
      frameA = lin("printPoster") >= 1 ? 0 : 1;
    }
    if (after("revise")) frameA = 0;

    const cam = S.camera > 0 ? camera(filmT) : { dx: 0, dy: 0, rot: 0, veil: 0 };
    const C = L.cam;
    const weave = { x: (cam.dx * S.camera * C.w) / 100, y: (cam.dy * S.camera * C.h) / 100, r: cam.rot * S.camera };
    const anyFilm = Math.max(S.sheet.paper, S.sheet.clock, S.sheet.floor, ...S.sheet.guides) > 0.004;
    const local = (r: Rect): Rect => ({ x: r.x - Rf.x, y: r.y - Rf.y, w: r.w, h: r.h });
    const frameLayer = !shown(frameA) ? [] : [Frame({
      id: "gate", ...at(Rf), fill, radius: px(radius), overflow: "hidden",
      style: { boxShadow: shadowCss(frameShadow, 16, 32, -14, 0.3, 0.65) },
    },
      ...(anyFilm ? [Frame({ id: "camera", ...at(local(C)), style: { transform: `translate(${px(weave.x).toFixed(2)}px, ${px(weave.y).toFixed(2)}px) rotate(${weave.r.toFixed(3)}deg)` } },
        Frame({ id: "paper", x: 0, y: 0, width: px(C.w), height: px(C.h), style: op(S.sheet.paper) },
          Image({ src: svgUri(paperSvg(L.view)), width: px(C.w), height: px(C.h), fit: "fill" })),
        Vector({ id: "pencil", x: 0, y: 0, width: px(C.w), height: px(C.h), viewBox: viewBox(L.view), preserveAspectRatio: "xMidYMid slice", overflow: "visible" },
          ...marks(L.view, filmT, S.sheet)))] : []),
      ...(shown(S.pool) ? [Vector({ id: "lamp-pool", x: 0, y: 0, width: px(Rf.w), height: px(Rf.h), viewBox: { x: 0, y: 0, width: 100, height: 100 }, preserveAspectRatio: "none", style: op(S.pool) },
        vector.defs(
          vector.radialGradient({ id: "pool-a", gradientUnits: "userSpaceOnUse", cx: 0, cy: 0, r: 1, gradientTransform: "translate(42.5 60) scale(62 50)" },
            vector.stop({ offset: 0, stopColor: "#4a3a2d", stopOpacity: 0.85 }), vector.stop({ offset: 0.55, stopColor: "#33281f", stopOpacity: 0.45 }), vector.stop({ offset: 1, stopColor: "#1e1915", stopOpacity: 0 })),
          vector.radialGradient({ id: "pool-b", gradientUnits: "userSpaceOnUse", cx: 0, cy: 0, r: 1, gradientTransform: "translate(49 83.6) scale(40 8)" },
            vector.stop({ offset: 0, stopColor: "#5b4836", stopOpacity: 0.7 }), vector.stop({ offset: 1, stopColor: "#5b4836", stopOpacity: 0 }))),
        vector.rect({ width: 100, height: 100, fill: "pool-a" }), vector.rect({ width: 100, height: 100, fill: "pool-b" }))] : []),
      ...(shown(S.dots * (1 - fd("lightDown"))) ? [Vector({ id: "stage-dots", x: 0, y: 0, width: px(Rf.w), height: px(Rf.h), viewBox: { x: 0, y: 0, width: Rf.w, height: Rf.h }, preserveAspectRatio: "none", style: op(S.dots * (1 - fd("lightDown"))) },
        vector.defs(vector.pattern({ id: "dot-grid", patternUnits: "userSpaceOnUse", width: 16, height: 16 }, vector.circle({ cx: 8, cy: 8, r: 1.15, fill: "#d3cfe0" }))),
        vector.rect({ width: Rf.w, height: Rf.h, fill: "dot-grid" }))] : []),
    )];

    // ── the batch: two entries, each its own kit; the close brings the same prints back ──
    const kitsShown = after("batch") && !after("ability");
    const closing = after("close");
    const kitsA = kitsShown ? 1 - fd("kitAway") : closing ? fd("kitBack") : 0;
    const kitK = kitsA >= 0.996 ? 1 : 0.96 + 0.04 * kitsA;
    const printCue: Cue[][] = [["printPoster", "printSquare", "printBanner"], ["printPoster2", "printSquare2", "printBanner2"]];
    const kitLayer: MediaChild[] = [];
    if (shown(kitsA)) ENTRIES.forEach((entry, e) => FORMATS.forEach((format, f) => {
      const rects = closing ? (e === 0 ? L.kit.endA : L.kit.endB)
        : e === 0 ? L.kit.single.map((r, i) => mixRect(r, L.kit.a[i], fd("toOverview"))) : L.kit.b;
      const R = scaleAbout(rects[f], L.W / 2, L.H / 2, kitK);
      const p = lin(printCue[e][f]);
      if (p <= 0) return;
      const own = !(e === 0 && f === 0) || after("revise");
      // A print is visibly made: a scan reveals it top to bottom. Once printed it is an object with a shadow.
      kitLayer.push(Frame({ id: `out-${entry.id}-${format.id}`, ...at({ ...R, h: R.h * p }), overflow: "hidden",
        style: { ...(op(kitsA) ?? {}), boxShadow: p >= 1 ? shadowCss(1, 12, 26, -12, 0.3, 0.6) : undefined } },
        print(entry, format, px(R.w), px(R.h), own),
        ...(p < 1 ? [Frame({ id: `scan-${entry.id}-${format.id}`, x: 0, y: px(R.h * p) - px(2), width: px(R.w), height: px(2), fill: "rgba(255,250,235,0.85)", style: { boxShadow: `0 0 ${px(8)}px ${px(2)}px rgba(255,240,200,0.55)` } })] : [])));
    }));

    // ── the studio card → richer film → printed poster → website ─────────
    let cardA = after("revise") ? fd("studioIn") : 0, cardR = L.film, cardFill = studio.bg, cardRadius = 0, cardShadow = 0;
    if (after("poster")) {
      const v = fd("toPoster2");
      cardR = mixRect(L.film, L.poster, v); cardFill = mixc(studio.bg, art.sheet.paper, v); cardRadius = lerp(0, 2, v); cardShadow = v;
    }
    if (after("website")) {
      const v = fd("toSite2");
      cardR = mixRect(L.poster, L.hero, v); cardFill = mixc(art.sheet.paper, art.land.sky, v); cardRadius = lerp(2, 0, v); cardShadow = 1 - v;
    }
    const siteA = 1 - fd("siteOut");
    if (closing) cardA *= siteA;
    const cardLayer = shown(cardA) ? [Frame({ id: "card", ...at(cardR), fill: cardFill, radius: px(cardRadius), style: { ...(op(cardA) ?? {}), boxShadow: shadowCss(cardShadow, 16, 32, -14, 0.3, 0.65) } })] : [];

    // The world grows out of the slab: hills from the slab's own picture, then sky and foreground.
    const worldOn = after("ability") && !after("website");
    const worldOut = 1 - fd("worldOut");
    const origin = { x: L.anchor.studio.x + 84 * L.anchor.studio.s, y: L.anchor.studio.y - 50 * L.anchor.studio.s };
    const plane = (id: "sky" | "ground" | "fore", a: number) => shown(a)
      ? [Frame({ id: `plane-${id}`, x: 0, y: 0, width: px(L.film.w), height: px(L.film.h), style: op(a) }, Image({ src: svgUri(art.planes[id]), width: px(L.film.w), height: px(L.film.h), fit: "fill" }))] : [];
    const hillPlane = (id: "far" | "mid", c: Cue) => {
      const a = clamp(lin(c) * 3, 0, 1) * worldOut;
      if (!shown(a)) return [];
      const R = scaleAbout({ x: -L.film.w / 2, y: -L.film.h / 2, w: L.film.w * 2, h: L.film.h * 2 }, origin.x, origin.y, lerp(0.12, 1, out(c)));
      return [Frame({ id: `plane-${id}`, ...at(R), style: op(a) }, Image({ src: svgUri(art.planes[id]), width: px(R.w), height: px(R.h), fit: "fill" }))];
    };
    const worldPlanes = worldOn ? [
      ...plane("sky", fd("sky") * worldOut),
      ...hillPlane("far", "farHill"), ...hillPlane("mid", "midHill"),
      ...plane("ground", (lin("sky") > 0 ? 1 : 0) * worldOut)] : [];
    const worldLayer = worldPlanes.length ? [Frame({ id: "world", ...at(L.film), overflow: "hidden" }, ...worldPlanes)] : [];
    const foreLayer = worldOn && shown(fd("foreground") * worldOut)
      ? [Frame({ id: "world-front", ...at(L.film), overflow: "hidden" }, ...plane("fore", fd("foreground") * worldOut))] : [];

    // The richer poster, printed by the same scan; its dotted hop path sits over Peg.
    const P = L.poster, ps = P.w / 400;
    const pIn = lin("posterIn"), pOut = 1 - fd("posterOut");
    const posterInk = art.sheet.ink;
    const pText = (x: number, y: number, size: number, family: string, weight: number, fill_: string, body: string, extra: { ls?: number; anchor?: "start" | "end"; opacity?: number } = {}) =>
      vector.text({ x, y, size, family, weight, fill: fill_, letterSpacing: extra.ls ?? 0, anchor: extra.anchor ?? "start", opacity: extra.opacity }, body);
    const posterBox = (id: string, ...children: MediaChild[]) => Vector({ id, x: 0, y: 0, width: px(P.w), height: px(P.h), viewBox: { x: 0, y: 0, width: 400, height: 500 }, fit: "fill" }, ...children);
    const posterLayer = shown(pOut) && pIn > 0 ? [Frame({ id: "poster-2", ...at({ ...P, h: P.h * pIn }), overflow: "hidden", style: op(pOut) },
      Image({ src: svgUri(art.posterPaper), width: px(P.w), height: px(P.h), fit: "fill" }),
      posterBox("poster-2-type",
        pText(26, 38, 11.5, FONT.sans, 600, posterInk, copy.name, { ls: 0.2 }),
        pText(23, 132, 90, FONT.serif, 500, posterInk, copy.headline[0], { ls: -1.6 }),
        vector.text({ x: 23, y: 214, size: 90, family: FONT.serif, weight: 500, fill: posterInk, letterSpacing: -1.6 }, copy.headline[1], vector.run({ fill: art.ink.orange }, ".")),
        pText(27, 247, 14.5, FONT.sans, 400, posterInk, copy.line)),
      Frame({ id: "poster-2-land", x: 0, y: 0, width: px(P.w), height: px(P.h) }, Image({ src: svgUri(art.posterLand), width: px(P.w), height: px(P.h), fit: "fill" })),
      posterBox("poster-2-foot",
        pText(50, 488, 11, FONT.sans, 400, posterInk, "the sun’s hop", { opacity: 0.8 }),
        pText(374, 488, 11, FONT.sans, 400, posterInk, "Still · shared scene", { anchor: "end", opacity: 0.8 })),
      ...(pIn < 1 ? [Frame({ id: "poster-2-scan", x: 0, y: px(P.h * pIn) - px(2), width: px(P.w), height: px(2), fill: "rgba(255,250,235,0.85)", style: { boxShadow: `0 0 ${px(8)}px ${px(2)}px rgba(255,240,200,0.55)` } })] : []))] : [];
    const dotA = fd("dotIn") * pOut;
    const posterFront = shown(dotA) ? [Frame({ id: "poster-2-notation", ...at(P), style: op(dotA) },
      posterBox("hop-path", vector.group({ fill: art.ink.orange, opacity: 0.9 }, ...hopDots(clock).map(([x, y]) => vector.circle({ cx: Number(x.toFixed(2)), cy: Number(y.toFixed(2)), r: 1.1 })))))] : [];

    // The website's land, under its copy.
    const landA = fd("landIn") * siteA;
    const landLayer = shown(landA) ? [Frame({ id: "site-land", ...at(L.hero), overflow: "hidden", style: op(landA) },
      Image({ src: svgUri(art.stageLand), width: px(L.hero.w), height: px(L.hero.h), fit: "fill" }))] : [];

    // ── the opening's type: poster headline, then the website's copy ─────
    const typeOut = 1 - fd("siteTypeOut");
    const ruleX0 = P.x + 26 * ps, ruleW0 = 348 * ps, ruleY0 = P.y + 48 * ps;
    const ruleA = S.rule * lerp(0.35, 0.16, inkU) * typeOut;
    const typeLayer: MediaChild[] = [];
    if (shown(ruleA)) typeLayer.push(Frame({ id: "rule", x: px(lerp(ruleX0, L.site.navRule.x, S.retype)), y: px(lerp(ruleY0, L.site.navRule.y, S.retype)),
      width: px(lerp(ruleW0, L.site.navRule.w, S.retype) * S.rule), height: px(1), fill: mixc(colour.cream, colour.ink, inkU), style: op(ruleA) }));
    if (shown(S.footRule * 0.35)) typeLayer.push(Frame({ id: "foot-rule", x: px(ruleX0), y: px(P.y + 446 * ps), width: px(ruleW0 * S.rule), height: px(1), fill: colour.cream, style: op(S.footRule * 0.35) }));
    if (S.head.some(h => shown(h.a))) typeLayer.push(Vector({ id: "poster-head", ...at(P), viewBox: { x: 0, y: 0, width: 400, height: 500 }, fit: "fill", overflow: "visible" },
      vector.group({ transform: { x: -24 * S.headOut, y: -25 * S.headOut, scale: 1 - 0.1 * S.headOut } },
        vector.text({ x: 22, y: 126, size: 84, family: FONT.serif, weight: 500, fill: colour.cream, letterSpacing: -2.6, opacity: S.head[0].a, transform: { y: S.head[0].rise * 10 } }, copy.headline[0]),
        vector.text({ x: 22, y: 200, size: 84, family: FONT.serif, weight: 500, fill: colour.cream, letterSpacing: -2.6, opacity: S.head[1].a, transform: { y: S.head[1].rise * 10 } }, copy.headline[1], vector.run({ fill: colour.accent }, ".")))));
    // Name and foot line move from the print into the page: the same words, re-set.
    const retype = (id: string, text: string, slot: { x: number; y: number; size: number }, posterX: number, posterBase: number, posterSize: number, ink: string, weight: number, track: number) => {
      const k0 = (posterSize * ps) / slot.size;
      const x0 = P.x + posterX * ps, y0 = P.y + posterBase * ps - k0 * 0.875 * slot.size;
      const a = S.small * typeOut;
      if (!shown(a)) return;
      const size = slot.size * lerp(k0, 1, S.retype);
      typeLayer.push(Frame({ id, x: px(lerp(x0, slot.x, S.retype)), y: px(lerp(y0, slot.y, S.retype)), style: op(a) },
        sans(text, size, mixc(colour.cream, ink, inkU), weight, { ls: size * track })));
    };
    retype("wordmark", copy.name, L.site.wm, 26, 38, 10.5, colour.ink, 600, 0.05);
    retype("body", copy.line, L.site.body, 26, 471, 14, colour.soft, 400, 0);
    const eyebrowA = S.eyebrow * typeOut, headingA = S.heading * typeOut;
    if (shown(eyebrowA)) typeLayer.push(Frame({ id: "eyebrow", x: px(L.site.eyebrow.x), y: px(L.site.eyebrow.y + (1 - S.eyebrow) * 6), style: op(eyebrowA) },
      sans(copy.eyebrow, 12, mixc(colour.cream, colour.soft, inkU), 600, { ls: 0.48, lh: 1.45 })));
    if (shown(headingA)) typeLayer.push(Frame({ id: "heading", x: px(L.site.heading.x), y: px(L.site.heading.y + (1 - S.heading) * 8), width: px(L.site.heading.w), style: op(headingA) },
      sans(copy.heading, 30, mixc(colour.cream, colour.ink, inkU), 600, { ls: -0.75, lh: 1.08, maxWidth: 260 })));
    // The opening website's controls appear as they did, then leave unused.
    const controlsA = S.controls * (1 - fd("controlOut"));
    if (shown(controlsA)) {
      const c = L.site.controls;
      typeLayer.push(Frame({ id: "controls", x: px(c.x), y: px(c.y), width: px(c.w), height: px(c.h), style: op(controlsA) }, Stack({ width: px(c.w), height: px(c.h), direction: "row", align: "center", gap: px(10) },
        sans("Fan", 13, colour.ink, 600),
        // The slider rests at a full fan: the track filled to its thumb at the right end.
        Stack({ id: "fan-slider", width: "fill", height: px(16), direction: "row", align: "center" },
          Frame({ width: "fill", height: px(5), radius: px(3), fill: "#2e4bff" }),
          Frame({ width: px(16), height: px(16), radius: px(8), fill: "#2e4bff" })),
        Stack({ id: "do-the-trick", pad: { x: px(14), y: px(10.5) }, radius: px(17), fill: colour.ink },
          sans("Do the trick", 13, "#ffffff", 600)))));
    }

    // ── the website, published again: its copy over the land ─────────────
    const s2A = fd("siteType") * siteA;
    const g = art.land.graphite;
    const siteLayer: MediaChild[] = [];
    if (shown(s2A)) {
      // The heading follows the page width (4.2% of it), capped so a wide page keeps the accepted copy-to-scene balance.
      const mx = 0.044 * L.W, h2 = Math.min(0.042 * L.W, 34);
      const top = 44 + 0.05 * L.H;
      const colW = (L.W - 2 * mx - 20) / 3;
      const stepsTop = L.hero.y + L.hero.h;
      const button = (id: string, label: string, primary: boolean) => Stack({ id, pad: { x: px(15), y: px(10.5) }, radius: px(19),
        fill: primary ? g : undefined, style: { border: `${px(1.5)}px solid ${g}` } },
        sans(label, 14, primary ? art.ink.cream : g, 600));
      siteLayer.push(Frame({ id: "site-2", x: 0, y: 0, width: px(L.W), height: px(L.H), style: op(s2A) },
        Frame({ id: "site-2-nav", x: px(mx), y: px(13), width: px(L.W - 2 * mx), height: px(13.5 * 1.45) }, sans(copy.name, 13.5, g, 600, { lh: 1.45 })),
        Frame({ id: "site-2-nav-rule", x: px(mx), y: px(L.hero.y - 1), width: px(L.W - 2 * mx), height: px(1), fill: g, style: { opacity: 0.22 } }),
        Frame({ id: "site-2-copy", x: px(mx), y: px(top), width: px(0.38 * L.W), height: px(L.hero.y + L.hero.h - top) }, Stack({ width: px(0.38 * L.W), direction: "column" },
          Stack({ direction: "row", align: "center", gap: px(7), width: px(0.38 * L.W), height: px(12.5 * 1.45) },
            Frame({ width: px(7), height: px(7), radius: px(3.5), fill: art.ink.orange }),
            sans(copy.eyebrow, 12.5, g, 600, { ls: 0.25, lh: 1.45 })),
          Spacer({ height: px(7) }),
          // A measure of 8.6 em sets the accepted three lines: Generate / something / reusable for once.
          sans(copy.heading, h2, g, 600, { ls: -0.01 * h2, lh: 1.08, maxWidth: 8.6 * h2 }),
          Spacer({ height: px(9) }),
          sans(copy.line, 15, g, 400, { lh: 1.45 }),
          Spacer({ height: px(14) }),
          Stack({ direction: "row", gap: px(8) }, button("site-2-take", copy.reclaim, true), button("site-2-pause", copy.pause, false)))),
        Frame({ id: "site-2-steps", x: 0, y: px(stepsTop), width: px(L.W), height: px(L.H - stepsTop), fill: color.mix(art.land.sky, "#fffdf8", 0.5) },
          Frame({ x: 0, y: 0, width: px(L.W), height: px(1), fill: g, style: { opacity: 0.14 } }),
          ...copy.steps.map(([head, body], i) => Frame({ id: `site-2-step-${i + 1}`, x: px(mx + i * (colW + 10)), y: px(10), width: px(colW), height: px(L.H - stepsTop - 10) }, Stack({ width: px(colW), direction: "row", gap: px(8) },
            sans(`0${i + 1}`, 11.5, art.ink.orange, 600, { lh: 1.3 }),
            Stack({ direction: "column", width: "fill" }, sans(head, 12, g, 600, { lh: 1.3 }), sans(body, 12, g, 400, { lh: 1.3, maxWidth: colW - 30 }))))))));
    }

    // The close: the accepted headline over the returned kit.
    const ct = fd("closeType");
    const closeLayer = shown(ct) ? [Frame({ id: "close-headline", x: 0, y: px(L.closeTop + (1 - ct) * 8), width: px(L.W), style: op(ct) }, Stack({ width: px(L.W), direction: "row", justify: "center" },
      Text({ fontFamily: FONT.serif, weight: 500, size: px(44), lineHeight: 1, letterSpacing: px(-1.32), color: colour.cream }, copy.headline.join(" ")),
      Text({ fontFamily: FONT.serif, weight: 500, size: px(44), lineHeight: 1, letterSpacing: px(-1.32), color: colour.accent }, ".")))] : [];

    // ── Peg: one shared visual, mounted for whichever performance is on ──
    let cast: MediaChild[] = [];
    if (performer(t) === "fan") {
      let anchor = S.peg, place = S.place, w = weave;
      const p1 = L.anchor.inPrint(poster1);
      if (after("finish")) { anchor = L.anchor.site; w = { x: 0, y: 0, r: 0 }; }
      if (after("batch")) {
        anchor = mixAnchor(L.anchor.site, p1, fd("toPrint"));
        place = mixPlace(places.site, ENTRIES[0].world.place, steps(fd("lightDown")));
      }
      if (after("revise")) {
        anchor = mixAnchor(p1, L.anchor.studio, fd("lift"));
        anchor = { ...anchor, y: anchor.y - bell("lift") * 0.08 * L.H };
        place = mixPlace(ENTRIES[0].world.place, studio, steps(fd("lift")));
      }
      // The film camera's weave carries Peg with the sheet, about the camera's centre.
      const cx = C.x + C.w / 2, cy = C.y + C.h / 2, rad = (w.r * Math.PI) / 180;
      const dx = anchor.x - cx, dy = anchor.y - cy;
      const x = cx + dx * Math.cos(rad) - dy * Math.sin(rad) + w.x, y = cy + dx * Math.sin(rad) + dy * Math.cos(rad) + w.y;
      cast = [Scene({ id: "cast", width: ctx.width, height: ctx.height },
        Instance({ id: "peg-fan", entityId: "peg", of: peg, data: { src: svgUri(fanSvg(pegT, place, "peg")), box: PEG_BOX, scale: px(anchor.s) }, at: { x: px(x), y: px(y) }, ...(w.r ? { transform: { rotate: w.r } } : {}) }))];
    } else if (shown(siteA)) {
      let anchor = L.anchor.studio;
      if (after("poster")) anchor = mixAnchor(L.anchor.studio, L.anchor.poster2, fd("toPoster2"));
      if (after("website")) anchor = mixAnchor(L.anchor.poster2, L.anchor.site2, fd("toSite2"));
      cast = [Frame({ id: "cast-layer", x: 0, y: 0, width: ctx.width, height: ctx.height, style: op(siteA) },
        Scene({ id: "cast", width: ctx.width, height: ctx.height },
          Instance({ id: "peg-trick", entityId: "peg", of: peg, data: { src: svgUri(trickSvg(trickTime(t), sceneTime(t), clock, "peg")), box: SCENE_BOX, scale: px(anchor.s) }, at: { x: px(anchor.x), y: px(anchor.y) } })))];
    }

    // ── the film's vignette and flicker, over the gate ───────────────────
    const vignetteA = S.sheet.paper, veilA = cam.veil * S.camera;
    const fxLayer = shown(vignetteA) || shown(veilA) ? [Frame({ id: "lens", ...at(Rf), overflow: "hidden", radius: px(radius) },
      ...(shown(vignetteA) ? [Vector({ id: "vignette", x: 0, y: 0, width: px(Rf.w), height: px(Rf.h), viewBox: { x: 0, y: 0, width: 100, height: 100 }, preserveAspectRatio: "none", style: op(vignetteA) },
        vector.defs(vector.radialGradient({ id: "vignette-g", gradientUnits: "userSpaceOnUse", cx: 0, cy: 0, r: 1, gradientTransform: "translate(50 46) scale(75 70)" },
          vector.stop({ offset: 0.62, stopColor: "#322212", stopOpacity: 0 }), vector.stop({ offset: 1, stopColor: "#322212", stopOpacity: 0.2 }))),
        vector.rect({ width: 100, height: 100, fill: "vignette-g" }))] : []),
      ...(shown(veilA) ? [Frame({ id: "flicker", x: 0, y: 0, width: px(Rf.w), height: px(Rf.h), fill: "#2a1c0e", style: { opacity: Number(veilA.toFixed(3)) } })] : []))] : [];

    return Frame({ id: "launch", width: ctx.width, height: ctx.height, fill: bg, overflow: "hidden" },
      ...frameLayer, ...kitLayer, ...cardLayer, ...worldLayer, ...posterLayer, ...landLayer,
      ...typeLayer, ...cast, ...foreLayer, ...posterFront, ...siteLayer, ...closeLayer, ...fxLayer);
  },
});
