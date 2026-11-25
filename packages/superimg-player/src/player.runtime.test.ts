/** @vitest-environment happy-dom */

import { describe, expect, it, vi } from "vitest";
import { define, type InteractiveCompositionRuntime } from "@superimg/types";
import { Frame, Text } from "@superimg/stdlib/tree";
import { sequence, time } from "@superimg/core";
import { Player, type PlayerInput } from "./player.js";

function animatedTemplate() {
  return define({
    sample: { label: "initial" },
    config: { width: 320, height: 180, fps: 10, duration: 1 },
    render: (ctx) => Frame(
      { width: "fill", height: "fill" },
      Text({ size: 24 }, `${ctx.globalFrame}:${ctx.data.label}`),
    ),
  });
}

describe("passive Player MediaSession integration", () => {
  it("observes accepted revisions and generations across failed loads, replacement, and disposal", async () => {
    const player = new Player({ container: document.createElement("div") });
    const seen: number[] = [];
    player.on("presentation", (value) => seen.push(value.generation));
    expect(player.getPresentation()).toMatchObject({ generation: 0, accepted: null, disposed: false });
    await player.load(animatedTemplate());
    expect(player.getPresentation()).toMatchObject({ generation: 1, requestedFrame: 0, accepted: { frame: 0, revision: 1 } });
    await player.seek({ frame: 4 });
    expect(player.getPresentation()).toMatchObject({ generation: 1, accepted: { frame: 4, revision: 2 } });
    const invalid = define({ render: () => { throw new Error("bad replacement"); } });
    await player.load(invalid);
    expect(player.getPresentation()).toMatchObject({ generation: 1, accepted: { frame: 4, revision: 2 } });
    await player.load(animatedTemplate());
    expect(player.getPresentation()).toMatchObject({ generation: 2, accepted: { frame: 0, revision: 1 } });
    player.dispose();
    expect(player.getPresentation()).toMatchObject({ generation: 3, accepted: null, disposed: true });
    expect(seen).toContain(3);
    player.dispose();
    expect(player.getPresentation().generation).toBe(3);
  });

  it("rejects superseded awaited seeks even when competing requests select the same frame", async () => {
    const player = new Player({ container: document.createElement("div") });
    await player.load(animatedTemplate());
    const stale = player.seek({ frame: 3 });
    const latest = player.seek({ frame: 3 });
    await expect(stale).rejects.toMatchObject({ code: "PLAYER_PRESENTATION_SUPERSEDED" });
    await latest;
    expect(player.getPresentation().accepted).toMatchObject({ frame: 3, revision: 2 });
    player.dispose();
  });

  it("keeps composed interactive snapshots associated with accepted renders after load preparation", async () => {
    let snapshot = { selected: 0 };
    const runtime: InteractiveCompositionRuntime = {
      media: define({
        config: { width: 320, height: 180, fps: 10, duration: 1 },
        render: (ctx) => {
          snapshot = { selected: ctx.timeline.frame };
          return Text(`interactive:${ctx.timeline.frame}`);
        },
      }),
      setScene: () => undefined,
      getSnapshot: () => snapshot,
      subscribe: () => () => undefined,
      attachActions: () => () => undefined,
    };
    const media = time(sequence([{ id: "quiz", content: { kind: "interactive", createCompositionRuntime: () => runtime } }]),
      { size: { width: 320, height: 180 }, fps: 10 });
    const player = new Player({ container: document.createElement("div") });
    await player.load(media);
    await player.seek({ frame: 4 });
    snapshot.selected = 8;
    expect(player.getPresentation().accepted).toMatchObject({ frame: 4, semantic: { quiz: { selected: 4 } } });
    player.dispose();
  });

  it("captures direct lowered interactive semantics without a composition dependency", async () => {
    let snapshot = { selected: 0 };
    const media = { ...animatedTemplate(), getInteractiveSnapshot: () => snapshot };
    const player = new Player({ container: document.createElement("div") });
    await player.load(media);
    snapshot = { selected: 4 };
    await player.seek({ frame: 4 });
    snapshot.selected = 8;
    expect(player.getPresentation().accepted).toMatchObject({ frame: 4, semantic: { root: { selected: 4 } } });
    player.dispose();
  });

  it("keeps nested drive suspension leases across a loaded session replacement", async () => {
    const container = document.createElement("div");
    container.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 100 }) as DOMRect;
    const player = new Player({ container, drive: "pointer" });
    const first = player.suspendDrive();
    const last = player.suspendDrive();
    try {
      await player.load(animatedTemplate());
      await player.seek({ frame: 4 });
      container.dispatchEvent(new PointerEvent("pointermove", { clientX: 100 }));
      expect(player.getPresentation().requestedFrame).toBe(4);
      await player.load(animatedTemplate());
      await player.seek({ frame: 4 });
      first();
      first();
      container.dispatchEvent(new PointerEvent("pointermove", { clientX: 100 }));
      expect(player.getPresentation().accepted?.frame).toBe(4);
      expect(player.getDriveKind()).toBe("pointer");
      last();
      container.dispatchEvent(new PointerEvent("pointermove", { clientX: 100 }));
      await vi.waitFor(() => expect(player.getPresentation().accepted?.frame).toBe(9));
    } finally { player.dispose(); }
  });

  it("loads canonical media, seeks, updates, and disposes", async () => {
    const container = document.createElement("div");
    const player = new Player({ container });

    const result = await player.load(animatedTemplate() as PlayerInput);

    expect(result.status).toBe("success");
    expect(player.getState().totalFrames).toBe(10);
    await player.seek({ frame: 999 });
    expect(player.currentFrame).toBe(9);
    await player.update({ data: { label: "updated" } });
    await player.render();
    expect(player.getState().currentFrame).toBe(9);

    player.dispose();
    expect(container.children.length).toBe(0);
  });

  it("prepares retained composition children once per load and re-times resolved durations", async () => {
    const child = define<{ label: string; frames: number }>({
      config: { width: 320, height: 180, fps: 10, duration: "1s" },
      sample: { label: "sample", frames: 10 },
      resolve: ({ data }) => ({ duration: `${data.frames}f` }),
      render: (ctx) => Frame(
        { width: "fill", height: "fill" },
        Text({}, `${ctx.data.label}:${ctx.timeline.frame}`),
      ),
    });
    const program = sequence([
      { id: "first", content: child, data: { label: "first", frames: 10 } },
      { id: "second", content: child, data: { label: "second", frames: 10 } },
    ]);
    const timed = time(program, { size: { width: 320, height: 180 }, fps: 10 });
    const player = new Player({ container: document.createElement("div") });
    let renderedHtml = "";
    player.on("rendered", (payload) => { renderedHtml = payload.html; });

    const result = await player.load(timed as PlayerInput, {
      data: {
        uses: {
          first: { label: "entry-first", frames: 2 },
          second: { label: "entry-second", frames: 3 },
        },
      },
    });

    expect(result).toMatchObject({ status: "success", totalFrames: 5, fps: 10 });
    expect(renderedHtml).toContain("entry-first");
    expect(player.getState().totalFrames).toBe(5);
    expect(player.getCompositionSchedule()?.leaves[1]).toMatchObject({ path: "second", startFrame: 2, endFrame: 5 });
    player.dispose();
  });

  it("seek progress, seconds, and frame each land on that frame", async () => {
    const player = new Player({ container: document.createElement("div") });
    await player.load(animatedTemplate() as PlayerInput);

    await player.seek({ frame: 3 });
    expect(player.currentFrame).toBe(3);

    await player.seek({ seconds: 0.4 });
    expect(player.currentFrame).toBe(4);

    await player.seek({ progress: 0.5 });
    expect(player.currentFrame).toBe(5);

    await player.seek({ progress: 1 });
    expect(player.currentFrame).toBe(9);

    player.dispose();
  });

  it("exposes a runtime store for passive controls", async () => {
    const player = new Player({ container: document.createElement("div") });
    await player.load(animatedTemplate() as PlayerInput);

    expect(player.store.getState().totalFrames).toBe(10);
    await player.store.seekFrame(5);
    expect(player.currentFrame).toBe(5);
    player.dispose();
  });

  it("accepts a custom preview canvas without destination aliases", async () => {
    const player = new Player({
      container: document.createElement("div"),
      size: { width: 777, height: 555 },
    });

    const result = await player.load(animatedTemplate() as PlayerInput);

    expect(result).toMatchObject({
      status: "success",
      width: 777,
      height: 555,
    });
    await player.update({ size: { width: 321, height: 654 } });
    expect(player.getState()).toMatchObject({ width: 321, height: 654 });
    player.dispose();
  });

  it("emits ready only after the runtime store is available", async () => {
    const player = new Player({ container: document.createElement("div") });
    const readySnapshots: boolean[] = [];
    player.on("ready", () => {
      readySnapshots.push(player.store.getState().isReady);
    });

    const result = await player.load(animatedTemplate() as PlayerInput);

    expect(result.status).toBe("success");
    expect(readySnapshots).toEqual([true]);
    player.dispose();
  });

  it("keeps the previous passive preview when a candidate render fails", async () => {
    const container = document.createElement("div");
    const player = new Player({ container });
    expect((await player.load(animatedTemplate() as PlayerInput)).status).toBe("success");
    const iframe = container.querySelector("iframe");

    const invalid = define({
      config: { width: 320, height: 180, fps: 10, duration: 1 },
      render: () => {
        throw new Error("candidate failed");
      },
    });
    const result = await player.load(invalid as PlayerInput);

    expect(result.status).toBe("error");
    expect(container.querySelectorAll("iframe")).toHaveLength(1);
    expect(container.querySelector("iframe")).toBe(iframe);
    expect(player.isReady).toBe(true);
    player.dispose();
  });

  it("commits only the newest overlapping Player.load request", async () => {
    const container = document.createElement("div");
    const player = new Player({ container });
    await player.load(animatedTemplate() as PlayerInput);
    const first = define({
      config: { width: 400, height: 200, fps: 10, duration: 1 },
      render: (ctx) => Frame({ width: "fill", height: "fill" }, Text({}, `first:${ctx.globalFrame}`)),
    });
    const latest = define({
      config: { width: 600, height: 300, fps: 12, duration: 2 },
      render: (ctx) => Frame({ width: "fill", height: "fill" }, Text({}, `latest:${ctx.globalFrame}`)),
    });
    const staleLoad = player.load(first as PlayerInput);
    const latestLoad = player.load(latest as PlayerInput);
    const [staleResult, latestResult] = await Promise.all([staleLoad, latestLoad]);

    expect(staleResult).toMatchObject({ status: "error", details: { code: "PLAYER_LOAD_SUPERSEDED" } });
    expect(latestResult).toMatchObject({ status: "success", width: 600, fps: 12 });
    expect(player.getState()).toMatchObject({ width: 600, height: 300, fps: 12, totalFrames: 24 });
    expect(container.querySelectorAll("iframe")).toHaveLength(1);
    player.dispose();
  });

  it("rejects interactive definitions at the passive boundary with the exact host fix", async () => {
    const player = new Player({ container: document.createElement("div") });
    const interactive = {
      kind: "interactive",
      guide: {
        id: "lesson",
        steps: [
          { id: "one", label: "One", duration: "1s", scene: { state: "one" } },
        ],
      },
      render: () => Frame(
        { width: "fill", height: "fill" },
        Text({ size: 24 }, "one"),
      ),
    } as unknown as PlayerInput;

    const result = await player.load(interactive);

    expect(result).toMatchObject({
      status: "error",
      message: "Interactive definitions cannot be loaded by the passive Player.",
      suggestion: expect.stringContaining("createInteractivePlayer()"),
      details: { code: "INTERACTIVE_PLAYER_REQUIRED" },
    });
    if (result.status === "error") {
      expect(result.suggestion).not.toContain("created with define");
    }
    player.dispose();
  });

});
