import { Frame, Fill, Text, Vector, vector, type MediaElement } from "@foxworth/superimg";
import { ATLAS_MASSES, atlasFootprint, atlasFutureCoast, ATLAS_BASIN_CONTOUR, type Vec3 } from "./world";
import { atlasMinimapPoint, atlasMinimapRoute } from "./route";
import { projectAtlas, ATLAS_TONE_COUNT, type AtlasProjection } from "./projection";
import { type AtlasSnapshot } from "./model";

export interface AtlasView { readonly width: number; readonly height: number; readonly projection?: AtlasProjection }
const PAPER = "#E3DDCD", CYAN = "#8BE5E6", MUTED = "#8BABA9", BACKGROUND = "#091416";
const COPPER = Array.from({ length: 13 }, (_, i) => {
  const p = i / 12;
  const from = p < 0.42 ? [22, 47, 48] : p < 0.8 ? [112, 78, 49] : [209, 151, 88];
  const to = p < 0.42 ? [112, 78, 49] : p < 0.8 ? [209, 151, 88] : [246, 224, 186];
  const t = p < 0.42 ? p / 0.42 : p < 0.8 ? (p - 0.42) / 0.38 : (p - 0.8) / 0.2;
  return `rgb(${from.map((channel, index) => Math.round(channel + (to[index]! - channel) * t)).join(",")})`;
}).concat(["#315F62", "#64BDBF", "#B0F3F0", "#827156", "#AE9170", "#A5B7AA", "#DBD7BA", "#304F56", "#52747A"]);
const MATTE = ["#233C3C", "#644D38", "#AF8758"];

