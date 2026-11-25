import { video, Frame, Fill, Text, Vector, vector, type MediaElement } from "@foxworth/superimg";
import { MATERIAL_FONTS } from "../_material/resources";
import { INITIAL_ATLAS, sampleAtlas, atlasOverhead, type AtlasSnapshot } from "./model";
import { projectAtlas } from "./projection";
import { ATLAS_MASSES, atlasFootprint, atlasFutureCoast, type Vec3 } from "./world";

/** An editorial projection of Aster Basin, retaining its exact world and IDs. */
export const LEDGER_TIME_MAP = Object.freeze([
  { start: 0, end: 1, from: 1, to: 1, id: "bed" },
  { start: 1, end: 4, from: 2, to: 6, id: "first-quay" },
  { start: 4, end: 6, from: 6, to: 10, id: "port" },
  { start: 6, end: 8, from: 10, to: 13, id: "present" },
  { start: 8, end: 11, from: 16, to: 25, id: "route" },
  { start: 11, end: 13.5, from: 30, to: 35, id: "raised" },
  { start: 13.5, end: 14, from: 36, to: 37, id: "return" },
  { start: 14, end: 16, from: 37 + 1 / 30, to: 41.5, id: "open" },
  { start: 16, end: 18, from: 42.6, to: 50, id: "traces" },
]);
export const LEDGER_CAPTIONS = Object.freeze([
  { start: 1.2, end: 3.8, text: "Pigment records the first quay." },
  { start: 4.1, end: 6.2, text: "Markets retain the earlier waterline." },
  { start: 6.3, end: 8.4, text: "Present terraces inherit the same island." },
  { start: 8.5, end: 10.9, text: "One route joins three landmarks." },
  { start: 11.1, end: 13.2, text: "Raised Shore imagines an expanded boundary." },
  { start: 13.3, end: 15.8, text: "Open Shore begins from the same present." },
  { start: 16, end: 18.01, text: "Landmarks outlast their buildings." },
]);
export function ledgerTime(seconds: number): number {
  const s = Math.max(0, Math.min(18, seconds));
  const span = LEDGER_TIME_MAP.find(span => s < span.end) ?? LEDGER_TIME_MAP.at(-1)!;
  return span.from + (span.to - span.from) * (s - span.start) / (span.end - span.start);
}
export function ledgerCaption(seconds: number): string {
  return LEDGER_CAPTIONS.find(caption => seconds >= caption.start && seconds < caption.end)?.text ?? "";
}
export function sampleLedger(seconds: number, teaching = false): AtlasSnapshot {
  const atlas = atlasOverhead(sampleAtlas({ ...INITIAL_ATLAS, live: false, logicalSeconds: ledgerTime(seconds) }));
  return { ...atlas, caption: teaching ? ledgerCaption(seconds) : "" };
}

const PAPER = "#F0EBDC", INK = "#283A38", MUTED = "#62706A", ROUTE = "#297A79", RUST = "#91634C";
const PALETTE = Array.from({ length: 13 }, (_, index) => {
  const p = index / 12;
  return `rgb(${Math.round(114 - p * 76)},${Math.round(114 - p * 55)},${Math.round(96 - p * 48)})`;
}).concat(["#538E89", "#297A79", "#205F62", "#BBB291", "#938B6D", "#486C65", "#748776", "#B0C3BF", "#BFCFCC"]);
const path = (points: readonly { x: number; y: number }[], closed = false) =>
  points.length ? `M${points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join("L")}${closed ? "Z" : ""}` : "M0,0h1v1h-1Z";

