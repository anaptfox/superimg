import { Fill, Frame, Vector, vector, type MediaElement } from "@foxworth/superimg";
import { GRAINS_PER_REQUEST, type SandglassSnapshot, type SystemSnapshot, type RequestSnapshot, type Fidelity } from "./model";

export const SANDGLASS_COLORS = {
  ink: "#080F1D", glass: "#70849F", pearl: "#E8EDF5", purple: "#A59BE8", lime: "#D9EF70",
};
export interface SandglassView { width: number; height: number; teaching: boolean; fidelity: Fidelity; live?: boolean }
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => { const p = clamp(v); return p * p * (3 - 2 * p); };
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const circle = (x: number, y: number, r: number) => `M${x-r},${y}a${r},${r} 0 1,0 ${2*r},0a${r},${r} 0 1,0 ${-2*r},0Z`;

function text(id: string, x: number, y: number, content: string, size = 12, color = "#9AAABE", anchor: "start" | "middle" | "end" = "start", weight = 400) {
  return vector.text({ id, x, y, size, fill: color, family: "Inter", weight, anchor }, content);
}

const PACK = [[-4.8,-2.5],[-1.9,-3.3],[1.0,-3.0],[4.0,-2.2],[-5.2,.3],[-2.4,-.2],[.5,-.1],[3.4,.7],[-3.5,2.5],[-.6,2.9],[2.2,3.0],[5.0,2.6]] as const;
/** One constant irregular packing; all twelve offsets remain rigid. */
export function requestClusterPath(request: RequestSnapshot, cx: number): string {
  let d = "";
  for (let grain = 0; grain < GRAINS_PER_REQUEST; grain++) {
    const x = cx + request.x + PACK[grain]![0] * 1.4;
    const y = request.y + PACK[grain]![1] * 1.4;
    const r = (1.12 + ((request.id * 17 + grain * 23) % 13) / 65) * 1.4;
    d += `M${(x-r).toFixed(2)},${y.toFixed(2)}l${r.toFixed(2)},${(-r*.8).toFixed(2)}l${r.toFixed(2)},${(r*.8).toFixed(2)}l${(-r).toFixed(2)},${(r*.8).toFixed(2)}Z`;
  }
  return d;
}

export function waitColor(wait: number): string {
  const p = clamp(wait < 12 ? wait / 12 : (wait - 12) / 12);
  const from = wait < 12 ? [232,237,245] : [165,155,232], to = wait < 12 ? [165,155,232] : [217,239,112];
  return `rgb(${from.map((c, i) => Math.round(lerp(c, to[i]!, p))).join(",")})`;
}

