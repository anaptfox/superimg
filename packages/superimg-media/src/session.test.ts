/** @vitest-environment happy-dom */

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { define } from "@superimg/types";
import { Frame, Html, Text } from "@superimg/stdlib/tree";
import type { DomPresenter, DomPresentOptions } from "./dom-presenter.js";
import { createMediaSession } from "./session.js";

class TestPresenter implements DomPresenter {
  element = document.createElement("div");
  records: Array<{ html: string; width: number; height: number; sanitize: boolean }> = [];
  inlineCss: string[] = [];

  attach(container: HTMLElement): void {
    container.appendChild(this.element);
  }

  present(
    html: string,
    width: number,
    height: number,
    options: DomPresentOptions = {},
  ): void {
    this.records.push({ html, width, height, sanitize: options.escapedTree === undefined });
    this.element.innerHTML = html;
  }

  setLogicalSize(): void {}

  injectStyles(inlineCss?: string[]): void {
    this.inlineCss = inlineCss ?? [];
  }

  getElement(): HTMLElement {
    return this.element;
  }

  dispose(): void {
    this.element.remove();
  }
}

class DelayedPresenter extends TestPresenter {
  async present(
    html: string,
    width: number,
    height: number,
    options: DomPresentOptions = {},
  ): Promise<void> {
    const frame = Number(html.match(/data-frame="(\d+)"/)?.[1] ?? 0);
    await new Promise((resolve) => setTimeout(resolve, frame === 1 ? 20 : 1));
    super.present(html, width, height, options);
  }
}

class StablePresenter extends TestPresenter {
  mutations = 0;
  private lastHtml: string | null = null;

  present(
    html: string,
    width: number,
    height: number,
    options: DomPresentOptions = {},
  ): void {
    this.records.push({ html, width, height, sanitize: options.escapedTree === undefined });
    if (html === this.lastHtml) return;
    this.lastHtml = html;
    this.mutations += 1;
    this.element.innerHTML = html;
  }
}

class IndexedPresenter extends StablePresenter {
  revision = 0;
  present(html: string, width: number, height: number, options: DomPresentOptions = {}): void {
    const mutations = this.mutations;
    super.present(html, width, height, options);
    if (this.mutations !== mutations) this.revision += 1;
  }
  getDomRevision(): number { return this.revision; }
}

const template = define({
  sample: { label: "hello" },
  config: {
    width: 640,
    height: 360,
    fps: 10,
    duration: 1,
    inlineCss: ["body{font-family:system-ui}"],
  },
  render: (ctx) => {
    const clip = ctx.std.media.youtube({
      videoId: "abcdefghijk",
      at: ctx.timeline.seconds,
      width: 320,
      height: 180,
    });
    return Html({
      width: "fill",
      height: "fill",
      html: `<main data-frame="${ctx.globalFrame}"><strong>${ctx.data.label}</strong>${clip.html}</main>`,
    });
  },
});

