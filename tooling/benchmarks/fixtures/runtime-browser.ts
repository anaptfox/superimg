/** Current-source browser workloads. Timings end at accepted presentation, not GPU paint. */
import { MediaSession } from "@superimg/media";
import { IframePresenter } from "@superimg/media";
import { FrameEvaluator } from "../../../packages/superimg-media/src/frame-evaluator.js";
import { video } from "@superimg/types";
import { Frame, Text, Html, Scene, Instance, visual, h } from "@superimg/stdlib/tree";
import { createInteractiveSceneAuthoring } from "@superimg/stdlib/scene-semantic";
import { defineInteractive, lowerInteractiveDefinition } from "@superimg/interactive/define";
import { InteractiveSceneController } from "../../../packages/superimg-interactive/src/scene-controller.js";

type NumericSummary = ReturnType<typeof summarize>;
function summarize(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  return { count: samples.length, median: sorted[Math.floor(sorted.length / 2)] ?? 0,
    ...(samples.length >= 100 ? { p95: sorted[Math.ceil(sorted.length * .95) - 1] ?? 0 } : {}),
    min: sorted[0] ?? 0, max: sorted.at(-1) ?? 0, samples };
}
function measure(fn: () => unknown, batch = 1, count = 15): NumericSummary {
  const samples: number[] = [];
  for (let j = 0; j < count; j++) {
    const start = performance.now();
    for (let i = 0; i < batch; i++) fn();
    samples.push((performance.now() - start) / batch);
  }
  return summarize(samples);
}
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`Runtime benchmark correctness: ${message}`);
}
async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value));
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function semanticScaling() {
  const results = [];
  for (const shape of ["shallow", "deep"] as const) for (const count of [100, 500, 1000, 5000]) {
    const scene = createInteractiveSceneAuthoring("scaling");
    for (let i = 0; i < count; i++) scene.node(`node-${i}`, {
      kind: "item", ...(i > 0 ? { parent: `node-${shape === "deep" ? i - 1 : i % 2 ? i - 1 : 0}` } : {}),
    });
    const firstStarted = performance.now(); const snapshot = scene.snapshot(); const firstMs = performance.now() - firstStarted;
    assert(snapshot.nodes.length === count, "semantic count");
    assert(snapshot.nodes[0]?.childIds[0] === "node-1", "semantic ordered child");
    for (let i = 0; i < 5; i++) scene.snapshot();
    results.push({ shape, count, firstMs, snapshot: measure(() => scene.snapshot(), count <= 500 ? 10 : 1), resultHash: await digest(snapshot) });
  }
  return results;
}

async function historyScaling() {
  const results = [];
  for (const count of [0, 100, 1000, 10000, 50000]) {
    let input: Parameters<ReturnType<typeof lowerInteractiveDefinition>["setInteractiveScene"]>[0] = {};
    const controller = new InteractiveSceneController({
      getSnapshot: () => createInteractiveSceneAuthoring().snapshot(), setInput: (value) => { input = value; }, render: async () => {},
    });
    const started = performance.now();
    for (let i = 0; i < count; i++) await controller.set("target", { transform: { x: (i + 1) % 100 + 7 } });
    const setupMs = performance.now() - started;
    const runtime = lowerInteractiveDefinition(defineInteractive({
      size: { width: 100, height: 100 }, guide: { id: "history", steps: [{ id: "hold", label: "Hold", duration: "10s", scene: {} }] },
      render(ctx) { return ctx.scene.node("target", { initial: { transform: { x: 0 } } }).element(Frame({ width: 100, height: 100 }, Text("target"))); },
    }));
    runtime.setInteractiveScene(input);
    const evaluator = new FrameEvaluator(runtime);
    const firstStarted = performance.now(); const first = evaluator.render(0); const firstMs = performance.now() - firstStarted;
    for (let i = 0; i < 5; i++) evaluator.render(0);
    const evaluate = measure(() => evaluator.render(0), count <= 1000 ? 10 : 1);
    const snapshot = runtime.getInteractiveSnapshot();
    // A dropped update must fail; every positive history has the same final
    // non-default value. Zero commands remains the authored-value control.
    assert(snapshot.nodes[0]?.transform.x === (count === 0 ? 0 : 7), "history final value");
    results.push({ count, retainedOperations: input.operations?.length ?? 0, setupMs, firstMs, evaluate, resultHash: await digest({ html: first.html, snapshot }) });
  }
  return results;
}

