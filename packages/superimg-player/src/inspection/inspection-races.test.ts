/** @vitest-environment happy-dom */
import { expect, it, vi } from "vitest";
import { video, type CompositionSchedule } from "@superimg/types";
import { Frame, Text } from "@superimg/stdlib/tree";
import { createDomPlayer } from "../dom-player.js";
import type { LoadResult, PlayerPresentation } from "../player-types.js";

import { createPreviewInspection, type InspectionPlayer, type InspectionPresentation } from "./index.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

const seven = () => video({ size: { width: 320, height: 180 }, fps: 25, duration: "7f",
  render: (ctx) => Frame({ width: "fill", height: "fill" }, Text(`frame:${ctx.timeline.frame}`)),
});

/** A host port with independently controllable requested and accepted frames. */
function controlledPort() {
  const host = document.createElement("div");
  const iframe = document.createElement("iframe");
  document.body.append(host);
  host.append(iframe);
  iframe.contentDocument!.body.innerHTML = '<div id="scale-wrapper"><div id="root">frame:0</div></div>';
  const listeners = new Set<(value: PlayerPresentation) => void>();
  let shown: PlayerPresentation = { generation: 1, requestedFrame: 0, accepted: { frame: 0, revision: 1, html: "frame:0", compositeHtml: "frame:0" }, isReady: true, disposed: false };
  const notify = () => { for (const listener of listeners) listener(shown); };
  const accept = (frame: number) => {
    shown = { ...shown, accepted: { frame, revision: shown.accepted!.revision + 1, html: `frame:${frame}`, compositeHtml: `frame:${frame}` } };
    iframe.contentDocument!.getElementById("root")!.textContent = `frame:${frame}`;
    notify();
  };
  const player: InspectionPlayer = {
    container: host,
    getState: () => ({ width: 320, height: 180, fps: 25, totalFrames: 7, isPlaying: false, isReady: true }),
    getPresentation: () => shown,
    getDriveKind: () => null,
    suspendDrive: () => () => undefined,
    play() {}, pause() {},
    seek: async ({ frame }) => { shown = { ...shown, requestedFrame: frame }; notify(); accept(frame); },
    on: (_event, listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
  return {
    player, document: iframe.contentDocument!, accept,
    request(frame: number) { shown = { ...shown, requestedFrame: frame }; notify(); },
    requested: () => shown.requestedFrame!,
    dispose: () => host.remove(),
  };
}

it("supersedes a pending exact seek when live mode releases its clock", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const player = createDomPlayer({ container: host });
  const entered = deferred();
  const resources = deferred();
  const inspection = createPreviewInspection({ readinessTimeoutMs: 500 });
  try {
    expect((await player.load(seven())).status).toBe("success");
    inspection.attach({ surfaceId: "film", player, controls: ["set-mode", "seek-frame"], readiness: () => { entered.resolve(); return resources.promise; } });
    const generation = player.getPresentation().generation;
    await inspection.setMode({ surfaceId: "film", expectedGeneration: generation, mode: "inspection" });
    const outcome = inspection.seek({ surfaceId: "film", expectedGeneration: generation, frame: 6 }).then(
      (snapshot) => ({ snapshot }), (error: unknown) => ({ error }),
    );
    await entered.promise;
    await inspection.setMode({ surfaceId: "film", expectedGeneration: generation, mode: "live" });
    resources.resolve();
    expect(await outcome).toMatchObject({ error: { code: "PRESENTATION_SUPERSEDED" } });
  } finally { resources.resolve(); inspection.dispose(); player.dispose(); host.remove(); }
});

it("does not treat a requested guide step as an accepted duplicate selection", async () => {
  const port = controlledPort();
  const pending = deferred();
  port.player.seek = async ({ frame }) => { port.request(frame); await pending.promise; port.accept(frame); };
  const steps = [{ stepId: "A", startFrame: 0, endFrame: 3 }, { stepId: "B", startFrame: 3, endFrame: 7 }];
  const guide = {
    steps,
    get currentStep() { return steps.find((step) => port.requested() >= step.startFrame && port.requested() < step.endFrame) ?? null; },
    async goToStep(id: string) { await port.player.seek({ frame: steps.find((step) => step.stepId === id)!.startFrame }); },
  };
  const inspection = createPreviewInspection({ readinessTimeoutMs: 500 });
  const requests: Promise<unknown>[] = [];
  try {
    inspection.attach({ surfaceId: "lesson", player: port.player, interactive: { guide }, controls: ["set-mode", "select-step"] });
    await inspection.setMode({ surfaceId: "lesson", expectedGeneration: 1, mode: "inspection" });
    requests.push(inspection.selectStep({ surfaceId: "lesson", expectedGeneration: 1, stepId: "B" }).catch(() => undefined));
    expect((await inspection.inspect({ surfaceId: "lesson" })).stepId).toBe("A");
    const duplicate = inspection.selectStep({ surfaceId: "lesson", expectedGeneration: 1, stepId: "B" });
    requests.push(duplicate.catch(() => undefined));
    await Promise.resolve();
    pending.resolve();
    expect(await duplicate).toMatchObject({ stepId: "B", presented: { frame: 3 } });
  } finally { pending.resolve(); await Promise.allSettled(requests); inspection.dispose(); port.dispose(); }
});

it("does not treat a request-backed part ID as an accepted duplicate selection", async () => {
  const port = controlledPort();
  const pending = deferred();
  port.player.seek = async ({ frame }) => { port.request(frame); await pending.promise; port.accept(frame); };
  const schedule: CompositionSchedule = { totalFrames: 7, fps: 25, leaves: [
    { path: "A", startFrame: 0, endFrame: 3, totalFrames: 3, kind: "video", width: 320, height: 180 },
    { path: "B", startFrame: 3, endFrame: 7, totalFrames: 4, kind: "video", width: 320, height: 180 },
  ] };
  port.player.getCompositionSchedule = () => schedule;
  const success: LoadResult = { status: "success", cues: [], totalFrames: 7, duration: 7 / 25, width: 320, height: 180, fps: 25 };
  const currentId = () => port.requested() < 3 ? "A" : "B";
  const presentation: InspectionPresentation = {
    parts: [{ id: "A" }, { id: "B" }],
    async go(id) { await port.player.seek({ frame: id === "A" ? 0 : 3 }); return success; },
    choose: async () => success,
    snapshot: () => ({ mode: "timeline", currentId: currentId(), routes: {} }),
  };
  const inspection = createPreviewInspection({ readinessTimeoutMs: 500 });
  const requests: Promise<unknown>[] = [];
  try {
    inspection.attach({ surfaceId: "deck", player: port.player, presentation, controls: ["set-mode", "select-part"] });
    await inspection.setMode({ surfaceId: "deck", expectedGeneration: 1, mode: "inspection" });
    requests.push(inspection.selectPart({ surfaceId: "deck", expectedGeneration: 1, partId: "B" }).catch(() => undefined));
    expect((await inspection.inspect({ surfaceId: "deck" })).currentPart).toBe("A");
    const duplicate = inspection.selectPart({ surfaceId: "deck", expectedGeneration: 1, partId: "B" });
    requests.push(duplicate.catch(() => undefined));
    await Promise.resolve();
    pending.resolve();
    expect(await duplicate).toMatchObject({ currentPart: "B", presented: { frame: 3 } });
  } finally { pending.resolve(); await Promise.allSettled(requests); inspection.dispose(); port.dispose(); }
});

it("waits for every image decode when multiple images use the same source", async () => {
  const port = controlledPort();
  const first = deferred();
  const second = deferred();
  const images = [first, second].map((decode) => {
    const image = port.document.createElement("img");
    image.src = "same.png";
    Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 320 } });
    image.decode = vi.fn(() => decode.promise);
    port.document.getElementById("root")!.append(image);
    return image;
  });
  const inspection = createPreviewInspection({ readinessTimeoutMs: 500 });
  let settled = false;
  try {
    inspection.attach({ surfaceId: "images", player: port.player, controls: ["set-mode", "seek-frame"] });
    // This selection is already accepted; preserve the image elements while
    // testing the decode barrier independently of Player's DOM presenter.
    port.player.seek = async () => undefined;
    await inspection.setMode({ surfaceId: "images", expectedGeneration: 1, mode: "inspection" });
    const seek = inspection.seek({ surfaceId: "images", expectedGeneration: 1, frame: 0 });
    void seek.then(() => { settled = true; }, () => { settled = true; });
    await vi.waitFor(() => { expect(images[0]!.decode).toHaveBeenCalledOnce(); expect(images[1]!.decode).toHaveBeenCalledOnce(); });
    first.resolve();
    // Let the barrier poll after the first decode has completed.
    await new Promise((resolve) => setTimeout(resolve, 25));
    const settledAfterFirst = settled;
    second.resolve();
    expect((await seek).readiness.status).toBe("ready");
    expect(settledAfterFirst).toBe(false);
  } finally { first.resolve(); second.resolve(); inspection.dispose(); port.dispose(); }
});
