/** @vitest-environment happy-dom */

import { describe, expect, it, vi } from "vitest";
import { video, type InteractiveCompositionRuntime } from "@superimg/types";
import { Html } from "@superimg/stdlib/tree";
import { choose, sequence, together } from "@superimg/core";
import { defineInteractive } from "@foxworth/superimg/interactive/define";
import { present } from "./program.js";
import { createDomPlayer } from "./dom-player.js";
import type { DomPlayer } from "./dom-player.js";
import type { PlayerInput, PlayerPresentation } from "./player-types.js";

const size = { width: 320, height: 180 };

function acceptedScene(sceneId: string, actions = ["accept"], visible = true) {
  return { sceneId, nodes: [{ id: "answer", actions, visible }], state: "accepted" };
}

function shown(semantic: Record<string, unknown>, frame = 0, revision = 1, generation = 1): PlayerPresentation {
  return { generation, requestedFrame: frame, isReady: true, isPending: false, disposed: false,
    accepted: { frame, revision, html: "accepted", compositeHtml: "accepted", semantic } };
}

function interactiveFixture() {
  const callbacks: Array<(event: { action: string; nodeId: string; frame: number }) => void> = [];
  const getFrames: Array<() => number> = [];
  const detached = vi.fn();
  const getSnapshot = vi.fn(() => ({ state: "speculative" }));
  const subscribe = vi.fn(() => () => undefined);
  const runtime: InteractiveCompositionRuntime = {
    media: clip("interactive"),
    setScene: vi.fn(), getSnapshot, subscribe,
    attachActions: (_container, getFrame, listener) => {
      callbacks.push(listener);
      getFrames.push(getFrame);
      return detached;
    },
  };
  return { child: { kind: "interactive" as const, createCompositionRuntime: () => runtime }, runtime, callbacks, getFrames, detached, getSnapshot, subscribe };
}

function clip(label: string) {
  return video({ size, fps: 10, duration: "1f", render: () => Html({ width: "fill", height: "fill", html: label }) });
}

function recordingPlayer() {
  const loaded: PlayerInput[] = [];
  const updates: unknown[] = [];
  const seeks: number[] = [];
  const player = {
    container: {} as HTMLElement,
    load: async (media: PlayerInput) => {
      loaded.push(media);
      return { status: "success" as const, cues: [], totalFrames: 4, duration: 0.4, width: 320, height: 180, fps: 10 };
    },
    update: async (update: unknown) => { updates.push(update); },
    seek: async ({ frame }: { frame: number }) => { seeks.push(frame); },
    getState: () => ({ currentFrame: seeks.at(-1) ?? 0, totalFrames: 4 }),
  } as unknown as DomPlayer;
  return { player, loaded, updates, seeks };
}

