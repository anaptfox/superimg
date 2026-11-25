import { createDomPlayer } from "@foxworth/superimg/player/dom";
import minimal from "./minimal-scene.js";

// Execute the real deferred session load and first advancing frame. The vector
// case intentionally needs purification; typed SVG is not a trust bypass.
globalThis.__superimgFirstPlay = async (purified) => {
  const media = purified ? {
    ...minimal,
    render(ctx) {
      return {
        $$typeof: "@foxworth/superimg/element", type: "Vector",
        props: {
          width: ctx.width, height: ctx.height, viewBox: { x: 0, y: 0, width: 640, height: 360 },
        },
        children: [{ $$typeof: "@foxworth/superimg/element", type: "VectorPath",
          props: { d: `M0 0 L${100 + ctx.timeline.frame} 0 L100 100 Z`, fill: "#22c55e" }, children: [] }],
      };
    },
  } : minimal;
  const player = createDomPlayer({ container: document.querySelector("#stage") });
  const started = performance.now();
  const loaded = await player.load(media);
  if (loaded.status !== "success") throw new Error(JSON.stringify(loaded));
  const readyMs = performance.now() - started;
  const advancingFrame = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("First play never advanced")), 5000);
    player.on("rendered", (frame) => {
      if (frame.frame > 0) { clearTimeout(timer); resolve(frame.frame); }
    });
  });
  player.play();
  const frame = await advancingFrame;
  const result = { readyMs, firstPlayMs: performance.now() - started, frame,
    accepted: player.getPresentation().accepted,
    html: document.querySelector("iframe").contentDocument.querySelector("#root").innerHTML };
  player.dispose();
  return result;
};
