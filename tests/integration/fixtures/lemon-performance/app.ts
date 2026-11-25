import { defineInteractive, lowerInteractiveDefinition } from "@foxworth/superimg/interactive/define";
// Private presenter seam is used only for numeric cache-retention qualification.
import { IframePresenter } from "@superimg/media";
import { MediaSession, createDomPlayer } from "@foxworth/superimg/player";
import { createPreviewInspection } from "@foxworth/superimg/inspection";
import { video, Frame, Html, Text } from "@foxworth/superimg";
const frames: string[] = (window as any).__sceneFrames;
(window as any).fixtureFrames = frames;
const summary = (a: number[]) => {
  a = [...a].sort((a, b) => a - b);
  return {
    n: a.length,
    p50: a[Math.floor(a.length * 0.5)] ?? null,
    p95: a[Math.floor(a.length * 0.95)] ?? null,
    max: a.at(-1) ?? null,
  };
};
(window as any).run = async (
  kind = "raw",
  repeat = false,
  diagnostics = false
) => {
  const host = document.querySelector("#stage") as HTMLElement;
  const template = video({
    duration: "120s",
    size: { width: 680, height: 505 },
    sample: { value: 0 },
    render(ctx) {
      return kind === "typed"
        ? Frame(
            { id: "scene", width: 680, height: 505 },
            ...Array.from({ length: 100 }, (_, i) =>
              Frame(
                {
                  id: "label-" + i,
                  x: (i % 10) * 60,
                  y: Math.floor(i / 10) * 45,
                  width: 60,
                  height: 45,
                },
                Text(
                  { color: "#223311", size: 12 },
                  String(ctx.timeline.frame + i + ctx.data.value)
                )
              )
            )
          )
        : Html({
            id: "raw",
            width: 680,
            height: 505,
            html: frames[
              repeat ? ctx.timeline.frame % 2 : ctx.timeline.frame % 60
            ],
          });
    },
  });
  const runtime =
    kind === "interactive"
      ? lowerInteractiveDefinition(
          defineInteractive({
            size: { width: 680, height: 505 },
            guide: { steps: [{ id: "whole", duration: "120s" }] },
            render(ctx) {
              const b = ctx.scene.node("label", {
                kind: "label",
                actions: ["select"],
              });
              return Frame(
                { id: "scene", width: 680, height: 505 },
                Frame(
                  {
                    id: "label",
                    x: 0,
                    y: 0,
                    width: 60,
                    height: 45,
                    "data-si-node": "label",
                    "data-si-actions": "select",
                  } as any,
                  Text(
                    { color: "#223311", size: 12 },
                    String(ctx.timeline.frame)
                  )
                ),
                ...Array.from({ length: 99 }, (_, i) =>
                  Frame(
                    {
                      id: "label-" + i,
                      x: ((i + 1) % 10) * 60,
                      y: Math.floor((i + 1) / 10) * 45,
                      width: 60,
                      height: 45,
                    },
                    Text(
                      { color: "#223311", size: 12 },
                      String(ctx.timeline.frame + i)
                    )
                  )
                )
              );
            },
          })
        )
      : template;
  const session = new MediaSession(
    runtime,
    diagnostics ? { performance: { capacity: 240 } } : {}
  );
  await session.mount(host);
  const present: number[] = [],
    gaps: number[] = [];
  let last = performance.now();
  for (let i = 0; i < 60; i++) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    const start = performance.now();
    await session.renderFrame(i);
    const end = performance.now();
    present.push(end - start);
    gaps.push(end - last);
    last = end;
  }
  const out = {
    kind,
    repeat,
    diagnostics,
    domNodes: host
      .querySelector("iframe")
      ?.contentDocument?.querySelectorAll("#root *").length,
    performance: session.getPerformance?.() ?? null,
    htmlBytes: frames[0].length,
    svgNodes: host
      .querySelector("iframe")
      ?.contentDocument?.querySelectorAll("svg *").length,
    pipeline: summary(present),
    gaps: summary(gaps),
  };
  session.dispose();
  return out;
};
(window as any).runLive = async (ms = 8000, diagnostics = false) => {
  const host = document.querySelector("#stage") as HTMLElement;
  const template = video({
    duration: "120s",
    size: { width: 680, height: 505 },
    sample: { value: 0 },
    render(ctx) {
      return Html({
        id: "raw",
        width: 680,
        height: 505,
        html:
          frames[ctx.timeline.frame % 60] +
          `<span data-value="${ctx.data.value}">${ctx.data.value}</span>`,
      });
    },
  });
  const session = new MediaSession(
    template,
    diagnostics ? { performance: { capacity: 240 } } : {}
  );
  await session.mount(host);
  const gaps: number[] = [],
    updates: number[] = [],
    ages: number[] = [],
    acceptanceLatency: number[] = [];
  const sampled = new Set<number>();
  const frameGaps: number[] = [];
  let lastDistinct = performance.now();
  let distinctFrames = 0;
  let skippedFrames = 0,
    rewinds = 0,
    lastFrame = -1;
  const longtasks: number[] = [];
  const longtaskObserver = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) longtasks.push(e.duration);
  });
  longtaskObserver.observe({ type: "longtask", buffered: false });
  let accepted = 0,
    failed = 0,
    pause = 0,
    latest = 0;
  let last = performance.now();
  const sent = new Map<number, number>();
  session.on("rendered", (r) => {
    const now = performance.now();
    gaps.push(now - last);
    last = now;
    accepted++;
    if (r.frame !== lastFrame) {
      frameGaps.push(now - lastDistinct);
      lastDistinct = now;
      distinctFrames++;
    }
    if (r.frame < lastFrame) rewinds++;
    else if (lastFrame >= 0)
      skippedFrames += Math.max(0, r.frame - lastFrame - 1);
    lastFrame = r.frame;
    const v = Number(/data-value="(\d+)"/.exec(r.html)?.[1] ?? 0);
    if (sent.has(v)) {
      ages.push(now - sent.get(v)!);
      if (!sampled.has(v)) {
        sampled.add(v);
        acceptanceLatency.push(now - sent.get(v)!);
      }
    }
  });
  session.on("pause", () => pause++);
  session.play();
  const started = performance.now();
  const timer = setInterval(() => {
    const value = ++latest;
    sent.set(value, performance.now());
    const start = performance.now();
    void session.update({ data: { value } }).then(
      () => updates.push(performance.now() - start),
      () => failed++
    );
  }, 200);
  await new Promise((r) => setTimeout(r, ms));
  clearInterval(timer);
  session.pause();
  longtaskObserver.disconnect();
  const out = {
    skippedFrames,
    frameGaps: summary(frameGaps),
    distinctFrames,
    clockFrame: session.getState().currentFrame,
    acceptedFrame: session.getPresentation().accepted?.frame,
    rewinds,
    longtasks: summary(longtasks),
    firstDataAcceptanceMs: summary(acceptanceLatency),
    performance: session.getPerformance?.() ?? null,
    elapsed: performance.now() - started,
    accepted,
    latest,
    failed,
    pauseEvents: pause - 1,
    acceptedData: Number(
      /data-value="(\d+)"/.exec(
        session.getPresentation().accepted?.html ?? ""
      )?.[1] ?? 0
    ),
    gaps: summary(gaps),
    updateMs: summary(updates),
    sampleAgeMs: summary(ages),
  };
  session.dispose();
  return out;
};