describe("MediaSession", () => {
  it("commits data during clock ticks without a pause or rewinding the live clock", async () => {
    let now = 0;
    const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => now);
    const presenter = new TestPresenter();
    const session = await createMediaSession(template, { presenter, performance: { capacity: 12 } });
    try {
      await session.mount(document.createElement("div"));
      session.play();
      const pauses = vi.fn();
      session.on("pause", pauses);
      const seek = vi.spyOn(session.getClock(), "seekFrame");
      let release!: () => void;
      const present = presenter.present.bind(presenter);
      presenter.present = async (...args) => {
        if (args[0].includes("live data") && !release) {
          await new Promise<void>((resolve) => { release = resolve; });
        }
        present(...args);
      };
      const update = session.update({ data: { label: "live data" } });
      await vi.waitFor(() => expect(release).toBeTypeOf("function"));
      now = 300;
      session.getClock().step();
      now = 500;
      session.getClock().step();
      expect(session.getPresentation().accepted).toMatchObject({ frame: 0, inputRevision: 0 });
      release();
      await update;
      await vi.waitFor(() => expect(session.getPresentation()).toMatchObject({ isPending: false, accepted: { frame: 5, inputRevision: 1 } }));
      expect(session.getState()).toMatchObject({ currentFrame: 5, isPlaying: true });
      expect(seek).not.toHaveBeenCalled();
      expect(pauses).not.toHaveBeenCalled();
      expect(presenter.records.at(-1)?.html).toContain("live data");
      expect(session.getPerformance()?.byKind.update).toMatchObject({ requested: 1, accepted: 1, superseded: 0 });
      expect(session.getPerformance()?.records.filter((record) => record.kind === "clock" && record.outcome === "accepted").at(-1)?.inputRevision).toBe(1);
    } finally { session.dispose(); nowSpy.mockRestore(); }
  });

  it("accepts slow normal frames without rebasing the playing clock", async () => {
    let now = 0;
    const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => now);
    const presenter = new TestPresenter();
    const session = await createMediaSession(template, { presenter });
    try {
      await session.mount(document.createElement("div"));
      session.play();
      const seek = vi.spyOn(session.getClock(), "seekFrame");
      let release!: () => void;
      const present = presenter.present.bind(presenter);
      presenter.present = async (...args) => {
        if (args[0].includes('data-frame="1"')) await new Promise<void>((resolve) => { release = resolve; });
        present(...args);
      };
      const accepted: number[] = [];
      session.on("rendered", (result) => {
        accepted.push(result.frame);
        if (result.frame === 1) expect(session.getState().currentFrame).toBe(4);
      });
      now = 100; session.getClock().step();
      await vi.waitFor(() => expect(release).toBeTypeOf("function"));
      now = 400; session.getClock().step();
      release();
      await vi.waitFor(() => expect(accepted).toEqual([1, 4]));
      expect(session.getState().currentFrame).toBe(4);
      expect(seek).not.toHaveBeenCalled();
    } finally { session.dispose(); nowSpy.mockRestore(); }
  });

  it("only commits the latest overlapping data candidate and its semantic revision", async () => {
    const presenter = new TestPresenter();
    const semanticMedia = define({
      sample: { label: "initial" },
      config: { width: 320, height: 180 },
      render: (ctx) => Text(String(ctx.data.label)),
    });
    let semantic = "initial";
    const session = await createMediaSession(semanticMedia, { presenter, captureSemantic: () => ({ label: semantic }), performance: {} });
    try {
      await session.mount(document.createElement("div"));
      let release!: () => void;
      const present = presenter.present.bind(presenter);
      presenter.present = async (...args) => {
        if (args[0].includes("candidate one")) await new Promise<void>((resolve) => { release = resolve; });
        present(...args);
      };
      semantic = "one";
      const first = session.update({ data: { label: "candidate one" } });
      const firstRejected = expect(first).rejects.toMatchObject({ code: "MEDIA_SESSION_UPDATE_SUPERSEDED" });
      await vi.waitFor(() => expect(release).toBeTypeOf("function"));
      semantic = "two";
      const second = session.update({ data: { label: "candidate two" } });
      release();
      await firstRejected;
      await second;
      expect(session.getPresentation()).toMatchObject({ isPending: false, accepted: { revision: 2, inputRevision: 1, semantic: { label: "two" } } });
      expect(presenter.records.at(-1)?.html).toContain("candidate two");
      expect(session.getPerformance()?.byKind.update).toMatchObject({ requested: 2, evaluated: 2, superseded: 1, accepted: 1 });
    } finally { session.dispose(); }
  });

  it("restores the accepted DOM and resources when a candidate fails after painting", async () => {
    const presenter = new TestPresenter();
    const session = await createMediaSession(template, { presenter, performance: {} });
    try {
      await session.mount(document.createElement("div"));
      const state = session.getState();
      const accepted = session.getPresentation().accepted;
      const html = presenter.element.innerHTML;
      const styles = presenter.inlineCss;
      const present = presenter.present.bind(presenter);
      presenter.present = async (...args) => {
        present(...args);
        if (args[0].includes("failed paint")) throw new Error("candidate paint failed");
      };
      await expect(session.update({ data: { label: "failed paint" }, width: 900, fonts: { css: ".candidate{}" } })).rejects.toThrow("candidate paint failed");
      expect(session.getState()).toBe(state);
      expect(session.getPresentation().accepted).toEqual(accepted);
      expect(session.getPresentation().isPending).toBe(false);
      expect(presenter.element.innerHTML).toBe(html);
      expect(presenter.inlineCss).toEqual(styles);
      expect(session.getPerformance()?.byKind.update).toMatchObject({ failed: 1, accepted: 0 });
      await session.renderFrame(0);
      expect(presenter.records.at(-1)?.html).toContain("hello");
      expect(session.getPresentation().accepted?.inputRevision).toBe(0);
    } finally { session.dispose(); }
  });

  it("publishes dimensions, clock metadata, data, and semantics in one acceptance", async () => {
    let semantic = "initial";
    const presenter = new TestPresenter();
    const session = await createMediaSession(template, { presenter, captureSemantic: () => ({ label: semantic }) });
    try {
      await session.mount(document.createElement("div"));
      await session.seekFrame(4);
      const observations: Array<{ width: number; fps: number; inputRevision: number | undefined; html: string }> = [];
      session.subscribe(() => observations.push({ width: session.getState().width, fps: session.getState().fps,
        inputRevision: session.getPresentation().accepted?.inputRevision, html: session.getPresentation().accepted?.html ?? "" }));
      const clockObservations: Array<number | undefined> = [];
      session.getClock().subscribe(() => clockObservations.push(session.getPresentation().accepted?.inputRevision));
      semantic = "updated";
      await session.update({ width: 800, height: 600, fps: 20, duration: 2, data: { label: "atomic" } });
      expect(observations).toHaveLength(1);
      expect(observations[0]).toMatchObject({ width: 800, fps: 20, inputRevision: 1 });
      expect(observations[0]?.html).toContain("atomic");
      expect(clockObservations).toEqual([1]);
      expect(session.getState()).toMatchObject({ currentFrame: 8, totalFrames: 40, height: 600 });
      expect(session.getPresentation().accepted).toMatchObject({ frame: 8, inputRevision: 1, semantic: { label: "updated" } });
    } finally { session.dispose(); }
  });

  it("reuses empty native target indices until the presenter DOM revision changes", async () => {
    const presenter = new IndexedPresenter();
    const media = define({
      sample: { video: false },
      config: { width: 320, height: 180, fps: 10, duration: 2 },
      render: (ctx) => Html({ html: ctx.data.video
        ? '<video data-superimg-media="video" data-t="0.4"></video>' : "<div>same art</div>" }),
    });
    const queries = vi.spyOn(presenter.element, "querySelectorAll");
    const session = await createMediaSession(media, { presenter, playback: "deterministic" });
    try {
      await session.mount(document.createElement("div"));
      expect(queries).toHaveBeenCalledTimes(2);
      for (let frame = 1; frame <= 10; frame++) await session.seekFrame(frame);
      session.play(); session.pause();
      expect(queries).toHaveBeenCalledTimes(2);
      await session.update({ data: { video: true } });
      expect(queries).toHaveBeenCalledTimes(4);
      const video = presenter.element.querySelector("video")!;
      expect(video.currentTime).toBe(0.4);
      const pause = vi.spyOn(video, "pause");
      await session.seekFrame(11);
      expect(pause).toHaveBeenCalledOnce();
      expect(queries).toHaveBeenCalledTimes(4);
      await session.update({ data: { video: false } });
      pause.mockClear();
      session.play(); session.pause();
      expect(queries).toHaveBeenCalledTimes(6);
      expect(pause).not.toHaveBeenCalled();
    } finally { session.dispose(); }
  });

  it("does not commit a pending candidate after disposal", async () => {
    const presenter = new TestPresenter();
    const session = await createMediaSession(template, { presenter, performance: {} });
    await session.mount(document.createElement("div"));
    let release!: () => void;
    const present = presenter.present.bind(presenter);
    presenter.present = async (...args) => {
      await new Promise<void>((resolve) => { release = resolve; });
      present(...args);
    };
    const update = session.update({ data: { label: "unmounted" } });
    const rejected = expect(update).rejects.toThrow(/superseded/);
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    session.dispose();
    release();
    await rejected;
    expect(session.getPresentation()).toMatchObject({ disposed: true, accepted: null, isPending: false });
    expect(session.getPerformance()?.byKind.update).toMatchObject({ superseded: 1, accepted: 0 });
  });

  it("keeps committed updates successful when observers throw", async () => {
    const presenter = new TestPresenter();
    const session = await createMediaSession(template, { presenter, performance: {} });
    try {
      await session.mount(document.createElement("div"));
      const errors = vi.fn();
      session.on("error", errors);
      session.on("error", () => { throw new Error("terminal error observer"); });
      session.subscribe(() => { throw new Error("state observer"); });
      session.on("rendered", () => { throw new Error("render observer"); });
      session.getClock().subscribe(() => { throw new Error("clock observer"); });
      await expect(session.update({ data: { label: "committed" }, fps: 20 })).resolves.toBeUndefined();
      expect(session.getPresentation().accepted).toMatchObject({ inputRevision: 1, revision: 2 });
      expect(presenter.records.at(-1)?.html).toContain("committed");
      expect(errors).toHaveBeenCalledTimes(3);
      expect(session.getPerformance()?.byKind.update).toMatchObject({ accepted: 1, failed: 0 });
    } finally { session.dispose(); }
  });

  it("taking scrub ownership cancels a candidate while already paused", async () => {
    const presenter = new TestPresenter();
    const session = await createMediaSession(template, { presenter });
    try {
      await session.mount(document.createElement("div"));
      let release!: () => void;
      const present = presenter.present.bind(presenter);
      presenter.present = async (...args) => {
        if (args[0].includes("pending candidate")) await new Promise<void>((resolve) => { release = resolve; });
        present(...args);
      };
      const update = session.update({ data: { label: "pending candidate" } });
      const rejected = expect(update).rejects.toThrow(/superseded/);
      await vi.waitFor(() => expect(release).toBeTypeOf("function"));
      session.beginScrub();
      release();
      await rejected;
      await vi.waitFor(() => expect(session.getPresentation().isPending).toBe(false));
      expect(session.getState()).toMatchObject({ isPlaying: false, isScrubbing: true, currentFrame: 0 });
      expect(presenter.records.at(-1)?.html).toContain("hello");
      expect(session.getPresentation().accepted?.inputRevision).toBe(0);
      session.endScrub();
    } finally { session.dispose(); }
  });

  it("settles a failed paused update and mode-only supersession without leaving actions fenced", async () => {
    const media = define({
      sample: { label: "initial" },
      config: { width: 320, height: 180, fps: 10, duration: 2 },
      render: (ctx) => {
        if (ctx.data.label === "fail") throw new Error("failed candidate");
        return Text(String(ctx.data.label));
      },
    });
    const presenter = new TestPresenter();
    const session = await createMediaSession(media, { presenter });
    try {
      await session.mount(document.createElement("div"));
      const accepted = session.getPresentation().accepted;
      const presentations = vi.fn();
      session.on("presentation", presentations);
      await expect(session.update({ data: { label: "fail" } })).rejects.toThrow("failed candidate");
      expect(session.getPresentation()).toMatchObject({ accepted, isPending: false });
      expect(presentations.mock.calls.at(-1)?.[0].isPending).toBe(false);
      let release!: () => void;
      const present = presenter.present.bind(presenter);
      presenter.present = async (...args) => {
        if (args[0].includes("cancelled")) await new Promise<void>((resolve) => { release = resolve; });
        present(...args);
      };
      const candidate = session.update({ data: { label: "cancelled" } });
      const rejected = expect(candidate).rejects.toThrow(/superseded/);
      await vi.waitFor(() => expect(release).toBeTypeOf("function"));
      const mode = session.update({ playbackMode: "loop" });
      release();
      await rejected; await mode;
      expect(session.getPresentation()).toMatchObject({ isPending: false, accepted: { inputRevision: 0 } });
      expect(session.getClock().getState().playbackMode).toBe("loop");
      expect(presenter.records.at(-1)?.html).toContain("initial");
    } finally { session.dispose(); }
  });

  it("serializes invalid preflight update rollback and cancels an older pending publication", async () => {
    const presenter = new TestPresenter();
    const session = await createMediaSession(template, { presenter, performance: {} });
    try {
      await session.mount(document.createElement("div"));
      const accepted = session.getPresentation().accepted;
      let release!: () => void;
      const present = presenter.present.bind(presenter);
      presenter.present = async (...args) => {
        if (args[0].includes("older candidate")) await new Promise<void>((resolve) => { release = resolve; });
        present(...args);
      };
      const first = session.update({ data: { label: "older candidate" } });
      const firstRejected = expect(first).rejects.toThrow(/superseded/);
      await vi.waitFor(() => expect(release).toBeTypeOf("function"));
      const invalid = session.update({ fps: 0 });
      const invalidRejected = expect(invalid).rejects.toThrow(/positive finite fps/);
      expect(session.getPresentation().isPending).toBe(true);
      release();
      await firstRejected; await invalidRejected;
      expect(session.getPresentation()).toMatchObject({ accepted, isPending: false });
      expect(session.getState()).toMatchObject({ fps: 10, isPlaying: false });
      expect(presenter.records.at(-1)?.html).toContain("hello");
      expect(session.getPerformance()?.byKind.update).toMatchObject({ requested: 2, evaluated: 1, failed: 1, superseded: 1, accepted: 0 });
    } finally { session.dispose(); }
  });

  it("settles a lone invalid paused update and keeps newer valid work pending", async () => {
    const presenter = new TestPresenter();
    const session = await createMediaSession(template, { presenter, performance: {} });
    try {
      await session.mount(document.createElement("div"));
      const accepted = session.getPresentation().accepted;
      await expect(session.update({ duration: Number.NaN })).rejects.toThrow(/positive finite fps/);
      expect(session.getPresentation()).toMatchObject({ accepted, isPending: false });
      let releaseRollback!: () => void;
      let releaseNewer!: () => void;
      let waitForRollback = true;
      const present = presenter.present.bind(presenter);
      presenter.present = async (...args) => {
        if (waitForRollback && args[0].includes("hello")) {
          waitForRollback = false;
          await new Promise<void>((resolve) => { releaseRollback = resolve; });
        } else if (args[0].includes("valid newer")) {
          await new Promise<void>((resolve) => { releaseNewer = resolve; });
        }
        present(...args);
      };
      const invalid = session.update({ duration: -1 });
      const rejected = expect(invalid).rejects.toThrow(/positive finite fps/);
      await vi.waitFor(() => expect(releaseRollback).toBeTypeOf("function"));
      const newer = session.update({ data: { label: "valid newer" } });
      releaseRollback();
      await rejected;
      await vi.waitFor(() => expect(releaseNewer).toBeTypeOf("function"));
      expect(session.getPresentation()).toMatchObject({ accepted, isPending: true });
      releaseNewer(); await newer;
      expect(session.getPresentation()).toMatchObject({ isPending: false, accepted: { inputRevision: 1 } });
      expect(presenter.records.at(-1)?.html).toContain("valid newer");
    } finally { session.dispose(); }
  });

  it("keeps an invalid preflight failure fenced if accepted-state rollback fails", async () => {
    const presenter = new TestPresenter();
    const session = await createMediaSession(template, { presenter, performance: {} });
    try {
      await session.mount(document.createElement("div"));
      const accepted = session.getPresentation().accepted;
      presenter.present = async () => { throw new Error("rollback failed"); };
      await expect(session.update({ fps: 0 })).rejects.toThrow(/positive finite fps/);
      expect(session.getPresentation()).toMatchObject({ accepted, isPending: true });
      expect(session.getPerformance()?.byKind.update).toMatchObject({ requested: 1, failed: 1 });
    } finally { session.dispose(); }
  });

  it("rejects a manifest-only resolver failure before accepting candidate data or semantics", async () => {
    const presenter = new TestPresenter();
    let semantic = { label: "initial", frame: 0, fps: 10 };
    const media = define({
      sample: { label: "initial" },
      config: { width: 320, height: 180, fps: 10, duration: 2 },
      render: (ctx) => {
        semantic = { label: String(ctx.data.label), frame: ctx.timeline.frame, fps: ctx.fps };
        return Html({ html: `<span>${ctx.data.label}</span>${ctx.std.media.video({ src: "/clip.mp4", at: ctx.timeline.seconds }).html}<div data-superimg-plate="resolver-transaction-test.mp4"></div>` });
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({
      compiled: { fps: 10, totalFrames: 20, width: 100, height: 100 },
      atlas: { columns: 1, rows: 1, sheets: [] },
    }) })));
    const resolver = vi.fn((filename: string) => `/accepted/${filename}`);
    const rejectedResolver = vi.fn((filename: string) => {
      if (filename.endsWith("manifest.json")) throw new Error("manifest resolver failed");
      return `/candidate/${filename}`;
    });
    const session = await createMediaSession(media, {
      presenter, assetResolver: resolver, fonts: { css: ".accepted{}" }, playback: "deterministic",
      performance: {}, captureSemantic: () => ({ scene: semantic }),
    });
    try {
      await session.mount(document.createElement("div"));
      await session.seekFrame(3);
      const accepted = session.getPresentation().accepted;
      const state = session.getState();
      const html = presenter.element.innerHTML;
      const time = presenter.element.querySelector("video")!.currentTime;
      const errors = vi.fn();
      session.on("error", errors);
      await expect(session.update({ data: { label: "candidate" }, fps: 20, width: 640,
        assetResolver: rejectedResolver, fonts: { css: ".candidate{}" } })).rejects.toThrow("manifest resolver failed");
      expect(rejectedResolver).toHaveBeenCalledWith(".superimg/plates/resolver-transaction-test/manifest.json");
      expect(session.getPresentation()).toMatchObject({ accepted, isPending: false });
      expect(session.getState()).toBe(state);
      expect(presenter.element.innerHTML).toBe(html);
      expect(presenter.inlineCss).toEqual([".accepted{}"]);
      expect(presenter.element.querySelector("video")!.currentTime).toBe(time);
      expect(errors).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: "manifest resolver failed" }));
      const failed = session.getPerformance()?.records.at(-1);
      expect(failed).toMatchObject({ kind: "update", outcome: "failed", evaluatedFrame: 6 });
      expect(failed?.timings.resources).toBeTypeOf("number");
      expect(session.getPerformance()?.byKind.update).toMatchObject({ requested: 1, evaluated: 1, failed: 1, accepted: 0 });
      await session.update({ data: { label: "next valid" } });
      expect(session.getPresentation().accepted).toMatchObject({ inputRevision: 1, semantic: { scene: { label: "next valid", frame: 3, fps: 10 } } });
      expect(presenter.records.at(-1)?.html).toContain("next valid");
      expect(presenter.inlineCss).toEqual([".accepted{}"]);
    } finally { session.dispose(); vi.unstubAllGlobals(); }
  });

  it("reports requested and accepted frames separately while presentation is pending", async () => {
    const presenter = new TestPresenter();
    const session = await createMediaSession(template, { presenter });
    await session.mount(document.createElement("div"));
    const accepted = session.getPresentation().accepted!;
    let release!: () => void;
    const present = presenter.present.bind(presenter);
    presenter.present = async (...args) => {
      await new Promise<void>((resolve) => { release = resolve; });
      present(...args);
    };

    const pending = session.seekFrame(4);
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    expect(session.getPresentation()).toMatchObject({ requestedFrame: 4, accepted, isReady: true, isPending: true, disposed: false });
    release();
    await pending;
    expect(session.getPresentation().accepted).toMatchObject({ frame: 4, revision: accepted.revision + 1 });
    expect(session.getPresentation().isPending).toBe(false);
    session.dispose();
    expect(session.getPresentation()).toMatchObject({ accepted: null, isReady: false, isPending: false, disposed: true });
  });

  it("tracks a same-frame data update until acceptance, including a failed paint", async () => {
    const presenter = new TestPresenter();
    const session = await createMediaSession(template, { presenter });
    await session.mount(document.createElement("div"));
    const accepted = session.getPresentation().accepted!;
    const present = presenter.present.bind(presenter);
    let release!: () => void;
    presenter.present = async (...args) => {
      present(...args);
      await new Promise<void>((resolve) => { release = resolve; });
    };
    const pending = session.update({ data: { label: "replacement" } });
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    expect(session.getPresentation()).toMatchObject({ requestedFrame: accepted.frame, accepted, isPending: true });
    expect(presenter.records.at(-1)?.html).toContain("replacement");
    release();
    await pending;
    expect(session.getPresentation()).toMatchObject({ isPending: false, accepted: { frame: accepted.frame, revision: accepted.revision + 1 } });

    presenter.present = async () => { throw new Error("paint failed"); };
    await expect(session.renderFrame(accepted.frame)).rejects.toThrow("paint failed");
    expect(session.getPresentation().isPending).toBe(true);
    presenter.present = present;
    await session.renderFrame(accepted.frame);
    expect(session.getPresentation().isPending).toBe(false);
    session.dispose();
  });

  it("identifies superseded render results without accepting their requested frame", async () => {
    const session = await createMediaSession(template, { presenter: new TestPresenter() });
    await session.mount(document.createElement("div"));
    const stale = session.seekFrame(1);
    const latest = session.seekFrame(3);
    const [staleResult, accepted] = await Promise.all([stale, latest]);
    expect(staleResult.stale).toBe(true);
    expect(accepted).toMatchObject({ frame: 3, revision: 2 });
    expect(session.getPresentation()).toMatchObject({ requestedFrame: 3, accepted: { frame: 3, revision: 2 } });
    session.dispose();
  });

  it("captures semantic state during evaluation before awaiting the DOM presenter", async () => {
    let semantic = { target: { frame: 0 } };
    const media = define({
      config: { width: 320, height: 180, fps: 10, duration: 1 },
      render: (ctx) => {
        semantic = { target: { frame: ctx.timeline.frame } };
        return Text(`frame:${ctx.timeline.frame}`);
      },
    });
    const presenter = new TestPresenter();
    const session = await createMediaSession(media, { presenter, captureSemantic: () => ({ lesson: semantic }) });
    await session.mount(document.createElement("div"));
    let release!: () => void;
    const present = presenter.present.bind(presenter);
    presenter.present = async (...args) => {
      await new Promise<void>((resolve) => { release = resolve; });
      present(...args);
    };
    const pending = session.seekFrame(4);
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    semantic.target.frame = 8;
    release();
    await pending;
    expect(session.getPresentation().accepted).toMatchObject({ frame: 4, semantic: { lesson: { target: { frame: 4 } } } });
    expect(Object.isFrozen(session.getPresentation().accepted?.semantic?.lesson)).toBe(true);
    session.dispose();
  });

  it("does not let an older pending update replace a newer frame request", async () => {
    const presenter = new TestPresenter();
    const session = await createMediaSession(template, { presenter });
    await session.mount(document.createElement("div"));
    let release!: () => void;
    const present = presenter.present.bind(presenter);
    presenter.present = async (...args) => {
      if (args[0].includes("pending update")) await new Promise<void>((resolve) => { release = resolve; });
      present(...args);
    };
    const update = session.update({ data: { label: "pending update" } });
    const rejected = expect(update).rejects.toThrow(/superseded/);
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    const seek = session.seekFrame(4);
    release();
    await rejected;
    await seek;
    expect(session.getPresentation()).toMatchObject({ requestedFrame: 4, isPending: false, accepted: { frame: 4, revision: 2 } });
    expect(presenter.records.at(-1)?.html).toContain("hello");
    session.dispose();
  });

  it("mounts canonical media, waits for readiness, and renders a media graph", async () => {
    const presenter = new TestPresenter();
    const session = await createMediaSession(template, { presenter, data: { label: "ready" } });
    await session.mount(document.createElement("div"));
    await session.ready();

    const result = await session.renderFrame(5);

    expect(session.getState()).toMatchObject({
      isReady: true,
      currentFrame: 5,
      fps: 10,
      totalFrames: 10,
      width: 640,
      height: 360,
    });
    expect(result.graph.externalEmbeds).toHaveLength(1);
    expect(presenter.records.at(-1)?.html).toContain('data-frame="5"');
    expect(presenter.inlineCss.join("\n")).toContain("font-family");
    expect(Object.isFrozen(session.getState())).toBe(true);
    session.dispose();
  });

  it("installs embedded font faces before waiting for surface font readiness", async () => {
    const regular = new Uint8Array(readFileSync(resolve(__dirname, "../../superimg-core/assets/fonts/Inter-400.ttf")));
    const bold = new Uint8Array(readFileSync(resolve(__dirname, "../../superimg-core/assets/fonts/Inter-700.ttf")));
    const media = define({
      sample: { label: "Embedded Inter" },
      config: {
        fonts: [
          { family: "Inter", weight: 400, src: regular },
          { family: "Inter", weight: 700, src: bold.buffer },
        ],
        inlineCss: ["body{color:#123456}"],
      },
      render: (ctx) => Text({ fontFamily: "Inter", weight: 700 }, ctx.data.label),
    });
    const presenter = new TestPresenter();
    const session = await createMediaSession(media, { presenter });
    const descriptor = Object.getOwnPropertyDescriptor(document, "fonts");
    let releaseFonts!: () => void;
    const fontReady = new Promise<void>((resolve) => { releaseFonts = resolve; });
    const readyRead = vi.fn(() => {
      expect(presenter.inlineCss.join("\n")).toContain('@font-face{font-family:"Inter"');
      return fontReady;
    });
    Object.defineProperty(document, "fonts", { configurable: true, value: { get ready() { return readyRead(); } } });
    try {
      const mounting = session.mount(document.createElement("div"));
      await vi.waitFor(() => expect(readyRead).toHaveBeenCalled());
      expect(session.getState().isReady).toBe(false);
      releaseFonts();
      await mounting;
      await session.ready();
      expect(session.getState().isReady).toBe(true);
      expect(presenter.inlineCss).toHaveLength(3);
      expect(presenter.inlineCss[0]).toContain("font-weight:400;src:url(\"data:font/ttf;base64,");
      expect(presenter.inlineCss[1]).toContain("font-weight:700;src:url(\"data:font/ttf;base64,");
      expect(presenter.inlineCss[2]).toBe("body{color:#123456}");
      const css = [...presenter.inlineCss];
      await session.update({ data: { label: "Updated" } });
      expect(presenter.inlineCss).toEqual(css);
      await session.update({ fonts: { css: "/* resolved by host */" } });
      expect(presenter.inlineCss).toEqual(["/* resolved by host */", "body{color:#123456}"]);
      await session.update({ fonts: {} });
      expect(presenter.inlineCss).toEqual(["body{color:#123456}"]);
    } finally {
      releaseFonts();
      session.dispose();
      if (descriptor) Object.defineProperty(document, "fonts", descriptor);
      else Reflect.deleteProperty(document, "fonts");
    }
  });

  it("requests sanitization only when runtime inspection finds an Html node", async () => {
    const presenter = new TestPresenter();
    const mixed = define({
      sample: { opaque: false },
      config: { width: 320, height: 180 },
      render: (ctx) => ctx.data.opaque
        ? Html({ html: `<button onclick="evil()">opaque</button>` })
        : Frame(
            { width: "fill", height: "fill" },
            Text({ size: 24 }, "pure tree"),
          ),
    });
    const session = await createMediaSession(mixed, { presenter });
    await session.mount(document.createElement("div"));

    expect(presenter.records).toHaveLength(1);
    expect(presenter.records[0]?.sanitize).toBe(false);

    await session.update({ data: { opaque: true } });

    expect(presenter.records.at(-1)?.sanitize).toBe(true);
    session.dispose();
  });

  it("keeps options, state, and the visible frame when an update cannot render", async () => {
    const presenter = new TestPresenter();
    const errors = vi.fn();
    const session = await createMediaSession(define({
      sample: { label: "stable" },
      config: { width: 320, height: 180 },
      render: (ctx) => {
        if (ctx.data.label === "fail") throw new Error("update failed");
        return Frame(
          { width: "fill", height: "fill" },
          Text({ size: 24 }, String(ctx.data.label)),
        );
      },
    }), { presenter });
    session.on("error", errors);
    await session.mount(document.createElement("div"));
    const previousState = session.getState();
    const previousHtml = presenter.element.innerHTML;

    await expect(session.update({ data: { label: "fail" } })).rejects.toThrow("update failed");

    expect(session.getState()).toBe(previousState);
    expect(presenter.element.innerHTML).toBe(previousHtml);
    expect(errors).toHaveBeenCalledTimes(1);
    session.dispose();
  });

  it("exposes passive medium and animation metadata", async () => {
    const presenter = new TestPresenter();
    const still = define({
      medium: "svg",
      config: { width: 400, height: 300 },
      render: (ctx) => Html({
        width: "fill",
        height: "fill",
        html: `<svg width="${ctx.width}" height="${ctx.height}"></svg>`,
      }),
    });
    const session = await createMediaSession(still, { presenter });
    await session.mount(document.createElement("div"));

    expect(session.getState()).toMatchObject({
      medium: "svg",
      animated: false,
      totalFrames: 1,
      width: 400,
      height: 300,
    });
    session.dispose();
  });

  it("accepts a custom canvas size without preset lookup", async () => {
    const presenter = new TestPresenter();
    const session = await createMediaSession(template, {
      presenter,
      size: { width: 777, height: 555 },
    });
    await session.mount(document.createElement("div"));

    expect(session.getState()).toMatchObject({ width: 777, height: 555 });
    await session.update({ size: { width: 321, height: 654 } });
    expect(session.getState()).toMatchObject({ width: 321, height: 654 });
    session.dispose();
  });

  it("keeps native video paused in deterministic playback mode", async () => {
    const media = define({
      config: { width: 320, height: 180, fps: 10, duration: 1 },
      render: (ctx) => Html({
        width: "fill",
        height: "fill",
        html: ctx.std.media.video({ src: "/clip.mp4", at: ctx.timeline.seconds }).html,
      }),
    });
    const presenter = new TestPresenter();
    const session = await createMediaSession(media, { presenter, playback: "deterministic" });
    await session.mount(document.createElement("div"));
    const video = presenter.element.querySelector("video") as HTMLVideoElement;
    const play = vi.fn(() => Promise.resolve());
    const pause = vi.fn();
    video.play = play;
    video.pause = pause;

    session.play();

    expect(play).not.toHaveBeenCalled();
    expect(pause).toHaveBeenCalled();
    session.dispose();
  });

  it.each(["native", "deterministic"] as const)("seeks paused %s video to an adjacent authored frame at 25 fps", async (playback) => {
    const media = define({
      config: { width: 320, height: 180, fps: 25, duration: 7 / 25 },
      render: (ctx) => Html({ html: ctx.std.media.video({ src: "/clip.mp4", at: ctx.timeline.seconds }).html }),
    });
    const presenter = new TestPresenter();
    const session = await createMediaSession(media, { presenter, playback });
    try {
      await session.mount(document.createElement("div"));
      expect(presenter.element.querySelector("video")!.currentTime).toBe(0);
      const accepted = await session.seekFrame(1);
      const video = presenter.element.querySelector("video")!;
      expect(accepted.frame).toBe(1);
      expect(video.currentTime).toBeCloseTo(0.04, 6);
      expect(video.paused).toBe(true);
    } finally { session.dispose(); }
  });

  it("retains native playback drift tolerance while the clock is playing", async () => {
    const media = define({
      config: { width: 320, height: 180, fps: 25, duration: 1 },
      render: () => Html({ html: '<video src="/clip.mp4" data-superimg-media="video" data-t="0.04"></video>' }),
    });
    const presenter = new StablePresenter();
    const session = await createMediaSession(media, { presenter });
    try {
      await session.mount(document.createElement("div"));
      const video = presenter.element.querySelector("video")!;
      video.currentTime = 0;
      video.play = vi.fn(() => Promise.resolve());
      session.play();
      expect(video.currentTime).toBe(0);
      expect(video.play).toHaveBeenCalledOnce();
    } finally { session.dispose(); }
  });

  it("prevents stale rapid renders from overwriting session state", async () => {
    const presenter = new DelayedPresenter();
    const session = await createMediaSession(template, { presenter });
    await session.mount(document.createElement("div"));

    await Promise.all([session.seekFrame(1), session.seekFrame(3)]);

    expect(session.getState().currentFrame).toBe(3);
    expect(presenter.records.at(-1)?.html).toContain('data-frame="3"');
    expect(presenter.records.filter((record) => record.html.includes('data-frame="1"'))).toHaveLength(0);
    session.dispose();
  });

  it("owns play-once and loop progression through the session clock", async () => {
    const playbackTemplate = define({
      config: { width: 320, height: 180, fps: 10, duration: 1 },
      render: (ctx) => Frame(
        { width: "fill", height: "fill" },
        Text({ size: 24 }, `frame:${ctx.globalFrame}`),
      ),
    });

    const once = await createMediaSession(playbackTemplate, {
      presenter: new TestPresenter(),
      playbackMode: "once",
    });
    await once.mount(document.createElement("div"));
    const onceRendered = new Promise<void>((resolve) => {
      const off = once.on("rendered", (result) => {
        if (result.frame !== 9) return;
        off();
        resolve();
      });
    });
    once.play();
    once.getClock().step(Number.MAX_SAFE_INTEGER);
    await onceRendered;

    expect(once.getState()).toMatchObject({ currentFrame: 9, isPlaying: false });
    once.dispose();

    const loop = await createMediaSession(playbackTemplate, {
      presenter: new TestPresenter(),
      playbackMode: "loop",
    });
    await loop.mount(document.createElement("div"));
    const loopRendered = new Promise<void>((resolve) => {
      const off = loop.on("rendered", (result) => {
        if (result.frame !== 0) return;
        off();
        resolve();
      });
    });
    loop.play();
    loop.getClock().step(Number.MAX_SAFE_INTEGER);
    await loopRendered;

    expect(loop.getState()).toMatchObject({ currentFrame: 0, isPlaying: true });
    loop.pause();
    loop.dispose();
  });

  it("synchronizes video and plate time even when presentation HTML is unchanged", async () => {
    const presenter = new StablePresenter();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        schemaVersion: 1,
        compiled: { fps: 10, totalFrames: 10, width: 100, height: 100 },
        atlas: {
          tileWidth: 100,
          tileHeight: 100,
          columns: 2,
          rows: 2,
          sheets: [{ file: "sheet.png", startFrame: 0, frameCount: 10 }],
        },
      }),
    }));
    class ImmediateImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private value = "";

      get src(): string { return this.value; }
      set src(value: string) {
        this.value = value;
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("Image", ImmediateImage);

    const media = define({
      config: { width: 320, height: 180, fps: 10, duration: 1 },
      render: () => Html({
        width: "fill",
        height: "fill",
        html: [
          '<video data-superimg-media="video" data-t="0.5"></video>',
          '<div data-superimg-plate="constant-session-sync.mp4"></div>',
        ].join(""),
      }),
    });

    try {
      const session = await createMediaSession(media, { presenter, playback: "deterministic" });
      await session.mount(document.createElement("div"));
      const video = presenter.element.querySelector("video") as HTMLVideoElement;
      const plate = presenter.element.querySelector("[data-superimg-plate]") as HTMLElement;
      video.currentTime = 0;
      video.pause = vi.fn();

      await session.seekFrame(3);
      await vi.waitFor(() => expect(plate.style.backgroundPosition).toBe("-100% -100%"));

      expect(presenter.mutations).toBe(1);
      expect(video.currentTime).toBe(0.5);
      expect(video.pause).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      session.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("completes awaited scrubs only after the requested frame is presented", async () => {
    const presenter = new DelayedPresenter();
    const session = await createMediaSession(template, { presenter });
    await session.mount(document.createElement("div"));

    session.beginScrub();
    const completed = session.seekProgress(0.6);
    expect(session.getState().isScrubbing).toBe(true);
    await completed;
    session.endScrub();

    expect(session.getState()).toMatchObject({ currentFrame: 5, isScrubbing: false });
    expect(presenter.records.at(-1)?.html).toContain('data-frame="5"');
    session.dispose();
  });

  it("presents exactly one initial frame and publishes passive state changes", async () => {
    const presenter = new TestPresenter();
    const session = await createMediaSession(template, { presenter });
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);
    await session.mount(document.createElement("div"));

    expect(presenter.records).toHaveLength(1);
    await session.seekFrame(4);
    session.play();
    session.pause();

    expect(listener).toHaveBeenCalled();
    expect(session.getState().isPlaying).toBe(false);
    unsubscribe();
    session.dispose();
  });

  it("emits each lifecycle event once and rejects work after disposal", async () => {
    const presenter = new TestPresenter();
    const session = await createMediaSession(template, { presenter });
    const ready = vi.fn();
    const rendered = vi.fn();
    const play = vi.fn();
    const pause = vi.fn();
    session.on("ready", ready);
    session.on("rendered", rendered);
    session.on("play", play);
    session.on("pause", pause);

    await session.mount(document.createElement("div"));
    await session.seekFrame(2);
    session.play();
    session.pause();

    expect(ready).toHaveBeenCalledTimes(1);
    expect(rendered).toHaveBeenCalledTimes(2);
    expect(play).toHaveBeenCalledTimes(1);
    expect(pause).toHaveBeenCalledTimes(1);

    session.dispose();
    expect(session.getState()).toMatchObject({ isReady: false, isPlaying: false });
    await expect(session.seekFrame(3)).rejects.toThrow(/disposed/);
  });
  it("commits private evaluation bindings before public observers without publishing them", async () => {
    const presenter = new TestPresenter();
    let bound = 0;
    let failHook = false;
    const hookError = new Error("private acceptance observer failed");
    const media = { ...template, captureFrameAcceptance: () => {
      const value = ++bound;
      return () => { accepted = value; if (failHook) throw hookError; };
    } };
    let accepted = 0;
    const session = await createMediaSession(media, { presenter });
    const host = document.createElement("div");
    await session.mount(host);
    const errors: Error[] = [];
    session.on("error", error => errors.push(error));
    session.subscribe(() => expect(accepted).toBe(bound));
    failHook = true;
    await expect(session.update({ data: { label: "accepted despite observer fault" } })).resolves.toBeUndefined();
    expect(errors).toContain(hookError);
    expect(session.getPresentation().accepted?.html).toContain("accepted despite observer fault");
    expect(session.getPresentation().accepted).not.toHaveProperty("acceptEvaluation");
    expect(JSON.stringify(session.getPresentation())).not.toContain("captureFrameAcceptance");
    session.dispose();
  });

});