function path2(points: readonly { x: number; y: number }[], closed = false): string {
  return points.length ? `M${points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join("L")}${closed ? "Z" : ""}` : "M0,0h1v1h-1Z";
}
function worldPath(points: readonly Vec3[], projection: AtlasProjection, closed = false): string {
  if (closed) return path2(projection.projectPolygon(points), true);
  const projected = points.map(point => projection.project(point, true));
  if (projected.some(point => point === null)) return "M0,0h1v1h-1Z";
  return path2(projected as { x: number; y: number }[], closed);
}
function presentFootprints(projection: AtlasProjection): string {
  return ATLAS_MASSES.map(mass => worldPath(atlasFootprint(mass).map(point => ({ ...point, y: 0.5 })), projection)).join(" ");
}
export function renderAtlas(snapshot: AtlasSnapshot, view: AtlasView): MediaElement {
  const { width, height } = view;
  const projection = view.projection ?? projectAtlas(snapshot, width, height);
  const scale = Math.min(width / 1280, height / 720);
  const nodes: MediaElement[] = [];
  for (let depth = 0; depth < 16; depth++) {
    for (let shade = 0; shade < 3; shade++) {
      const index = depth * 3 + shade, d = projection.mattePaths[index]!;
      nodes.push(vector.path({ id: `atlas-matte-${index}`, d: d || "M0,0h1v1h-1Z", fill: MATTE[shade], opacity: d ? projection.matteOpacity : 0 }));
    }
    for (let tone = 0; tone < ATLAS_TONE_COUNT; tone++) {
      const index = depth * ATLAS_TONE_COUNT + tone, d = projection.grainPaths[index]!;
      nodes.push(vector.path({ id: `atlas-grains-${index}`, d: d || "M0,0h1v1h-1Z", fill: COPPER[tone], opacity: d ? tone >= 13 && tone <= 15 ? snapshot.pose.routeAlpha : 1 : 0 }));
    }
  }
  const mapSize = 154 * scale, mapX = width * 0.79, mapY = height * 0.12;
  const mapPosition = atlasMinimapPoint(snapshot.navigation.point, mapSize);
  const arrow = snapshot.navigation.heading * 180 / Math.PI;
  const traveledPath = atlasMinimapRoute(mapSize);
  const era = snapshot.pose.era < 0.5 ? "First Quay" : snapshot.pose.era < 1.5 ? "Port City" : "Present Terraces";
  const turn = snapshot.navigation.nextTurn;
  const travel = snapshot.pose.focus === "route";
  const title = snapshot.pose.futureLabel || (snapshot.pose.unmake > 0.001 ? "Present · returning to grains" : era);
  const coast = worldPath(atlasFutureCoast(snapshot.pose.raised, snapshot.pose.open), projection, true);
  const baseline = worldPath(atlasFutureCoast(0, 0), projection, true);
  return Frame(
    { id: "atlas-stage", width, height },
    Fill({ id: "atlas-water-stage", color: BACKGROUND }),
    Fill({ id: "atlas-water-light", gradient: { kind: "radial", at: "47% 43%", size: "72% 70%", stops: ["#1B3032 0%", "#102226 56%", "#091416 100%"] } }),
    Vector(
      { id: "atlas-world", width, height, viewBox: { x: 0, y: 0, width, height } },
      vector.path({ id: "atlas-land-plane", d: coast, fill: "#554B39", opacity: 0.62 }),
      vector.path({ id: "atlas-present-coast", d: baseline, stroke: "#B4B79D", strokeWidth: 1.1 * scale, strokeDasharray: `${3 * scale} ${3 * scale}`, fill: "none", opacity: (snapshot.pose.raised + snapshot.pose.open) * 0.65 }),
      vector.path({ id: "atlas-coast-edge", d: coast, stroke: "#A5B7AA", strokeWidth: 0.65 * scale, fill: "none", opacity: 0.64 }),
      vector.path({ id: "atlas-present-footprints", d: presentFootprints(projection), stroke: "#789796", strokeWidth: 0.7 * scale, fill: "none", opacity: (snapshot.pose.raised + snapshot.pose.open) * 0.27 }),
      vector.path({ id: "atlas-raised-memory", d: worldPath(atlasFutureCoast(1, 0), projection, true), stroke: "#8D9EA9", strokeWidth: 1.4 * scale, strokeDasharray: `${5 * scale} ${4 * scale}`, fill: "none", opacity: snapshot.pose.raisedGhost * 0.66 }),
      ...nodes,
    ),
    Frame(
      { id: "atlas-title-box", x: width * 0.065, y: height * 0.065, width: width * 0.62, height: height * 0.095 },
      Text({ id: "atlas-title", size: 21 * scale, weight: 500, color: PAPER, letterSpacing: 3.4 * scale, fontFamily: "Inter" }, "ASTER BASIN"),
    ),
    Frame(
      { id: "atlas-era-box", x: width * 0.065, y: height * 0.122, width: width * 0.63, height: height * 0.08 },
      Text({ id: "atlas-era", size: 13 * scale, weight: 400, color: snapshot.pose.futureLabel ? CYAN : MUTED, fontFamily: "Inter", letterSpacing: 0.25 * scale }, title),
    ),
    Frame(
      { id: "atlas-map-panel", x: mapX - 14 * scale, y: mapY - 14 * scale, width: mapSize + 28 * scale, height: mapSize + 65 * scale, fill: "#0C1A1D", radius: 9 * scale, style: { opacity: snapshot.pose.routeAlpha * 0.92, border: `${scale}px solid #315354` } },
      Vector({ id: "atlas-minimap", width: mapSize + 28 * scale, height: mapSize + 28 * scale, viewBox: { x: -14 * scale, y: -14 * scale, width: mapSize + 28 * scale, height: mapSize + 28 * scale } },
        vector.path({ id: "atlas-map-land", d: path2(ATLAS_BASIN_CONTOUR.map(point => atlasMinimapPoint(point, mapSize)), true), fill: "#4E4E3D", stroke: "#809188", strokeWidth: 0.6 * scale, opacity: 0.8 }),
        vector.path({ id: "atlas-map-route", d: path2(traveledPath), stroke: "#406F72", strokeWidth: 2.1 * scale, fill: "none", strokeLinejoin: "round" }),
        ...ATLAS_MASSES.filter(mass => mass.landmark).map(mass => {
          const point = atlasMinimapPoint(mass, mapSize);
          return vector.path({ id: `atlas-map-${mass.landmark}`, d: `M${point.x - 2.5 * scale},${point.y}l${2.5 * scale},${-2.5 * scale}l${2.5 * scale},${2.5 * scale}l${-2.5 * scale},${2.5 * scale}Z`, fill: PAPER, opacity: 0.8 });
        }),
        vector.group({ id: "atlas-map-heading", transform: { x: mapPosition.x, y: mapPosition.y, rotate: -arrow } },
          vector.path({ id: "atlas-map-position", d: `M0,${5 * scale}L${-4 * scale},${-5 * scale}L0,${-2 * scale}L${4 * scale},${-5 * scale}Z`, fill: CYAN }),
        ),
      ),
      Frame({ id: "atlas-map-label-box", x: 10 * scale, y: mapSize + 29 * scale, width: mapSize + 8 * scale, height: 21 * scale },
        Text({ id: "atlas-map-label", size: 9 * scale, color: MUTED, fontFamily: "Inter", letterSpacing: 0.7 * scale, align: "center" }, "CAUSEWAY → TIDAL ARCHIVE"),
      ),
    ),
    Frame(
      { id: "atlas-navigation-box", x: width * 0.065, y: height * 0.795, width: width * 0.44, height: height * 0.115, style: { opacity: travel ? snapshot.pose.routeAlpha : 0 } },
      Text({ id: "atlas-navigation", size: 28 * scale, weight: 500, color: CYAN, fontFamily: "Inter" }, turn === "arrived" ? "Tidal archive · arrived" : turn === "straight" ? "Continue to the archive" : `Turn ${turn}`),
    ),
    Frame(
      { id: "atlas-distance-box", x: width * 0.066, y: height * 0.865, width: width * 0.46, height: height * 0.05, style: { opacity: travel ? snapshot.pose.routeAlpha : 0 } },
      Text({ id: "atlas-distance", size: 12 * scale, color: MUTED, fontFamily: "Inter", letterSpacing: 0.8 * scale }, turn === "arrived" ? "The route and the landmark agree." : `${Math.round(snapshot.navigation.remaining)} m remaining`),
    ),
    Frame(
      { id: "atlas-memory-key-box", x: width * 0.065, y: height * 0.855, width: width * 0.6, height: height * 0.05, style: { opacity: snapshot.pose.raisedGhost } },
      Text({ id: "atlas-memory-key", size: 12 * scale, color: "#A6B7C0", fontFamily: "Inter" }, "Slate trace · Raised Shore perimeter"),
    ),
    Frame(
      { id: "atlas-teaching-box", x: width * 0.08, y: height * 0.945, width: width * 0.84, height: height * 0.035, style: { opacity: snapshot.caption ? 1 : 0 } },
      Text({ id: "atlas-teaching", size: 12.5 * scale, color: PAPER, fontFamily: "Inter", align: "center" }, snapshot.caption || " "),
    ),
  );
}
