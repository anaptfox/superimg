import { choose, Html, image, sequence, source, together, video } from "@foxworth/superimg";
import type { Program } from "@foxworth/superimg";
import { defineInteractive } from "@foxworth/superimg/interactive/define";
import { directVideoBytes } from "../composition/direct-video.js";

export const size = { width: 320, height: 180 } as const;
export const colors = { blue: "#1d4ed8", red: "#e11d48", green: "#047857", violet: "#7c3aed" } as const;

export function clip(label: string, color: string, frames = 7, childSize: { width: number; height: number } = size, fps = 25) {
  return video({
    size: childSize, fps, duration: `${frames}f`,
    render: (ctx) => Html({ id: "shared-node", width: "fill", height: "fill", html: `<div id="identical-node" style="width:100%;height:100%;background:${color};color:white;display:grid;place-items:center;font:700 24px system-ui">${label}:${ctx.timeline.frame}</div>` }),
  });
}

export function still(label: string, color: string, childSize: { width: number; height: number } = size) {
  return image({ size: childSize, render: () => Html({ id: "shared-node", width: "fill", height: "fill", html: `<div id="identical-node" style="width:100%;height:100%;background:${color};color:white;display:grid;place-items:center;font:700 24px system-ui">${label}</div>` }) });
}

export function fixtureProgram(caseName: string): Program {
  if (caseName === "paused-video") return sequence([{ id: "movie", content: source.video({ src: { bytes: directVideoBytes, mimeType: "video/mp4" }, size, fps: 25, duration: "7f", fit: "cover" }) }]);
  if (caseName === "single") return sequence([{ id: "one", content: clip("ONE", colors.green, 1) }]);
  if (caseName === "nested") return sequence([
    { id: "opener", content: still("OPENER", colors.blue), hold: "1s" },
    { id: "chapter", content: sequence([
      { id: "demo", content: clip("DEMO", colors.red) },
      { id: "result", content: still("RESULT", colors.green), hold: "1s" },
    ]) },
  ]);
  if (caseName === "manual" || caseName === "moving") return sequence([
    { id: "first", content: still("FIRST", colors.blue), hold: "1s" },
    { id: "second", content: caseName === "moving" ? clip("SECOND", colors.red, 20) : still("SECOND", colors.red), ...(caseName === "manual" ? { hold: "1s" } : {}) },
    { id: "third", content: still("THIRD", colors.green), hold: "1s" },
  ]);
  if (caseName === "branch") return sequence([{ id: "branch", content: choose({
    basic: clip("BASIC", colors.blue),
    advanced: together([
      { id: "label", content: clip("ADVANCED", colors.violet, 12), fit: "contain", rect: { x: 0, y: 0, width: 320, height: 180 } },
      { id: "asset", content: source.video({ src: { bytes: directVideoBytes, mimeType: "video/mp4" }, size: { width: 160, height: 90 }, fps: 25, duration: "12f" }), fit: "cover", rect: { x: 160, y: 90, width: 160, height: 90 } },
    ], { end: "hold", size }),
    broken: video({ size, fps: 25, duration: "7f", render() { throw new Error("INTENTIONAL_FAILED_ROUTE"); } }),
  }) }]);
  if (caseName === "mixed") {
    const wide = { width: 160, height: 90 };
    const square = { width: 80, height: 80 };
    const svgBytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#22c55e"/></svg>');
    return sequence([{ id: "gallery", content: together([
      { id: "wide", content: clip("WIDE", colors.blue, 7, wide), fit: "contain", rect: { x: 0, y: 0, width: 160, height: 180 } },
      { id: "nested", content: together([
        { id: "picture", content: source.svg({ src: { bytes: svgBytes, mimeType: "image/svg+xml" }, size: square }), hold: "1s", fit: "cover", rect: { x: 0, y: 0, width: 160, height: 90 } },
        { id: "movie", content: source.video({ src: { bytes: directVideoBytes, mimeType: "video/mp4" }, size: wide, fps: 10, duration: "1s", fit: "cover" }), fit: "cover", rect: { x: 0, y: 90, width: 160, height: 90 } },
      ], { end: "hold", size: { width: 160, height: 180 } }), fit: "contain", rect: { x: 160, y: 0, width: 160, height: 180 } },
    ], { end: "hold", size }) }]);
  }
  if (caseName === "scroll" || caseName === "pointer") return sequence([{ id: "driven", content: clip("DRIVEN", colors.red, 100) }]);
  if (caseName.startsWith("resource")) {
    const timeout = caseName.includes("timeout");
    const delay = timeout ? 4000 : 1000;
    const failedResource = caseName === "resource-failure" ? "image" : caseName === "resource-font-failure" ? "font" : caseName === "resource-video-failure" ? "video" : undefined;
    return sequence([{ id: "resources", content: video({
      size, fps: 25, duration: "7f",
      render: (ctx) => Html({ width: "fill", height: "fill", html: `${caseName === "resource-stylesheet" ? "" : `<style>@font-face{font-family:Fixture;src:url('/asset.ttf?delay=${delay}&fail=${Number(failedResource === "font")}&frame=${ctx.timeline.frame}')}#resource-text{font:20px Fixture}</style>`}<div style="width:320px;height:180px;background:#10243c"><img id="resource-image" width="80" height="80" src="/asset.png?delay=${delay}&fail=${Number(failedResource === "image")}&frame=${ctx.timeline.frame}"><video id="resource-video" width="160" height="90" preload="auto" muted src="/asset.mp4?delay=${delay}&fail=${Number(failedResource === "video")}&frame=${ctx.timeline.frame}"></video><p id="resource-text" style="color:white">Resource acceptance</p></div>` }),
    }) }]);
  }
  if (caseName.startsWith("canvas")) return sequence([{ id: "canvas", hold: "1f", content: image({ size, render: () => Html({ width: "fill", height: "fill", html: '<canvas id="opaque-paint" width="320" height="180"></canvas><script>(()=>{const paint=document.getElementById("opaque-paint").getContext("2d");paint.fillStyle="#f59e0b";paint.fillRect(0,0,320,180)})()</script>' }) }) }]);
  return sequence([{ id: "clip", content: video({
    size, fps: 25, duration: "7f",
    render: (ctx) => Html({ id: "shared-node", width: "fill", height: "fill", html: `<div id="identical-node" style="width:320px;height:180px;background:${ctx.timeline.frame === 6 ? colors.red : colors.blue};color:white;display:grid;place-items:center;font:32px system-ui">SEVEN:${ctx.timeline.frame}</div>` }),
  }) }]);
}

export const lesson = defineInteractive<{ selected: boolean }>({
  size,
  guide: { id: "lesson", steps: [
    { id: "answer", label: "Answer", duration: "1s", scene: { state: "answer" } },
    { id: "finish", label: "Finish", duration: "1s", scene: { state: "finish" } },
  ] },
  sample: { selected: false },
  render(ctx) {
    ctx.scene.states({ answer: {}, finish: {} });
    const target = ctx.scene.node("accept", { actions: ["accept"], label: "Accept answer" });
    return Html({ width: "fill", height: "fill", html: `<div style="width:320px;height:180px;display:grid;place-items:center;background:${ctx.data.selected ? colors.green : colors.blue}"><button id="accept" ${target.attrs} style="width:140px;height:50px">${ctx.data.selected ? "SELECTED" : "Accept answer"}</button></div>` });
  },
});
