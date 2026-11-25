/** @vitest-environment happy-dom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { define, video } from "@superimg/types";
import { Frame, Text } from "@superimg/stdlib/tree";
import { createDomPlayer } from "./dom-player.js";
import { Player } from "./player.js";
import { createPartProjector } from "./program-projector.js";
import { choose, sequence, time } from "@superimg/core";
import { present } from "./program.js";

const template = define({
  config: { width: 320, height: 180, fps: 10, duration: 1 },
  render: (ctx) => Frame(
    { width: "fill", height: "fill" },
    Text({ size: 24 }, `frame:${ctx.globalFrame}`),
  ),
});

describe("createDomPlayer", () => {
  it.each(["dom", "player"] as const)("%s reports cues for the accepted clock", async (kind) => {
    const player = kind === "dom" ? createDomPlayer({ container: document.createElement("div") }) : new Player({ container: document.createElement("div") });
    const media = video({ size: { width: 320, height: 180 }, fps: 10, duration: "2s", sample: { fail: false },
      resolve: () => ({ cues: [{ id: "second", start: "10f", end: "20f" }, { id: "first", start: 0, end: "5f", still: "20f" }] }),
      render: ({ data }) => { if (data.fail) throw new Error("bad frame"); return Text("visible"); },
    });
    try {
      const loaded = await player.load(media);
      expect(loaded.status).toBe("success");
      if (loaded.status !== "success") throw new Error(loaded.message);
      expect(loaded.cues).toEqual([{ id: "first", startSeconds: 0, endSeconds: 0.5, stillSeconds: 1.9 }, { id: "second", startSeconds: 1, endSeconds: 2, stillSeconds: 1.5 }]);
      await expect(player.update({ fps: 20, data: { fail: true } })).rejects.toThrow("bad frame");
      expect(player.getCues()).toEqual(loaded.cues);
      await player.update({ fps: 20 });
      expect(player.getCues()).toEqual([{ id: "first", startSeconds: 0, endSeconds: 0.25, stillSeconds: 1 }, { id: "second", startSeconds: 0.5, endSeconds: 1, stillSeconds: 0.75 }]);
      const failed = await player.load(video({ duration: "1s", resolve: () => ({ cues: [{ id: "bad", start: 1, end: 0 }] }), render: () => Text("bad") }));
      expect(failed.status).toBe("error");
      expect(player.getCues()[0]?.endSeconds).toBe(0.25);
      const mixed = video({ duration: "2s", fps: 10, resolve: () => ({ cues: [{ id: "mixed", start: "10f", end: 1.5 }] }), render: () => Text("mixed") });
      expect((await player.load(mixed)).status).toBe("success");
      await expect(player.update({ fps: 5 })).rejects.toThrow("ends before it starts");
      expect(player.getState().fps).toBe(10);
      expect(player.getCues()[0]?.startSeconds).toBe(1);

    } finally { player.dispose(); }
  });

  it.each(["dom", "player"])("%s retains its next-load canvas after a failed size update", async (kind) => {
    const host = document.createElement("div");
    const player = kind === "dom" ? createDomPlayer({ container: host }) : new Player({ container: host });
    const media = video({ size: { width: 320, height: 180 }, duration: "1s", sample: { fail: false },
      render: (ctx) => {
        if (ctx.data.fail) throw new Error("candidate size failed");
        return Frame({ width: "fill", height: "fill" }, Text("visible"));
      },
    });
    await player.load(media);
    const accepted = player.getPresentation().accepted;
    await expect(player.update({ size: { width: 640, height: 360 }, data: { fail: true } })).rejects.toThrow("candidate size failed");
    expect(player.getPresentation().accepted).toEqual(accepted);
    expect(player.getState()).toMatchObject({ width: 320, height: 180 });
    await player.load(media);
    expect(player.getState()).toMatchObject({ width: 320, height: 180 });
    player.dispose();
  });

  it("exposes resolved cues, cueFindings, and breakdown on LoadResult and Player getters", async () => {
    const host = document.createElement("div");
    const player = new Player({ container: host });
    const media = video({
      size: { width: 320, height: 180 },
      duration: "2s",
      resolve: () => ({
        cues: [
          { id: "opener", start: 0, end: 2, still: 1 },
          { id: "line-1", start: 0.3, end: 1.5, still: 0.9 },
        ],
        cueFindings: [{ id: "line-1", code: "BUBBLE_TOO_LONG", message: "Too long." }],
        breakdown: { opener: { cast: ["mira"], props: ["lantern"] } },
      }),
      render: () => Frame({ width: "fill", height: "fill" }, Text("scene")),
    });
    const result = await player.load(media);
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.cues).toEqual([
        { id: "opener", startSeconds: 0, endSeconds: 2, stillSeconds: 1 },
        { id: "line-1", startSeconds: 0.3, endSeconds: 1.5, stillSeconds: 0.9 },
      ]);
      expect(result.cueFindings).toEqual([{ id: "line-1", code: "BUBBLE_TOO_LONG", message: "Too long." }]);
      expect(result.breakdown).toEqual({ opener: { cast: ["mira"], props: ["lantern"] } });
    }
    expect(player.getCues()).toHaveLength(2);
    expect(player.getCueFindings()).toHaveLength(1);
    expect(player.getBreakdown()).toEqual({ opener: { cast: ["mira"], props: ["lantern"] } });
    player.dispose();
  });
  it("exposes opt-in bounded numeric diagnostics with mounted generation", async () => {
    const player = createDomPlayer({ container: document.createElement("div") });
    expect(player.getPerformance()).toBeNull();
    await player.load(template);
    expect(player.getPerformance()).toBeNull();
    await player.load(template, { performance: { capacity: 2 } });
    await player.seek({ frame: 1 });
    await player.update({ data: { privateValue: "never-recorded" } });
    const snapshot = player.getPerformance()!;
    expect(snapshot.generation).toBe(2);
    expect(snapshot.records).toHaveLength(2);
    expect(snapshot.counters.accepted).toBe(3);
    expect(snapshot.byKind.update.accepted).toBe(1);
    expect(JSON.stringify(snapshot)).not.toContain("never-recorded");
    player.dispose();
    expect(player.getPerformance()).toBeNull();
  });
  it("keeps facade presentation observers across session replacement and disposal", async () => {
    const player = createDomPlayer({ container: document.createElement("div") });
    const seen: number[] = [];
    player.on("presentation", (presentation) => seen.push(presentation.generation));
    expect(player.getPresentation()).toMatchObject({ generation: 0, accepted: null, disposed: false });
    await player.load(template);
    await player.seek({ frame: 4 });
    expect(player.getPresentation()).toMatchObject({ generation: 1, requestedFrame: 4, accepted: { frame: 4, revision: 2 } });
    const stale = player.seek({ frame: 4 });
    const latest = player.seek({ frame: 4 });
    await expect(stale).rejects.toMatchObject({ code: "PLAYER_PRESENTATION_SUPERSEDED" });
    await latest;
    await player.load(template);
    expect(player.getPresentation()).toMatchObject({ generation: 2, accepted: { frame: 0, revision: 1 } });
    player.dispose();
    expect(player.getPresentation()).toMatchObject({ generation: 3, accepted: null, disposed: true });
    expect(seen).toContain(3);
  });

  it.each(["manual", "timeline"] as const)("cancels an older %s candidate while the winning route prepares and fails", async (mode) => {
    const player = createDomPlayer({ container: document.createElement("div") });
    let release!: () => void;
    const slow = define({
      config: { width: 320, height: 180, fps: 10, duration: 1 },
      resolve: () => new Promise((resolve) => { release = () => resolve({ duration: "1s" }); }),
      render: () => Text("slow branch"),
    });
    const story = sequence([{ id: "branch", content: choose({ basic: template, slow, broken: template }) }]);
    const program = present(player, story, { mode, size: { width: 320, height: 180 }, fps: 10,
      routes: { branch: "basic" },
      prepare: (media, context) => {
        if (context.routes.branch === "broken") throw new Error("source preparation failed");
        return { media };
      },
    });
    try {
      await program.ready;
      const original = player.getPresentation();
      const first = program.choose("branch", "slow");
      await vi.waitFor(() => expect(release).toBeTypeOf("function"));
      expect(await program.choose("branch", "broken")).toMatchObject({ status: "error", message: "source preparation failed" });
      release();
      expect(await first).toMatchObject({ status: "error", details: { code: "PLAYER_LOAD_SUPERSEDED" } });
      expect(player.getPresentation()).toEqual(original);
      expect(program.snapshot().routes).toEqual({ branch: "basic" });
    } finally { program.dispose(); player.dispose(); }
  });

  it("loads the exact seven-frame retained clock and seeks to its last frame", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const media = time(sequence([{ id: "clip", content: video({
      size: { width: 320, height: 180 }, fps: 25, duration: "7f",
      render: (ctx) => Frame({ width: "fill", height: "fill" }, Text(`frame${ctx.timeline.frame}`)),
    }) }]), { size: { width: 320, height: 180 }, fps: 25 });
    const player = createDomPlayer({ container: host });
    try {
      expect((await player.load(media)).status).toBe("success");
      await player.seek({ frame: 999 });
      expect(player.getState()).toMatchObject({ totalFrames: 7, currentFrame: 6 });
    } finally { player.dispose(); }
  });
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("leaves the host-owned fallback in place while mounting a session", async () => {
    const host = document.createElement("div");
    const fallback = document.createElement("div");
    fallback.dataset.hostPoster = "1";
    host.appendChild(fallback);
    document.body.appendChild(host);

    const player = createDomPlayer({ container: host });
    expect(host.querySelector("[data-superimg-dom-stage]")).toBeNull();

    const result = await player.load(template);
    expect(result.status).toBe("success");
    expect(host.querySelector("[data-host-poster]")).toBe(fallback);
    expect(host.querySelectorAll("[data-superimg-dom-stage]")).toHaveLength(1);

    await player.seek({ frame: 9 });
    expect(player.getState().currentFrame).toBe(9);
    player.dispose();
    expect(host.querySelector("[data-host-poster]")).toBe(fallback);
    expect(host.querySelector("[data-superimg-dom-stage]")).toBeNull();
  });

  it("keeps the previous surface when a candidate frame fails", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const player = createDomPlayer({ container: host });
    expect((await player.load(template)).status).toBe("success");
    const iframe = host.querySelector("iframe");

    const invalid = define({
      config: { width: 320, height: 180, fps: 10, duration: 1 },
      render: () => { throw new Error("candidate failed"); },
    });
    expect((await player.load(invalid)).status).toBe("error");
    expect(host.querySelectorAll("iframe")).toHaveLength(1);
    expect(host.querySelector("iframe")).toBe(iframe);
    expect(player.getState().isReady).toBe(true);
    player.dispose();
  });

  it("atomically swaps to an already-ready replacement surface", async () => {
    const host = document.createElement("div");
    const fallback = document.createElement("div");
    fallback.dataset.hostPoster = "1";
    host.appendChild(fallback);
    document.body.appendChild(host);
    const player = createDomPlayer({ container: host });
    expect((await player.load(template)).status).toBe("success");
    const first = host.querySelector("iframe");

    const replacement = define({
      config: { width: 640, height: 360, fps: 12, duration: 2 },
      render: (ctx) => Frame(
        { width: "fill", height: "fill" },
        Text({ size: 32 }, `replacement:${ctx.globalFrame}`),
      ),
    });
    const result = await player.load(replacement);
    const second = host.querySelector("iframe");

    expect(result).toMatchObject({ status: "success", width: 640, height: 360, fps: 12 });
    expect(second).not.toBe(first);
    expect(host.querySelectorAll("iframe")).toHaveLength(1);
    expect(host.querySelector("[data-host-poster]")).toBe(fallback);
    expect(player.getState()).toMatchObject({ isReady: true, width: 640, height: 360 });
    player.dispose();
  });

  it("lets the latest overlapping load win without dropping the committed surface", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const player = createDomPlayer({ container: host });
    expect((await player.load(template)).status).toBe("success");
    const committed = host.querySelector("iframe");
    const first = define({
      config: { width: 400, height: 200, fps: 10, duration: 1 },
      render: (ctx) => Frame({ width: "fill", height: "fill" }, Text({}, `first:${ctx.globalFrame}`)),
    });
    const last = define({
      config: { width: 500, height: 250, fps: 10, duration: 1 },
      render: (ctx) => Frame({ width: "fill", height: "fill" }, Text({}, `last:${ctx.globalFrame}`)),
    });
    const stale = player.load(first);
    const latest = player.load(last);
    const [staleResult, latestResult] = await Promise.all([stale, latest]);

    expect(staleResult).toMatchObject({ status: "error", details: { code: "PLAYER_LOAD_SUPERSEDED" } });
    expect(latestResult).toMatchObject({ status: "success", width: 500 });
    expect(host.querySelectorAll("iframe")).toHaveLength(1);
    expect(host.querySelector("iframe")).not.toBe(committed);
    expect(player.getState().width).toBe(500);
    player.dispose();
  });

  it("keeps one stable runtime store while a Program projection switches still and video parts", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const player = createDomPlayer({ container: host });
    const store = player.store;
    const still = define({
      config: { width: 320, height: 180 },
      render: () => Frame({ width: "fill", height: "fill" }, Text({}, "still")),
    });
    const invalid = define({
      config: { width: 320, height: 180, fps: 10, duration: 1 },
      render: () => { throw new Error("bad Program part"); },
    });
    const projector = createPartProjector(player, [
      { id: "still", media: still },
      { id: "motion", media: template },
      { id: "broken", media: invalid },
    ]);
    expect((await projector.ready).status).toBe("success");
    expect(projector.currentId).toBe("still");
    expect(player.store).toBe(store);
    expect(player.getState().totalFrames).toBe(1);

    expect((await projector.next()).status).toBe("success");
    expect(projector.currentId).toBe("motion");
    expect(player.store).toBe(store);
    await player.seek({ seconds: 0.5 });
    expect(player.getState().currentFrame).toBe(5);

    const visibleMotion = host.querySelector("iframe");
    expect((await projector.go("broken")).status).toBe("error");
    expect(projector.currentId).toBe("motion");
    expect(host.querySelector("iframe")).toBe(visibleMotion);

    projector.dispose();
    player.dispose();
  });

  it("uses top-level retained IDs and projects a nested sequence as one page", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const player = createDomPlayer({ container: host });
    const chapter = sequence([
      { id: "setup", content: template },
      { id: "payoff", content: template },
    ]);
    const program = sequence([
      { id: "opener", content: template },
      { id: "chapter", content: chapter },
      { id: "closing", content: template },
    ]);
    const projector = createPartProjector(player, program, { size: { width: 320, height: 180 }, fps: 10 });

    expect(projector.parts.map((part) => part.id)).toEqual(["opener", "chapter", "closing"]);
    expect((await projector.ready).status).toBe("success");
    const chapterResult = await projector.go("chapter");
    expect(chapterResult).toMatchObject({ status: "success" });
    expect(projector.currentId).toBe("chapter");
    expect(player.getState().totalFrames).toBe(20);
    expect((await projector.next()).status).toBe("success");
    expect(projector.currentId).toBe("closing");
    projector.dispose();
    player.dispose();
  });

  it("passes a named leaf occurrence's data into its Program part", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const player = createDomPlayer({ container: host });
    const leaf = define<{ label: string }>({
      config: { width: 320, height: 180, fps: 10, duration: 1 },
      sample: { label: "sample" },
      render: (ctx) => Frame(
        { width: "fill", height: "fill" },
        Text({}, ctx.data.label),
      ),
    });
    const projector = createPartProjector(player, sequence([
      { id: "named-leaf", content: leaf, data: { label: "occurrence label" } },
    ]));
    let renderedHtml = "";
    player.on("rendered", (payload) => { renderedHtml = payload.html; });

    expect((await projector.ready).status).toBe("success");
    expect(renderedHtml).toContain("occurrence label");
    expect(projector.currentId).toBe("named-leaf");

    projector.dispose();
    player.dispose();
  });

  it("resolves a CSS selector", () => {
    const host = document.createElement("div");
    host.id = "sel";
    document.body.appendChild(host);
    const player = createDomPlayer({ container: "#sel" });
    expect(player.container).toBe(host);
    player.dispose();
  });

  it("supports mute/volume controls and safely handles audio-bearing templates without AudioContext", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const player = new Player({ container: host, muted: true, volume: 0.6 });
    expect(player.isMuted).toBe(true);
    expect(player.volume).toBe(0.6);

    const withAudio = define({
      config: {
        width: 320,
        height: 180,
        fps: 10,
        duration: 1,
        audio: {
          clips: [{ id: "bed", src: "https://cdn.example/bed.mp3", role: "music", at: "0s", duration: "1s" }],
        },
      },
      render: (ctx) => Frame({ width: "fill", height: "fill" }, Text({}, `frame:${ctx.globalFrame}`)),
    });

    const loaded = await player.load(withAudio);
    expect(loaded.status).toBe("success");
    player.setMuted(false);
    expect(player.isMuted).toBe(false);
    player.setVolume(0.25);
    expect(player.volume).toBe(0.25);
    player.play();
    player.pause();
    player.dispose();
  });
});
