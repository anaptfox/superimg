import { video, Frame, Fill, Stack, Text, Vector, vector } from "@foxworth/superimg";
import { renderCity, getNavigation, CITY_ROUTE } from "./city-particles";

const NIGHT = "#080e12";
const PAPER = "#eadcc2";
const CYAN = "#8ad8da";
const clamp = (p: number) => Math.max(0, Math.min(1, p));
const smooth = (p: number) => { const t = clamp(p); return t * t * (3 - 2 * t); };
const fade = (t: number, a: number, b: number) => smooth((t - a) / (b - a));
const circle = (x: number, y: number, r: number) => `M${x - r},${y}a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 ${-r * 2},0Z`;

/** A grain city, one continuous GPS camera journey, and a return to sand. */
export default video({
  size: { width: 1280, height: 720 },
  duration: "24s",
  fps: 30,
  poster: "4.4s",
  sample: { title: "City of sand", subtitle: "A route through matter and memory" },
  render(ctx) {
    const { width, height, timeline, data } = ctx;
    const t = timeline.seconds;
    const d = ctx.director({
      still: "0.5s", assemble: "3s", overview: "1.5s", descend: "2s",
      drive: "10s", rise: "2s", collapse: "3s", rest: "2s",
    });
    const scale = Math.min(width / 1280, height / 720);
    const margin = width * 0.1;
    const nav = getNavigation(t);
    const hud = fade(t, 3.6, 4.3) * (1 - fade(t, 18.5, 19.2));
    const title = fade(t, 0.3, 1.0);
    const assembly = d.in("assemble");
    const collapse = d.in("collapse");
    const phase = t < 3.5 ? "ASSEMBLING" : t < 5 ? "ROUTE ACQUIRED" : t < 7 ? "ENTERING THE CITY"
      : t < 17 ? "NAVIGATING" : t < 19 ? "DESTINATION REACHED" : t < 22 ? "DECONSTRUCTING" : "ONLY GRAINS REMAIN";
    const instruction = t < 7 ? "Follow the blue line" : nav.nextTurn === "arrived" ? "You have arrived"
      : nav.nextTurn === "left" ? "Turn left" : nav.nextTurn === "right" ? "Turn right" : "Continue ahead";
    const distanceLabel = t < 7 ? `${Math.ceil(nav.remaining / 10) * 10} m route`
      : nav.nextTurn === "arrived" ? "Route complete"
      : nav.nextTurn === "straight" ? `${Math.ceil(nav.remaining / 10) * 10} m to destination`
      : `${Math.ceil(nav.nextTurnDistance / 5) * 5} m to turn  ·  ${Math.ceil(nav.remaining / 10) * 10} m left`;
    const instructionArrow = nav.nextTurn === "left" ? "M32,20H12l9,-9M12,20l9,9M32,20V40"
      : nav.nextTurn === "right" ? "M12,20H32l-9,-9M32,20l-9,9M12,20V40"
      : "M22,40V10l-10,10M22,10l10,10";

    const mapSize = 168 * scale;
    const mapPad = 20 * scale;
    const minX = Math.min(...CITY_ROUTE.map(p => p.x)) - 65;
    const maxX = Math.max(...CITY_ROUTE.map(p => p.x)) + 65;
    const minZ = Math.min(...CITY_ROUTE.map(p => p.z)) - 65;
    const maxZ = Math.max(...CITY_ROUTE.map(p => p.z)) + 65;
    const mapScale = (mapSize - mapPad * 2) / Math.max(maxX - minX, maxZ - minZ);
    const mx = (x: number) => mapSize / 2 + (x - (minX + maxX) / 2) * mapScale;
    // Camera and map share a right-handed x/y/z world: north is negative z.
    const my = (z: number) => mapSize / 2 + (z - (minZ + maxZ) / 2) * mapScale;
    const routePath = CITY_ROUTE.map((p, i) => `${i ? "L" : "M"}${mx(p.x).toFixed(1)},${my(p.z).toFixed(1)}`).join("");
    const px = mx(nav.position.x);
    const py = my(nav.position.z);
    const hx = Math.sin(nav.heading) * 11 * scale;
    const hy = Math.cos(nav.heading) * 11 * scale;
    const routeEnd = CITY_ROUTE[CITY_ROUTE.length - 1]!;
    const grid = Array.from({ length: 5 }, (_, i) => {
      const at = mapPad + i * (mapSize - mapPad * 2) / 4;
      return `M${mapPad},${at}H${mapSize - mapPad}M${at},${mapPad}V${mapSize - mapPad}`;
    }).join("");

    return Frame(
      { id: "sand-city-stage", width, height },
      Fill({ id: "night", color: NIGHT }),
      Fill({ id: "city-light", gradient: { kind: "radial", at: "50% 40%", size: "70% 90%", stops: ["#1b2b2c 0%", "#0d191d 55%", `${NIGHT} 100%`] } }),
      Vector({ id: "grain-city", width, height, viewBox: { x: 0, y: 0, width, height } },
        ...renderCity({ seconds: t, width, height, assembly, collapse }),
      ),
      Fill({ id: "caption-shade", gradient: { kind: "linear", angle: "to bottom", stops: ["#080e12b0 0%", "transparent 22%", "transparent 65%", "#080e12d9 100%"] } }),
      Frame({ id: "title-lockup", x: margin, y: height * 0.1, width: width * 0.46, height: 88 * scale, style: { opacity: title } },
        Stack({ width: "fill", gap: 8 * scale },
          Text({ id: "study-label", size: 10 * scale, color: "#ab9c81", letterSpacing: 2.6 * scale, fontFamily: "Inter", weight: 500 }, "LIVING SAND  /  STUDY 02"),
          Text({ id: "city-title", size: 32 * scale, color: PAPER, letterSpacing: -0.8 * scale, fontFamily: "Inter", weight: 500 }, data.title),
        ),
      ),
      Frame({ id: "status-lockup", x: width * 0.63, y: height * 0.105, width: width * 0.27, height: 54 * scale, style: { opacity: title * 0.85 } },
        Stack({ width: "fill", gap: 9 * scale, align: "end" },
          Text({ id: "phase-label", size: 10 * scale, color: t < 19 ? CYAN : "#bba27a", align: "right", fontFamily: "Inter", weight: 500, letterSpacing: 1.8 * scale }, phase),
          Text({ id: "clock-label", size: 11 * scale, color: "#7e9294", align: "right", fontFamily: "Inter", weight: 400, letterSpacing: 1 * scale }, `${String(Math.floor(t)).padStart(2, "0")} / 24`),
        ),
      ),
      Frame({ id: "navigation-card", x: margin, y: height * 0.758, width: 360 * scale, height: 96 * scale, style: { opacity: hud } },
        Frame({ id: "turn-icon", width: 48 * scale, height: 48 * scale },
          Vector({ id: "turn-vector", width: 48 * scale, height: 48 * scale, viewBox: { x: 0, y: 0, width: 44, height: 48 } },
            vector.path({ id: "turn-arrow", d: instructionArrow, fill: "none", stroke: CYAN, strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" }),
          ),
        ),
        Frame({ id: "turn-copy", x: 60 * scale, y: 5 * scale, width: 290 * scale, height: 72 * scale },
          Stack({ width: "fill", gap: 8 * scale },
            Text({ id: "turn-label", size: 22 * scale, color: PAPER, fontFamily: "Inter", weight: 500 }, instruction),
            Text({ id: "remaining-label", size: 11 * scale, color: "#89a8aa", fontFamily: "Inter", weight: 400, letterSpacing: 0.8 * scale }, distanceLabel),
          ),
        ),
        Frame({ id: "route-progress-track", x: 60 * scale, y: 72 * scale, width: 224 * scale, height: 2 * scale },
          Fill({ id: "route-progress-bed", color: "#31484a" }),
          Fill({ id: "route-progress", width: Math.max(1.1, nav.progress * 224 * scale), height: 2 * scale, color: CYAN }),
        ),
      ),
      Frame({ id: "gps-map", x: width - margin - mapSize, y: height * 0.705, width: mapSize, height: mapSize, style: { opacity: hud } },
        Fill({ id: "map-ground", color: "#071418e6" }),
        Vector({ id: "map-ink", width: mapSize, height: mapSize, viewBox: { x: 0, y: 0, width: mapSize, height: mapSize } },
          vector.path({ id: "map-grid", d: grid, fill: "none", stroke: "#30464a", strokeWidth: 0.7, opacity: 0.48 }),
          vector.path({ id: "map-route", d: routePath, fill: "none", stroke: CYAN, strokeWidth: 1.8 * scale, strokeLinejoin: "round", strokeLinecap: "round", opacity: 0.68 }),
          vector.path({ id: "map-destination", d: circle(mx(routeEnd.x), my(routeEnd.z), 3.5 * scale), fill: "#071418", stroke: PAPER, strokeWidth: 1.3 * scale }),
          vector.path({ id: "map-marker-halo", d: circle(px, py, 8 * scale), fill: CYAN, opacity: 0.15 }),
          vector.path({ id: "map-marker", d: circle(px, py, 3.6 * scale), fill: CYAN }),
          vector.path({ id: "map-heading", d: `M${px},${py}l${hx.toFixed(2)},${hy.toFixed(2)}`, fill: "none", stroke: PAPER, strokeWidth: 1.2 * scale, strokeLinecap: "round" }),
        ),
        Frame({ id: "map-north", x: mapSize - 20 * scale, y: 7 * scale, width: 14 * scale, height: 16 * scale },
          Text({ id: "north-label", size: 8 * scale, color: "#6c8588", fontFamily: "Inter", weight: 500 }, "N"),
        ),
      ),
      Frame({ id: "closing-copy", x: margin, y: height * 0.8, width: width * 0.56, height: 54 * scale, style: { opacity: fade(t, 19.1, 19.8) } },
        Stack({ width: "fill", gap: 8 * scale },
          Text({ id: "closing-line", size: 22 * scale, color: PAPER, fontFamily: "Inter", weight: 400 }, "The route ends. The city returns to sand."),
          Text({ id: "closing-subtitle", size: 11 * scale, color: "#a5977c", fontFamily: "Inter", weight: 400, letterSpacing: 1 * scale }, data.subtitle),
        ),
      ),
    );
  },
});