export function renderLedger(snapshot: AtlasSnapshot, width: number, height: number): MediaElement {
  const scale = Math.min(width / 1280, height / 720);
  const mapWidth = width * 0.665, mapHeight = height * 0.78;
  const projection = projectAtlas(snapshot, mapWidth, mapHeight);
  const projectPath = (points: readonly Vec3[]) => path(projection.projectPolygon(points), true);
  const phase = snapshot.pose.futureLabel || (snapshot.pose.unmake > 0 ? "Route and landmark traces" : snapshot.pose.era < 0.5 ? "First Quay" : snapshot.pose.era < 1.5 ? "Port City" : "Present Terraces");
  const labels = ["SOUTH CAUSEWAY", "CISTERN COURT", "TIDAL ARCHIVE"];
  const landmarkNodes = ATLAS_MASSES.filter(mass => mass.landmark).flatMap((mass, index) => {
    const point = projection.project({ x: mass.x, y: 0.5, z: mass.z }, true)!;
    const direction = index === 1 ? -1 : 1;
    const endX = point.x + direction * 69 * scale, endY = point.y + (index === 0 ? 43 : -24) * scale;
    return [
      Vector({ id: `ledger-label-rule-${index}`, width: mapWidth, height: mapHeight },
        vector.path({ id: `ledger-rule-${index}`, d: `M${point.x},${point.y}L${endX},${endY}h${direction * 28 * scale}`, stroke: MUTED, strokeWidth: 0.65 * scale, fill: "none" })),
      Frame({ id: `ledger-label-box-${index}`, x: direction < 0 ? endX - 150 * scale : endX + 5 * scale, y: endY - 14 * scale, width: 150 * scale, height: 25 * scale },
        Text({ id: `ledger-label-${index}`, size: 8.2 * scale, color: INK, letterSpacing: 0.8 * scale, align: direction < 0 ? "right" : "left", fontFamily: "Inter" }, labels[index]!)),
    ];
  });
  const grains: MediaElement[] = projection.grainPaths.map((d, index) => {
    const tone = index % 22;
    return vector.path({ id: `ledger-grains-${index}`, d: d || "M0,0h1v1h-1Z", fill: PALETTE[tone], opacity: d ? tone >= 13 && tone <= 15 ? snapshot.pose.routeAlpha : 1 : 0 });
  });
  const textBox = (id: string, x: number, y: number, w: number, h: number, text: string, size: number, color = INK, weight = 400) =>
    Frame({ id: `${id}-box`, x: x * width, y: y * height, width: w * width, height: h * height },
      Text({ id, size: size * scale, color, weight, fontFamily: "Inter", letterSpacing: size <= 12 ? 0.5 * scale : 0 }, text));
  const routePoint = projection.project({ ...snapshot.navigation.point, y: 1 }, true)!;
  return Frame({ id: "ledger-page", width, height },
    Fill({ id: "ledger-paper", color: PAPER }),
    Vector({ id: "ledger-page-rules", width, height },
      vector.path({ id: "ledger-border", d: `M${width * .035},${height * .055}H${width * .965}V${height * .93}H${width * .035}Z`, stroke: "#A8AF9E", strokeWidth: .6 * scale, fill: "none" }),
      vector.path({ id: "ledger-divider", d: `M${width * .72},${height * .13}V${height * .87}`, stroke: "#A8AF9E", strokeWidth: .7 * scale, fill: "none" }),
      vector.path({ id: "ledger-footrule", d: `M${width * .06},${height * .87}H${width * .94}`, stroke: "#A8AF9E", strokeWidth: .7 * scale, fill: "none" }),
    ),
    textBox("ledger-kicker", .06, .087, .60, .035, "ASTER BASIN  /  FICTIONAL TIDAL ATLAS", 10, MUTED),
    Frame({ id: "ledger-map-box", x: width * .045, y: height * .11, width: mapWidth, height: mapHeight },
      Vector({ id: "ledger-map", width: mapWidth, height: mapHeight },
        ...[12, 30, 48].map((offset, index) => vector.path({ id: `ledger-soundings-${index}`, d: projectPath(atlasFutureCoast(offset / 30, 0)), stroke: "#A4B8AF", strokeWidth: .6 * scale, fill: "none", opacity: .46 })),
        vector.path({ id: "ledger-island", d: projectPath(atlasFutureCoast(snapshot.pose.raised, snapshot.pose.open)), fill: "#DDD9C7", stroke: "#83998B", strokeWidth: .7 * scale }),
        vector.path({ id: "ledger-present-shore", d: projectPath(atlasFutureCoast(0, 0)), stroke: RUST, strokeWidth: .7 * scale, fill: "none", strokeDasharray: `${3 * scale} ${3 * scale}`, opacity: snapshot.pose.raised + snapshot.pose.open }),
        vector.path({ id: "ledger-raised-memory", d: projectPath(atlasFutureCoast(1, 0)), stroke: "#5A7179", strokeWidth: 1 * scale, fill: "none", strokeDasharray: `${4 * scale} ${3 * scale}`, opacity: snapshot.pose.raisedGhost }),
        ...ATLAS_MASSES.map((mass, index) => vector.path({ id: `ledger-footprint-${index}`, d: projectPath(atlasFootprint(mass).map(point => ({ ...point, y: 0.6 }))), stroke: "#929B87", strokeWidth: .5 * scale, fill: "none", opacity: .30 * snapshot.pose.assembly })),
        ...grains,
        vector.path({ id: "ledger-route-position", d: `M${routePoint.x},${routePoint.y - 5 * scale}l${4 * scale},${8 * scale}h${-8 * scale}Z`, fill: ROUTE, opacity: snapshot.pose.routeAlpha }),
      ),
      ...landmarkNodes,
    ),
    textBox("ledger-title", .755, .17, .19, .13, "TIDE\nLEDGER", 38, INK, 500),
    textBox("ledger-number", .755, .33, .19, .035, "PLATE 06  /  THE RETURNING CITY", 8.5, MUTED),
    textBox("ledger-phase", .755, .42, .185, .105, phase, 18, snapshot.pose.futureLabel ? ROUTE : INK, 500),
    textBox("ledger-fiction", .755, .555, .185, .06, "A fictional city.\nTwo imagined alternatives.", 10, MUTED),
    textBox("ledger-key-route", .755, .67, .185, .04, "Green · navigation", 9.5, MUTED),
    textBox("ledger-key-present", .755, .715, .185, .04, "Umber · present shoreline", 9.5, MUTED),
    textBox("ledger-key-memory", .755, .76, .185, .04, "Slate · Raised Shore memory", 9.5, MUTED),
    textBox("ledger-footer", .06, .895, .6, .035, "THREE ERAS   /   ONE INHERITED SHORE   /   24,000 GRAINS", 8, MUTED),
    textBox("ledger-north", .63, .145, .04, .035, "N ↑", 9, MUTED),
    Frame({ id: "ledger-teaching-box", x: width * .08, y: height * .956, width: width * .84, height: height * .033, style: { opacity: snapshot.caption ? 1 : 0 } },
      Text({ id: "ledger-teaching", size: 12 * scale, color: INK, fontFamily: "Inter", align: "center" }, snapshot.caption || " ")),
  );
}

export default video<{ teaching: boolean }>({
  size: { width: 3840, height: 2160 }, duration: "18s", fps: 30, poster: "7.8s",
  fonts: [...MATERIAL_FONTS], sample: { teaching: false }, variants: { teaching: { teaching: true } },
  audio: { id: "tide-ledger-score", src: "./assets/tide-ledger.wav", role: "ambient", duration: "18s" },
  render(ctx) { return renderLedger(sampleLedger(ctx.timeline.seconds, ctx.data.teaching), ctx.width, ctx.height); },
});