describe("present retained programs", () => {
  it("accepts retained manual scene state when returning after another page's route change", async () => {
    const lesson = defineInteractive({
      size,
      guide: { id: "lesson", steps: [{ id: "one", label: "One", duration: "1s", scene: {} }] },
      render(ctx) {
        const answer = ctx.scene.node("answer", { actions: ["accept"] });
        ctx.scene.states({ retained: { nodes: { answer: { visible: false } } } });
        return Html({ width: "fill", height: "fill", html: `<button ${answer.attrs}>Answer</button>` });
      },
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const player = createDomPlayer({ container: host, playerMode: "dev" });
    const session = present(player, sequence([
      { id: "lesson", content: lesson },
      { id: "report", content: choose({ basic: clip("basic report"), detail: clip("detailed report") }) },
    ]), { mode: "manual", size, fps: 10, routes: { report: "basic" } });
    try {
      const result = await session.ready;
      if (result.status === "error") throw new Error(`${result.message}: ${JSON.stringify(result.details)}`);
      expect(result.status).toBe("success");
      await session.setScene("lesson", { state: "retained" });
      expect(session.snapshot().interactive.lesson).toMatchObject({ activeState: "retained", nodes: [{ id: "answer", visible: false }] });
      await session.go("report");
      expect(session.snapshot().interactive).toEqual({});
      expect((await session.choose("report", "detail")).status).toBe("success");
      expect((await session.go("lesson")).status).toBe("success");
      expect(player.getPresentation()).toMatchObject({ isPending: false, accepted: { semantic: { root: { activeState: "retained" } } } });
      expect(session.snapshot().interactive.lesson).toMatchObject({ activeState: "retained", nodes: [{ id: "answer", visible: false }] });
      expect(host.querySelector("iframe")!.contentDocument!.querySelector("button")!.style.display).toBe("none");
    } finally { session.dispose(); player.dispose(); host.remove(); }
  });

  it("suppresses the old page's native action during acceptance of a new generation with matching scene and node ids", async () => {
    const lesson = defineInteractive({
      size,
      guide: { id: "lesson", steps: [{ id: "one", label: "One", duration: "1s", scene: {} }] },
      render(ctx) {
        const answer = ctx.scene.node("answer", { actions: ["accept"] });
        return Html({ width: "fill", height: "fill", html: `<button ${answer.attrs}>Answer</button>` });
      },
    });
    const host = document.createElement("div"); document.body.appendChild(host);
    const player = createDomPlayer({ container: host, playerMode: "dev" });
    const session = present(player, sequence([{ id: "first", content: lesson }, { id: "second", content: lesson }]), { mode: "manual", size, fps: 10 });
    try {
      expect((await session.ready).status).toBe("success");
      const firstGeneration = player.getPresentation().generation;
      const oldButton = host.querySelector("iframe")!.contentDocument!.querySelector("button")!;
      const actions: unknown[] = [];
      session.on("action", (event) => actions.push(event));
      let clickedDuringCommit = false;
      player.on("presentation", (presentation) => {
        if (presentation.generation > firstGeneration && presentation.accepted && presentation.isPending === false) {
          clickedDuringCommit = true;
          oldButton.click();
        }
      });
      expect((await session.go("second")).status).toBe("success");
      expect(clickedDuringCommit).toBe(true);
      expect(actions).toEqual([]);
      host.querySelector("iframe")!.contentDocument!.querySelector("button")!.click();
      expect(actions).toEqual([{ path: "second", action: "accept", nodeId: "answer", frame: 0,
        presentation: { generation: firstGeneration + 1, revision: 1, frame: 0, sceneId: "default" } }]);
    } finally { session.dispose(); player.dispose(); host.remove(); }
  });

  it.each(["manual", "timeline"] as const)("retains committed routes after a structured %s load failure", async (mode) => {
    const story = sequence([{ id: "branch", content: choose({ basic: clip("basic"), advanced: clip("advanced") }) }]);
    const { player, seeks } = recordingPlayer();
    const successful = player.load.bind(player);
    player.load = async (media, options) => media.composition?.schedule.selectedRoutes?.[mode === "manual" ? "root" : "branch"] === "advanced"
      ? { status: "error", errorType: "validation", message: "branch failed", suggestion: "repair branch" }
      : successful(media, options);
    const session = present(player, story, { mode, size, fps: 10, routes: { branch: "basic" } });
    await session.ready;
    const failed = await session.choose("branch", "advanced");
    expect(failed.status).toBe("error");
    expect(session.snapshot().routes).toEqual({ branch: "basic" });
    expect(session.currentId).toBe("branch");
    expect((await session.go("branch")).status).toBe("success");
    if (mode === "timeline") expect(seeks.at(-1)).toBe(0);
    session.dispose();
  });

  it.each(["manual", "timeline"] as const)("only commits the winning concurrent %s route choice", async (mode) => {
    const story = sequence([{ id: "branch", content: choose({ basic: clip("basic"), advanced: clip("advanced"), other: clip("other") }) }]);
    const { player } = recordingPlayer();
    const session = present(player, story, { mode, size, fps: 10, routes: { branch: "basic" } });
    await session.ready;
    const pending: Array<(result: Awaited<ReturnType<DomPlayer["load"]>>) => void> = [];
    player.load = () => new Promise((resolve) => pending.push(resolve));
    const first = session.choose("branch", "advanced");
    const latest = session.choose("branch", "other");
    expect(session.snapshot().routes).toEqual({ branch: "basic" });
    const success = { status: "success" as const, cues: [], totalFrames: 1, duration: 0.1, width: 320, height: 180, fps: 10 };
    pending[1]!(success);
    expect((await latest).status).toBe("success");
    pending[0]!(success);
    expect(await first).toMatchObject({ status: "error", details: { code: "PLAYER_LOAD_SUPERSEDED" } });
    expect(session.snapshot().routes).toEqual({ branch: "other" });
    session.dispose();
  });

  it.each(["manual", "timeline"] as const)("prepares every selected %s route and retains host source bindings", async (mode) => {
    const story = sequence([{ id: "branch", content: choose({ basic: clip("basic"), advanced: clip("advanced") }) }]);
    const { player, loaded } = recordingPlayer();
    const load = player.load.bind(player);
    const loadOptions: unknown[] = [];
    player.load = async (media, options) => { loadOptions.push(options); return load(media, options); };
    const resolver = (name: string) => `/host/${name}`;
    const prepare = vi.fn((media: PlayerInput, context: { routes: Readonly<Record<string, string>> }) => ({
      media,
      loadOptions: { assets: { selected: { type: "image" as const, url: context.routes.branch!, width: 1, height: 1, mimeType: "image/png", size: 0 } } },
    }));
    const session = present(player, story, { mode, size, fps: 10, routes: { branch: "basic" },
      loadOptions: { assetResolver: resolver }, prepare });
    await session.ready;
    await session.choose("branch", "advanced");
    expect(loaded).toHaveLength(2);
    expect(prepare.mock.calls.map((call) => call[1].routes.branch)).toEqual(["basic", "advanced"]);
    expect(loadOptions[1]).toMatchObject({ assetResolver: resolver, assets: { selected: { url: "advanced" } } });
    session.dispose();
  });

  it.each(["manual", "timeline"] as const)("does not load a superseded %s route after slow source preparation", async (mode) => {
    const story = sequence([{ id: "branch", content: choose({ basic: clip("basic"), advanced: clip("advanced"), other: clip("other") }) }]);
    const { player, loaded } = recordingPlayer();
    const releases: Record<string, () => void> = {};
    const session = present(player, story, { mode, size, fps: 10, routes: { branch: "basic" },
      prepare: async (media, context) => {
        if (context.routes.branch !== "basic") await new Promise<void>((resolve) => { releases[context.routes.branch!] = resolve; });
        return { media };
      },
    });
    await session.ready;
    const first = session.choose("branch", "advanced");
    const latest = session.choose("branch", "other");
    releases.other!();
    expect((await latest).status).toBe("success");
    releases.advanced!();
    expect(await first).toMatchObject({ status: "error", details: { code: "PLAYER_LOAD_SUPERSEDED" } });
    expect(loaded).toHaveLength(2);
    expect(session.snapshot().routes).toEqual({ branch: "other" });
    session.dispose();
  });

  it("manually navigates named pages and applies scoped data through one player", async () => {
    const story = sequence([
      { id: "intro", content: clip("intro") },
      { id: "lesson", content: clip("lesson") },
    ]);
    const { player, loaded, updates } = recordingPlayer();
    const session = present(player, story, { mode: "manual", size, fps: 10 });
    await session.ready;
    expect(session.currentId).toBe("intro");
    await session.next();
    expect(session.currentId).toBe("lesson");
    await session.setData("lesson", { title: "Live" });
    expect(updates).toEqual([{ data: { title: "Live" } }]);
    expect(loaded).toHaveLength(2);
    session.dispose();
  });

  it("projects a whole timeline, changes a route and seeks to named occurrences", async () => {
    const story = sequence([
      { id: "intro", content: clip("intro") },
      { id: "branch", content: choose({ basic: clip("basic"), advanced: clip("advanced") }) },
    ]);
    const { player, loaded, updates, seeks } = recordingPlayer();
    const session = present(player, story, { mode: "timeline", size, fps: 10, routes: { branch: "basic" } });
    await session.ready;
    expect(loaded[0]?.composition?.schedule.selectedRoutes).toEqual({ branch: "basic" });
    await session.go("branch");
    await session.choose("branch", "advanced");
    expect(loaded[1]?.composition?.schedule.selectedRoutes).toEqual({ branch: "advanced" });
    expect(seeks.at(-1)).toBe(1);
    expect(session.currentId).toBe("branch");
    await session.setData("branch/advanced", { title: "Updated" });
    expect(updates.at(-1)).toEqual({ data: { uses: { "branch/advanced": { title: "Updated" } } } });
    expect(session.snapshot().routes).toEqual({ branch: "advanced" });
    session.dispose();
  });

  it("forwards semantic actions with the named occurrence path and applies host scene state", async () => {
    let action: ((event: { action: string; nodeId: string; frame: number }) => void) | undefined;
    const scenes: unknown[] = [];
    const runtime: InteractiveCompositionRuntime = {
      media: clip("interactive guide"),
      setScene: (value) => scenes.push(value),
      getSnapshot: () => ({ step: "question" }),
      subscribe: () => () => undefined,
      attachActions: (_container, _getFrame, listener) => {
        action = listener;
        return () => { action = undefined; };
      },
    };
    const interactive = { kind: "interactive" as const, createCompositionRuntime: () => runtime };
    const story = sequence([{ id: "quiz", content: interactive }]);
    const { player } = recordingPlayer();
    const scene = { ...acceptedScene("default"), step: "question" };
    let presentation = shown({ root: scene }, 0, 3, 7);
    player.getPresentation = () => presentation;
    const session = present(player, story, { mode: "manual", size, fps: 10 });
    await session.ready;
    const received: unknown[] = [];
    session.on("action", (event) => received.push(event));
    action?.({ action: "accept", nodeId: "answer", frame: 0 });
    expect(received).toEqual([{ path: "quiz", action: "accept", nodeId: "answer", frame: 0,
      presentation: { generation: 7, revision: 3, frame: 0, sceneId: "default" } }]);
    presentation = { ...presentation, isPending: true };
    await session.setScene("quiz", { state: "answer" });
    expect(scenes).toEqual([{ state: "answer" }]);
    expect(session.snapshot().interactive.quiz).toEqual(scene);
    session.dispose();
  });

  it("rebases nested manual data to the page-local retained occurrence", async () => {
    const page = sequence([{ id: "slide", content: clip("slide") }]);
    const story = sequence([{ id: "lesson", content: page }]);
    const { player, updates } = recordingPlayer();
    const session = present(player, story, { mode: "manual", size, fps: 10 });
    await session.ready;
    await session.setData("lesson/slide", { title: "Host value" });
    expect(updates.at(-1)).toEqual({ data: { uses: { slide: { title: "Host value" } } } });
    session.dispose();
  });

  it("presents a root choice as one manual page", async () => {
    const story = choose({ basic: clip("basic"), advanced: clip("advanced") });
    const { player, loaded } = recordingPlayer();
    const session = present(player, story, { mode: "manual", size, fps: 10, routes: { root: "advanced" } });
    await session.ready;
    expect(session.parts.map((part) => part.id)).toEqual(["root"]);
    expect(loaded[0]?.composition?.schedule.selectedRoutes).toEqual({ root: "advanced" });
    session.dispose();
  });

  it("rebinds interactive child actions after a manual route change", async () => {
    let attachCount = 0;
    const runtime: InteractiveCompositionRuntime = {
      media: clip("interactive"),
      setScene: () => undefined,
      getSnapshot: () => ({ selected: true }),
      subscribe: () => () => undefined,
      attachActions: (_container, _getFrame, _listener) => {
        attachCount++;
        return () => { attachCount--; };
      },
    };
    const child = { kind: "interactive" as const, createCompositionRuntime: () => runtime };
    const story = sequence([
      { id: "intro", content: clip("intro") },
      { id: "branch", content: choose({ plain: clip("plain"), lesson: child }) },
    ]);
    const { player } = recordingPlayer();
    const session = present(player, story, { mode: "manual", size, fps: 10, routes: { branch: "plain" } });
    await session.ready;
    await session.go("branch");
    await session.choose("branch", "lesson");
    expect(attachCount).toBe(1);
    await session.setScene("branch/lesson", { state: "answer" });
    // A runtime snapshot is speculative unless the Player accepted it.
    expect(session.snapshot().interactive["branch/lesson"]).toBeUndefined();
    session.dispose();
    expect(attachCount).toBe(0);
  });

  it("uses accepted frames, revisions and snapshots instead of speculative runtime state", async () => {
    const fixture = interactiveFixture();
    const { player } = recordingPlayer();
    let presentation = shown({ root: acceptedScene("default") }, 6, 2, 9);
    player.getPresentation = () => presentation;
    const session = present(player, sequence([{ id: "quiz", content: fixture.child }]), { mode: "manual", size, fps: 10 });
    await session.ready;
    const received: unknown[] = [];
    session.on("action", (event) => received.push(event));
    expect(fixture.getFrames[0]!()).toBe(6);
    fixture.callbacks[0]!({ action: "accept", nodeId: "answer", frame: 6 });
    expect(received).toEqual([{ path: "quiz", action: "accept", nodeId: "answer", frame: 6,
      presentation: { generation: 9, revision: 2, frame: 6, sceneId: "default" } }]);
    const next = { ...acceptedScene("default"), state: "next accepted" };
    presentation = shown({ root: next }, 8, 4, 9);
    fixture.callbacks[0]!({ action: "accept", nodeId: "answer", frame: 8 });
    expect(received.at(-1)).toMatchObject({ frame: 8, presentation: { generation: 9, revision: 4, frame: 8 } });
    expect(session.snapshot().interactive.quiz).toBe(next);
    expect(fixture.getSnapshot).not.toHaveBeenCalled();
    expect(fixture.subscribe).not.toHaveBeenCalled();
    session.dispose();
  });

  it("suppresses absent, pending, undeclared, hidden, stale-frame and stale-generation actions", async () => {
    const fixture = interactiveFixture();
    const { player } = recordingPlayer();
    let presentation = shown({ root: acceptedScene("default") });
    player.getPresentation = () => presentation;
    const session = present(player, sequence([{ id: "quiz", content: fixture.child }]), { mode: "manual", size, fps: 10 });
    await session.ready;
    const listener = vi.fn();
    session.on("action", listener);
    const send = (action = "accept", nodeId = "answer", frame = 0) => fixture.callbacks[0]!({ action, nodeId, frame });
    send("undeclared"); send("accept", "absent"); send("accept", "answer", 4);
    presentation = { ...presentation, isPending: true }; send();
    Reflect.set(presentation, "isPending", undefined); send();
    presentation = { ...presentation, isPending: false, accepted: null }; send();
    presentation = shown({}); send();
    presentation = shown({ root: acceptedScene("default", ["accept"], false) }); send();
    presentation = shown({ root: { sceneId: "default", nodes: [null] } }); send();
    presentation = shown({ root: { sceneId: "default", nodes: [{ ...acceptedScene("default").nodes[0], opacity: 0 }] } }); send();
    presentation = shown({ root: { sceneId: "default", nodes: [
      { ...acceptedScene("default").nodes[0], parentId: "hidden-parent" },
      { id: "hidden-parent", actions: [], visible: false },
    ] } }); send();
    presentation = shown({ root: acceptedScene("default") }, 0, 1, 2); send();
    presentation = { ...shown({ root: acceptedScene("default") }), isReady: false }; send();
    presentation = { ...shown({ root: acceptedScene("default") }), disposed: true }; send();
    expect(listener).not.toHaveBeenCalled();
    session.dispose();
  });

  it("does not qualify actions or runtime snapshots without a presentation reader", async () => {
    const fixture = interactiveFixture();
    const { player } = recordingPlayer();
    const session = present(player, sequence([{ id: "quiz", content: fixture.child }]), { mode: "manual", size, fps: 10 });
    await session.ready;
    const listener = vi.fn();
    session.on("action", listener);
    fixture.callbacks[0]!({ action: "accept", nodeId: "answer", frame: 0 });
    expect(listener).not.toHaveBeenCalled();
    expect(session.snapshot().interactive).toEqual({});
    session.dispose();
  });

  it("only exposes the active timeline occurrence even if accepted sidecars retain inactive values", async () => {
    const first = interactiveFixture();
    const second = interactiveFixture();
    const { player } = recordingPlayer();
    let presentation = shown({ first: acceptedScene("first"), second: acceptedScene("second") });
    player.getPresentation = () => presentation;
    const session = present(player, sequence([{ id: "first", content: first.child }, { id: "second", content: second.child }]), { mode: "timeline", size, fps: 10 });
    await session.ready;
    const listener = vi.fn();
    session.on("action", listener);
    expect(session.snapshot().interactive).toEqual({ first: acceptedScene("first") });
    second.callbacks[0]!({ action: "accept", nodeId: "answer", frame: 0 });
    presentation = shown(presentation.accepted!.semantic! as Record<string, unknown>, 1, 2);
    expect(session.snapshot().interactive).toEqual({ second: acceptedScene("second") });
    first.callbacks[0]!({ action: "accept", nodeId: "answer", frame: 1 });
    second.callbacks[0]!({ action: "accept", nodeId: "answer", frame: 1 });
    expect(listener).toHaveBeenCalledExactlyOnceWith({ path: "second", action: "accept", nodeId: "answer", frame: 1,
      presentation: { generation: 1, revision: 2, frame: 1, sceneId: "second" } });
    session.dispose();
  });

  it("qualifies simultaneous paths independently and rejects mismatched scene identities", async () => {
    const left = interactiveFixture();
    const right = interactiveFixture();
    const { player } = recordingPlayer();
    let presentation = shown({ left: acceptedScene("left", ["left-action"]), right: acceptedScene("right", ["right-action"]) });
    player.getPresentation = () => presentation;
    const session = present(player, together([
      { id: "left", content: left.child, fit: "reflow", rect: { x: 0, y: 0, width: 160, height: 180 } },
      { id: "right", content: right.child, fit: "reflow", rect: { x: 160, y: 0, width: 160, height: 180 } },
    ], { end: "hold" }), { mode: "timeline", size, fps: 10 });
    await session.ready;
    const listener = vi.fn(); session.on("action", listener);
    left.callbacks[0]!({ action: "right-action", nodeId: "answer", frame: 0 });
    right.callbacks[0]!({ action: "left-action", nodeId: "answer", frame: 0 });
    left.callbacks[0]!({ action: "left-action", nodeId: "answer", frame: 0 });
    right.callbacks[0]!({ action: "right-action", nodeId: "answer", frame: 0 });
    expect(listener.mock.calls.map(([event]) => [event.path, event.presentation.sceneId])).toEqual([["left", "left"], ["right", "right"]]);
    presentation = shown({ left: acceptedScene("right", ["left-action"]), right: acceptedScene("right", ["right-action"]) });
    left.callbacks[0]!({ action: "left-action", nodeId: "answer", frame: 0 });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(session.snapshot().interactive.left).toBeUndefined();
    session.dispose();
  });

  it("rebases nested manual semantics while retaining their rendered scene identity", async () => {
    const fixture = interactiveFixture();
    const { player } = recordingPlayer();
    player.getPresentation = () => shown({ slide: acceptedScene("slide") });
    const story = sequence([{ id: "lesson", content: sequence([{ id: "slide", content: fixture.child }]) }]);
    const session = present(player, story, { mode: "manual", size, fps: 10 });
    await session.ready;
    const listener = vi.fn(); session.on("action", listener);
    fixture.callbacks[0]!({ action: "accept", nodeId: "answer", frame: 0 });
    expect(listener).toHaveBeenCalledExactlyOnceWith({ path: "lesson/slide", action: "accept", nodeId: "answer", frame: 0,
      presentation: { generation: 1, revision: 1, frame: 0, sceneId: "slide" } });
    expect(session.snapshot().interactive).toEqual({ "lesson/slide": acceptedScene("slide") });
    session.dispose();
  });

  it("rejects held callbacks from the previous route and after disposal", async () => {
    const first = interactiveFixture(); const second = interactiveFixture();
    const { player } = recordingPlayer();
    let presentation = shown({ first: acceptedScene("first") });
    player.getPresentation = () => presentation;
    const session = present(player, sequence([{ id: "branch", content: choose({ first: first.child, second: second.child }) }]), { mode: "manual", size, fps: 10, routes: { branch: "first" } });
    await session.ready;
    const listener = vi.fn(); session.on("action", listener);
    const old = first.callbacks[0]!;
    presentation = shown({ second: acceptedScene("second") }, 0, 1, 2);
    await session.choose("branch", "second");
    old({ action: "accept", nodeId: "answer", frame: 0 });
    second.callbacks[0]!({ action: "accept", nodeId: "answer", frame: 0 });
    expect(listener).toHaveBeenCalledExactlyOnceWith({ path: "branch/second", action: "accept", nodeId: "answer", frame: 0,
      presentation: { generation: 2, revision: 1, frame: 0, sceneId: "second" } });
    session.dispose();
    second.callbacks[0]!({ action: "accept", nodeId: "answer", frame: 0 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(first.detached).toHaveBeenCalledOnce(); expect(second.detached).toHaveBeenCalledOnce();
    expect(session.snapshot().interactive).toEqual({});
  });
});

describe("Program operation state", () => {
  const success = { status: "success" as const, cues: [], totalFrames: 1, duration: 0.1, width: 320, height: 180, fps: 10 };
  const story = () => sequence(["a", "b", "c"].map(id => ({ id, content: clip(id) })));

  it("observes requested and committed selection separately and retains the last commit on failure", async () => {
    const { player } = recordingPlayer();
    const session = present(player, story(), { mode: "manual", size, fps: 10 });
    const states: ReturnType<typeof session.snapshot>[] = [];
    session.on("state", state => states.push(state));
    expect(session.snapshot()).toMatchObject({ currentId: null, currentIndex: -1, pending: { kind: "load", partId: "a" }, result: null });
    await session.ready;
    expect(states.at(-1)).toMatchObject({ currentId: "a", pending: null, result: { status: "success" } });
    let finish!: (result: Awaited<ReturnType<DomPlayer["load"]>>) => void;
    player.load = () => new Promise(resolve => { finish = resolve; });
    const requested = session.go("b");
    expect(session.snapshot()).toMatchObject({ currentId: "a", pending: { kind: "navigate", partId: "b" }, result: null });
    finish({ status: "error", errorType: "validation", message: "broken media", suggestion: "repair" });
    expect((await requested).status).toBe("error");
    expect(states.at(-1)).toMatchObject({ currentId: "a", currentIndex: 0, pending: null, result: { message: "broken media" } });
    session.dispose();
    expect(states.at(-1)).toMatchObject({ disposed: true, pending: null });
    expect(() => session.on("state", () => undefined)).toThrow("disposed");
  });

  it("advances from the requested part and ignores stale settlements", async () => {
    const { player } = recordingPlayer();
    const session = present(player, story(), { mode: "manual", size, fps: 10 });
    await session.ready;
    const finishes: Array<(result: Awaited<ReturnType<DomPlayer["load"]>>) => void> = [];
    player.load = () => new Promise(resolve => finishes.push(resolve));
    const first = session.next();
    const latest = session.next();
    expect(session.snapshot().pending?.partId).toBe("c");
    finishes[1]!(success);
    await latest;
    const committed = session.snapshot();
    finishes[0]!(success);
    expect(await first).toMatchObject({ status: "error", details: { code: "PLAYER_LOAD_SUPERSEDED" } });
    expect(session.snapshot()).toEqual(committed);
    session.dispose();
  });

  it("disposes pending selection without disposing the caller's player or accepting a late result", async () => {
    const { player } = recordingPlayer();
    player.dispose = vi.fn();
    const session = present(player, story(), { mode: "manual", size, fps: 10 });
    await session.ready;
    let finish!: (result: Awaited<ReturnType<DomPlayer["load"]>>) => void;
    player.load = () => new Promise(resolve => { finish = resolve; });
    const states: ReturnType<typeof session.snapshot>[] = [];
    session.on("state", state => states.push(state));
    const requested = session.go("b");
    session.dispose();
    const last = states.at(-1);
    expect(last).toMatchObject({ disposed: true, currentId: "a", pending: null, result: { details: { code: "PLAYER_LOAD_SUPERSEDED" } } });
    finish(success);
    await requested;
    expect(states.at(-1)).toBe(last);
    expect(player.dispose).not.toHaveBeenCalled();
  });

  it.each(["manual", "timeline"] as const)("observes %s route failure and keeps committed routes", async mode => {
    const { player } = recordingPlayer();
    const session = present(player, sequence([{ id: "branch", content: choose({ a: clip("a"), b: clip("b") }) }]), { mode, size, fps: 10, routes: { branch: "a" } });
    await session.ready;
    const states: ReturnType<typeof session.snapshot>[] = [];
    session.on("state", state => states.push(state));
    player.load = async () => { throw new Error("cannot load route"); };
    const chosen = session.choose("branch", "b");
    expect(session.snapshot()).toMatchObject({ routes: { branch: "a" }, pending: { kind: "route", routes: { branch: "b" } } });
    expect(await chosen).toMatchObject({ status: "error", message: "cannot load route" });
    expect(states.at(-1)).toMatchObject({ routes: { branch: "a" }, pending: null, result: { status: "error" } });
    session.dispose();
  });

  it("waits for initial setup before an early navigation and reports initial errors as load results", async () => {
    const { player } = recordingPlayer();
    let finish!: (result: Awaited<ReturnType<DomPlayer["load"]>>) => void;
    const load = player.load;
    player.load = () => new Promise(resolve => { finish = resolve; });
    const session = present(player, story(), { mode: "manual", size, fps: 10 });
    const next = session.go("b");
    player.load = load;
    finish(success);
    await next;
    expect(session.snapshot()).toMatchObject({ currentId: "b", pending: null });
    session.dispose();
    player.load = async () => { throw new Error("initial failure"); };
    const failed = present(player, story(), { mode: "timeline", size, fps: 10 });
    expect(await failed.ready).toMatchObject({ status: "error", message: "initial failure" });
    expect(failed.snapshot()).toMatchObject({ currentId: null, currentIndex: -1, pending: null, result: { status: "error" } });
    failed.dispose();
  });
});