const art = visual<null>({ id: "benchmark-box", render: () => ({
  parts: [{ id: "body", bounds: { x: 0, y: 0, width: 8, height: 8 }, content: h("rect", { width: 8, height: 8, fill: "#2563eb" }) }],
}) });
async function pipeline(kind: string, count = 100, diagnostics = false) {
  const host = document.getElementById("stage")!;
  const frames = (window as unknown as { __sceneFrames: string[] }).__sceneFrames;
  const raw = kind.startsWith("raw"), unchanged = kind.endsWith("unchanged"), interactive = kind.startsWith("interactive"), shared = kind === "shared";
  const render = (ctx: any) => {
    if (raw) return Html({ id: "raw", width: 680, height: 505, html: frames[unchanged ? 0 : kind === "raw-repeat" ? ctx.timeline.frame % 2 : ctx.timeline.frame % 60]! });
    if (shared) return Scene({ id: "world", width: 680, height: 505 }, ...Array.from({ length: count }, (_, i) => Instance({
      id: `item-${i}`, of: art, data: null, at: { x: i % 25 * 20 + ctx.timeline.frame % 2, y: Math.floor(i / 25) * 20 },
    })));
    return Frame({ id: "scene", width: 680, height: 505 }, ...Array.from({ length: count }, (_, i) => {
      const item = Frame({ id: `label-${i}`, x: i % 10 * 60, y: Math.floor(i / 10) * 45, width: 60, height: 45 }, Text({ color: "#223311", size: 12 }, String((unchanged ? 0 : ctx.timeline.frame) + i)));
      return interactive ? ctx.scene.node(`node-${i}`, { kind: "label" }).element(item) : item;
    }));
  };
  const runtime = interactive || shared
    ? lowerInteractiveDefinition(defineInteractive({ size: { width: 680, height: 505 }, guide: { id: "pipeline", steps: [{ id: "hold", label: "Hold", duration: "120s", scene: {} }] }, render }))
    : video({ duration: "120s", size: { width: 680, height: 505 }, render });
  const presenter = new IframePresenter({ playerMode: "render-only" });
  const session = new MediaSession(runtime, { presenter, ...(diagnostics ? { performance: { capacity: 100 } } : {}) });
  try {
    const started = performance.now(); await session.mount(host); const mountMs = performance.now() - started;
    const warmup = count > 100 ? 2 : 10, samples = count > 100 ? 8 : 60;
    const times: number[] = []; let firstRepeatMs = 0;
    for (let i = 0; i < warmup + samples; i++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const started = performance.now(); const accepted = await session.renderFrame(i); const elapsed = performance.now() - started;
      assert(accepted.frame === i && !accepted.stale, "accepted requested frame");
      if (i === 0) firstRepeatMs = elapsed;
      if (i >= warmup) times.push(elapsed);
    }
    const doc = host.querySelector("iframe")!.contentDocument!;
    const accepted = session.getPresentation().accepted!;
    const finalText = raw || shared ? null : doc.getElementById("label-0")?.textContent;
    assert(raw || shared || finalText === (unchanged ? "0" : String(warmup + samples - 1)), "visible final label");
    if (shared) assert((runtime as ReturnType<typeof lowerInteractiveDefinition>).getInteractiveSnapshot().spatial?.[0]?.instances.length === count, "shared accepted instance count");
    if (interactive) assert((runtime as ReturnType<typeof lowerInteractiveDefinition>).getInteractiveSnapshot().nodes.length === count, "interactive semantic node count");
    const performanceSnapshot = session.getPerformance();
    const warmRecords = performanceSnapshot?.records.filter((record) => record.kind === "render" && record.outcome === "accepted" && record.requestedFrame >= warmup) ?? [];
    if (diagnostics) assert(warmRecords.length === samples, "diagnostic warm sample population");
    const stageNames = new Set(warmRecords.flatMap((record) => Object.keys(record.timings)));
    const warmStages = Object.fromEntries([...stageNames].map((stage) => [stage,
      summarize(warmRecords.map((record) => record.timings[stage as keyof typeof record.timings] ?? 0)),
    ]));
    return { kind, count, diagnostics, warmup, mountMs, firstRepeatMs, pipeline: summarize(times), domNodes: doc.querySelectorAll("#root *").length,
      cache: presenter.getCacheStats(), performance: performanceSnapshot, warmStages, finalText, resultHash: await digest({ html: accepted.html, semantic: accepted.semantic }) };
  } finally { session.dispose(); assert(!host.querySelector("iframe"), "disposed iframe"); }
}

export function installRuntimeBench() {
  Object.assign(window, { __superimgRuntimeBench: { semanticScaling, historyScaling, pipeline } });
}