function vessel(system: SystemSnapshot, cx: number, snapshot: SandglassSnapshot, statisticsOpacity = 1): MediaElement {
  const c = SANDGLASS_COLORS;
  const sid = system.id;
  const waist = system.workers * 12.5 + 17;
  const glass = `M${cx-145},210Q${cx-132},283 ${cx-waist},340L${cx-waist},442Q${cx-125},472 ${cx-145},546L${cx+145},546Q${cx+125},472 ${cx+waist},442L${cx+waist},340Q${cx+132},283 ${cx+145},210Z`;
  const nodes: MediaElement[] = [
    vector.path({ id: `${sid}-cast-shadow`, d: `M${cx-185},558Q${cx},593 ${cx+185},558Q${cx},549 ${cx-185},558Z`, fill: "#02050B", opacity: .7 }),
    vector.path({ id: `${sid}-glass-body`, d: glass, fill: "#152437", fillOpacity: .64, stroke: c.glass, strokeOpacity: .65, strokeWidth: 1.2, strokeLinejoin: "round" }),
    vector.path({ id: `${sid}-rim-top`, d: `M${cx-152},209H${cx+152}M${cx-143},217H${cx+143}`, stroke: "#A7B7CC", strokeWidth: 1, strokeOpacity: .75 }),
    vector.path({ id: `${sid}-rim-base`, d: `M${cx-150},547H${cx+150}M${cx-146},553H${cx+146}`, stroke: c.glass, strokeWidth: 1.3, strokeOpacity: .85 }),
    vector.path({ id: `${sid}-raking-highlight`, d: `M${cx-140},222Q${cx-121},284 ${cx-waist+6},339V440Q${cx-114},478 ${cx-135},537`, fill:'none', stroke: "#CBD8E7", strokeWidth: 2.2, strokeOpacity: .38 }),
    vector.path({ id: `${sid}-rim-shadow`, d: `M${cx+139},225Q${cx+121},287 ${cx+waist-5},341V440Q${cx+114},478 ${cx+133},537`, fill:'none', stroke: "#020710", strokeWidth: 5, strokeOpacity: .6 }),
    vector.path({ id: `${sid}-supply-tray`, d: `M${cx-125},156H${cx+125}M${cx-125},153v7M${cx+125},153v7`, stroke: c.glass, strokeWidth: 1, strokeOpacity: .45 }),
    text(`${sid}-supply-label`, cx, 181, "UNARRIVED SUPPLY", 9, "#72859E", "middle", 500),
  ];
  for (let worker = 0; worker < system.workers; worker++) {
    const x = cx + (worker - (system.workers - 1) / 2) * 25;
    const busy = system.requests.some(job => job.state === "processing" && job.worker === worker);
    nodes.push(vector.path({ id: `${sid}-channel-${worker}`, d: `M${x-10},349V433M${x+10},349V433`, fill:'none', stroke: busy ? c.pearl : c.glass, strokeWidth: .8, strokeOpacity: busy ? .45 : .22 }));
    nodes.push(text(`${sid}-channel-${worker}-label`, x, 456, String(worker + 1), 8, busy ? c.pearl : "#6B7E96", "middle"));
  }
  for (const request of system.requests) {
    nodes.push(vector.path({ id: request.clusterId, d: requestClusterPath(request, cx), fill: waitColor(request.visibleWait), opacity: request.state === "supply" ? .32 : .98 }));
  }
  const selected = system.requests[snapshot.selectedRequest - 1]!;
  nodes.push(vector.path({ id: `${sid}-selected-request`, d: circle(cx + selected.x, selected.y, 10), fill: "none", stroke: c.pearl, strokeWidth: .8, strokeOpacity: .85 }));
  const sumWait = system.requests.filter(job => job.state === "completed").reduce((sum, job) => sum + job.wait, 0);
  const observedMean = system.counts.completed ? sumWait / system.counts.completed : 0;
  const longestWaiting = Math.max(0,...system.requests.filter(job=>job.state==='waiting').map(job=>job.visibleWait));
  nodes.push(vector.group({ id: `${sid}-statistics`, opacity: statisticsOpacity },
    text(`${sid}-workers`, cx, 586, `${system.workers} WORKERS`, 14, c.pearl, "middle", 500),
    text(`${sid}-counts`, cx, 610, `${system.counts.waiting} waiting  ·  ${system.counts.processing} serving  ·  ${system.counts.completed} complete`, 12, "#9BADC4", "middle"),
    text(`${sid}-mean`, cx, 631, `Completed mean wait ${observedMean.toFixed(1)} s · longest waiting ${longestWaiting.toFixed(1)} s`, 9, "#7E94AE", "middle"),
  ));
  return vector.group({ id: `${sid}-vessel` }, ...nodes);
}

export function sandglassTeachingCaption(t: number): string {
  if (t < 3) return "One cluster represents one request.";
  if (t < 7) return "Each channel serves one request for two seconds.";
  if (t < 15) return "The same arrivals meet different capacities.";
  if (t < 19) return "Waiting grows when arrivals exceed service capacity.";
  if (t < 25) return "Wait color records elapsed waiting, then freezes.";
  if (t < 27) return "All arrived requests occupy one state.";
  if (t < 35) return "Arrivals stop. The remaining queue drains.";
  return "More workers shortened waiting under identical arrivals.";
}