let capturePlayer: ReturnType<typeof createDomPlayer> | null = null;
let captureInspection: ReturnType<typeof createPreviewInspection> | null = null;
let retained: { session: MediaSession; presenter: IframePresenter } | null =
  null;
(window as any).startMemory = async () => {
  const host = document.querySelector("#stage") as HTMLElement;
  const template = video({
    duration: "120s",
    size: { width: 680, height: 505 },
    render(ctx) {
      return Html({
        id: "raw",
        width: 680,
        height: 505,
        html: frames[ctx.timeline.frame % 60],
      });
    },
  });
  const presenter = new IframePresenter({ playerMode: "render-only" });
  const session = new MediaSession(template, {
    presenter,
    performance: { capacity: 120 },
  });
  await session.mount(host);
  session.play();
  retained = { session, presenter };
};
(window as any).memoryStats = () => ({
  probe: retained?.session.getPerformance?.(),
  cache: (retained?.presenter as any)?.getCacheStats?.(),
});
(window as any).finishMemory = () => {
  retained?.session.dispose();
  retained = null;
  captureInspection?.dispose();
  captureInspection = null;
  capturePlayer?.dispose();
  capturePlayer = null;
};
(window as any).captureFixture = async (frame = 30) => {
  (window as any).finishMemory();
  const host = document.querySelector("#stage") as HTMLElement;
  const template = video({
    duration: "120s",
    size: { width: 680, height: 505 },
    render(ctx) {
      return Html({
        id: "raw",
        width: 680,
        height: 505,
        html: frames[ctx.timeline.frame % 60],
      });
    },
  });
  capturePlayer = createDomPlayer({ container: host });
  const loaded = await capturePlayer.load(template);
  if (loaded.status !== "success") throw new Error(loaded.message);
  captureInspection = createPreviewInspection();
  captureInspection.attach({
    surfaceId: "fixture",
    player: capturePlayer,
    controls: ["set-mode", "seek-frame"],
  });
  const before = await captureInspection.inspect({ surfaceId: "fixture" });
  const owned = await captureInspection.setMode({
    surfaceId: "fixture",
    expectedGeneration: before.generation,
    mode: "inspection",
  });
  const shown = await captureInspection.seek({
    surfaceId: "fixture",
    expectedGeneration: owned.generation,
    frame,
  });
  return {
    generation: shown.generation,
    revision: shown.presented?.revision,
    frame: shown.presented?.frame,
    owner: shown.clock.owner,
    readiness: shown.readiness.status,
    svgNodes: host
      .querySelector("iframe")
      ?.contentDocument?.querySelectorAll("svg *").length,
  };
};
(window as any).verifyCapture = async () => {
  const shown = await captureInspection!.inspect({ surfaceId: "fixture" });
  return {
    generation: shown.generation,
    revision: shown.presented?.revision,
    frame: shown.presented?.frame,
    owner: shown.clock.owner,
    readiness: shown.readiness.status,
  };
};
