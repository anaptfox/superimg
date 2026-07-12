import { define } from "superimg";

/**
 * Pre-rendered architecture plate (static SVG).
 * SuperImg never calls mermaid.render inside render() — layout is one-shot offline.
 */
const ARCH_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="420" viewBox="0 0 900 420">
  <rect width="900" height="420" fill="transparent"/>
  <g class="node" id="flowchart-client-1">
    <rect x="40" y="160" width="140" height="72" rx="12" fill="#1e293b" stroke="#5b8cff" stroke-width="2"/>
    <text x="110" y="204" text-anchor="middle" fill="#e2e8f0" font-family="Inter,system-ui,sans-serif" font-size="18" font-weight="600">Client</text>
  </g>
  <g class="edgePath" id="edge-client-api" data-id="client-api" data-edge="true">
    <path d="M180 196 H 300" stroke="#64748b" stroke-width="2" fill="none"/>
    <polygon points="300,196 288,190 288,202" fill="#64748b"/>
  </g>
  <g class="node" id="flowchart-api-2">
    <rect x="300" y="160" width="160" height="72" rx="12" fill="#1e293b" stroke="#4fd1c5" stroke-width="2"/>
    <text x="380" y="204" text-anchor="middle" fill="#e2e8f0" font-family="Inter,system-ui,sans-serif" font-size="18" font-weight="600">API</text>
  </g>
  <g class="edgePath" id="edge-api-db" data-id="api-db" data-edge="true">
    <path d="M460 196 H 580" stroke="#64748b" stroke-width="2" fill="none"/>
    <polygon points="580,196 568,190 568,202" fill="#64748b"/>
  </g>
  <g class="node" id="flowchart-db-3">
    <rect x="580" y="160" width="160" height="72" rx="12" fill="#1e293b" stroke="#f093fb" stroke-width="2"/>
    <text x="660" y="204" text-anchor="middle" fill="#e2e8f0" font-family="Inter,system-ui,sans-serif" font-size="18" font-weight="600">DB</text>
  </g>
  <g class="edgePath" id="edge-api-worker" data-id="api-worker" data-edge="true">
    <path d="M380 232 V 320 H 520" stroke="#64748b" stroke-width="2" fill="none"/>
    <polygon points="520,320 508,314 508,326" fill="#64748b"/>
  </g>
  <g class="node" id="flowchart-worker-4">
    <rect x="520" y="290" width="160" height="72" rx="12" fill="#1e293b" stroke="#ffc857" stroke-width="2"/>
    <text x="600" y="334" text-anchor="middle" fill="#e2e8f0" font-family="Inter,system-ui,sans-serif" font-size="18" font-weight="600">Worker</text>
  </g>
</svg>`;

export default define({
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "8s",
    fonts: ["Inter:wght@400;600;700"],
  },
  render(ctx) {
    const { std, width, height } = ctx;
    // intro → then each hop holds, previous marks stay revealed (no jump-dim)
    const t = ctx.director({
      intro: "12%",
      client: "16%",
      api: "16%",
      db: "16%",
      worker: "16%",
      hold: "24%",
    });

    // Cumulative: once a phase starts, in() stays at 1 afterward → no drop-off
    const clientP = t.in("client");
    const apiP = t.in("api");
    const dbP = t.in("db");
    const workerP = t.in("worker");

    // revealed = fully completed prior steps (opacity 1)
    // active = currently ramping step
    const revealed: string[] = [];
    const activeNodes: string[] = [];
    const activeEdges: string[] = [];
    let activeProgress = 0;

    if (clientP >= 1) revealed.push("client");
    else if (clientP > 0) {
      activeNodes.push("client");
      activeProgress = clientP;
    }

    if (apiP >= 1) {
      revealed.push("api", "client-api");
    } else if (apiP > 0) {
      activeNodes.push("api");
      activeEdges.push("client-api");
      activeProgress = apiP;
    }

    if (dbP >= 1) {
      revealed.push("db", "api-db");
    } else if (dbP > 0) {
      activeNodes.push("db");
      activeEdges.push("api-db");
      activeProgress = dbP;
    }

    if (workerP >= 1 || t.in("hold") > 0) {
      revealed.push("worker", "api-worker");
      // ensure path fully lit on hold
      if (!revealed.includes("client")) revealed.push("client");
      if (!revealed.includes("api")) revealed.push("api", "client-api");
      if (!revealed.includes("db")) revealed.push("db", "api-db");
    } else if (workerP > 0) {
      activeNodes.push("worker");
      activeEdges.push("api-worker");
      activeProgress = workerP;
    }

    // Always walkthrough mode (dim baseline) so we never flash full-bright then dim
    const diagram = std.viz.mermaid(ARCH_SVG, {
      width: 1100,
      height: 480,
      // container fades in during intro, then stays fully visible
      progress: Math.max(t.in("intro"), clientP > 0 ? 1 : 0),
      dimOpacity: 0.18,
      highlight: {
        revealed,
        nodes: activeNodes,
        edges: activeEdges,
        progress: activeNodes.length || activeEdges.length ? activeProgress || 1 : 0,
      },
    });

    const stepLabel =
      workerP > 0 || t.in("hold") > 0
        ? "Worker path"
        : dbP > 0
          ? "Persist to DB"
          : apiP > 0
            ? "Hit API"
            : clientP > 0
              ? "Client request"
              : "Overview";

    return `
<div style="position:relative;width:${width}px;height:${height}px;background:#06060f;font-family:Inter,system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center">
  <div style="position:absolute;top:72px;left:80px;color:#f0f4ff">
    <div style="font-size:22px;font-weight:600;letter-spacing:6px;color:#5b8cff">ARCHITECTURE</div>
    <div style="font-size:42px;font-weight:700;margin-top:8px">Request path walkthrough</div>
    <div style="margin-top:12px;font-size:20px;color:#94a3b8">${stepLabel}</div>
  </div>
  <div style="margin-top:80px">${diagram}</div>
  <div style="position:absolute;bottom:48px;color:#6b7795;font-size:18px;opacity:${t.in("hold").toFixed(3)}">
    cumulative highlights · prior steps stay lit
  </div>
</div>`;
  },
});