export function renderSandglass(snapshot: SandglassSnapshot, view: SandglassView): MediaElement {
  const { width, height } = view;
  const t = snapshot.clock.filmSeconds;
  const live = view.live ?? false;
  const hasCompare = snapshot.systems.length === 2;
  const centers = hasCompare ? [390, 890] : [640];
  // Both systems remain on their original clock while the lens studies one vessel.
  const servicePush = live ? 0 : smooth((t - 2.5) / 1) * (1 - smooth((t - 6.5) / 3));
  const completedPush = live ? 0 : smooth((t - 35) / .6) * (1 - smooth((t - 36.4) / .6));
  const zoom = 1 + servicePush * 1.2 + completedPush * 1.2;
  const focusX = lerp(640, centers[0]!, servicePush + completedPush);
  const focusY = 360 + servicePush * 30 + completedPush * 139;
  const camera = `translate(640 360) scale(${zoom}) translate(${-focusX} ${-focusY})`;
  const nodes: MediaElement[] = [
    vector.path({ id: "ground-rule", d: "M100,554H1180", stroke: "#304159", strokeWidth: .6, opacity: .34 }),
    ...snapshot.systems.map((system, index) => vessel(system, centers[index]!, snapshot, 1 - servicePush - completedPush)),
  ];
  const primary = snapshot.systems[0]!;
  const selected = primary.requests[snapshot.selectedRequest - 1]!;
  const selectedNote = selected.state === "supply" ? "not arrived" : selected.state === "waiting" ? `waiting ${selected.visibleWait.toFixed(1)} s`
    : selected.state === "processing" ? `serving · waited ${selected.visibleWait.toFixed(1)} s` : `complete · waited ${selected.visibleWait.toFixed(1)} s`;
  const clockLabel = `${snapshot.clock.logicalSeconds.toFixed(2)} s`;
  const speedLabel = live ? "LIVE MODEL" : snapshot.clock.held ? "CLOCK HELD" : `${snapshot.clock.speed}× SIMULATION`;
  const c = SANDGLASS_COLORS;
  return Frame({ id: "sandglass-stage", width, height },
    Fill({ id: "sandglass-ink", color: c.ink }),
    Fill({ id: "sandglass-light", gradient: { kind: "radial", at: "50% 56%", size: "58% 68%", stops: ["#182941 0%", "#0D192B 50%", "#080F1D 100%"] } }),
    Vector({ id: "sandglass-vector", width, height, viewBox: { x: 0, y: 0, width: 1280, height: 720 } },
      text("sandglass-study-label", 72, 44, "MATERIAL STUDIES / 04", 10, "#8194AD", "start", 500),
      text("sandglass-title", 72, 78, "Sandglass Queue", 29, c.pearl, "start", 500),
      text("sandglass-description", 72, 99, "Identical arrivals. Different capacity.", 11, "#8B9EB8"),
      text("sandglass-sim-label", 1208, 45, "SIMULATED TIME", 9, "#8194AD", "end", 500),
      text("sandglass-sim-clock", 1208, 70, clockLabel, 22, c.pearl, "end", 500),
      text("sandglass-speed", 1208, 95, speedLabel, 9, c.purple, "end", 500),
      vector.group({ id: "sandglass-camera", transform: camera }, ...nodes),
      vector.text({ id: "sandglass-macro-worker-legend", x: 640, y: 129, size: 11, fill: c.pearl, family: "Inter", weight: 500, anchor: "middle", opacity: servicePush + completedPush }, `${primary.workers} workers in focus${hasCompare ? ` · ${snapshot.systems[1]!.workers} workers compared` : ''}${completedPush > 0 ? ` · ${primary.counts.completed} complete` : ''}`),
      text("sandglass-wait-region", 76, 263, "WAITING", 9, "#8B9EB8", "start", 500),
      text("sandglass-service-region", 76, 391, "SERVING", 9, c.pearl, "start", 500),
      text("sandglass-complete-region", 76, 512, "COMPLETE", 9, "#8B9EB8", "start", 500),
      vector.path({ id: "sandglass-region-rule", d: "M74,276h33M74,402h33M74,523h33", stroke: "#52677F", strokeWidth: .75, opacity: .6 }),
      text("sandglass-request-legend", 72, 668, "12 micrograins = 1 request", 10, c.pearl),
      text("sandglass-color-legend", 1208, 668, "Wait: pearl 0 s · periwinkle 12 s · chartreuse 24 s", 10, "#A5B68F", "end"),
      text("sandglass-selected-detail", 72, 690, `Request ${selected.id} · ${selectedNote}`, 10, "#839BB6"),
      text("sandglass-model-assumption", 1208, 690, `${snapshot.arrivalRate} requests/s · 2 s service · FIFO`, 10, "#839BB6", "end"),
      vector.path({ id: "sandglass-teaching-tray", d: "M328,636H952V659H328Z", fill: c.ink, opacity: view.teaching ? .96 : 0 }),
      vector.text({ id: "sandglass-teaching", x: 640, y: 653, size: 12, fill: c.pearl, family: "Inter", weight: 500, anchor: "middle", opacity: view.teaching ? 1 : 0 }, sandglassTeachingCaption(t)),
    ),
  );
}
