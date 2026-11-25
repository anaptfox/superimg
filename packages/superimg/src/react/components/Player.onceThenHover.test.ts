/**
 * Strict coverage for onceThenHover + hover rest-frame contracts.
 * Uses a controllable CorePlayer mock (event bus + playbackMode).
 */
import { createElement } from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoadResult, PlayerInput } from "@superimg/player";
import { Html } from "@superimg/stdlib/tree";

type Handler = (...args: unknown[]) => void;

interface MockCore {
  container: HTMLElement;
  playbackMode: string;
  isReady: boolean;
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;
  listeners: Map<string, Set<Handler>>;
  load: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  seek: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  emit: (event: string) => void;
  store: object;
  update: ReturnType<typeof vi.fn>;
}

const harness = vi.hoisted(() => ({
  instances: [] as MockCore[],
  loadPromises: [] as Promise<unknown>[],
}));

vi.mock("@superimg/player", () => ({
  Player: class MockCorePlayer {
    container: HTMLElement;
    playbackMode = "once";
    isReady = false;
    isPlaying = false;
    currentFrame = 0;
    totalFrames = 30;
    listeners = new Map<string, Set<Handler>>();

    load = vi.fn(async () => {
      const pending = harness.loadPromises.shift();
      if (!pending) throw new Error("Missing mock load promise");
      const result = (await pending) as LoadResult;
      this.isReady = result.status === "success";
      this.totalFrames = result.status === "success" ? result.totalFrames : 1;
      return result;
    });

    dispose = vi.fn(() => {
      this.isReady = false;
      this.isPlaying = false;
    });

    on = vi.fn((event: string, cb: Handler) => {
      if (!this.listeners.has(event)) this.listeners.set(event, new Set());
      this.listeners.get(event)!.add(cb);
      return () => this.listeners.get(event)?.delete(cb);
    });

    emit(event: string) {
      for (const cb of this.listeners.get(event) ?? []) cb();
    }

    store = {};
    update = vi.fn();

    play = vi.fn(() => {
      // Runtime contract: play from last frame restarts at 0
      if (this.currentFrame >= this.totalFrames - 1) {
        this.currentFrame = 0;
      }
      this.isPlaying = true;
      this.emit("play");
    });

    pause = vi.fn(() => {
      this.isPlaying = false;
      this.emit("pause");
    });

    seek = vi.fn((to: { frame?: number }) => {
      if (typeof to.frame === "number") this.currentFrame = to.frame;
    });

    constructor(options: {
      container: HTMLElement;
      playbackMode?: string;
    }) {
      this.container = options.container;
      this.playbackMode = options.playbackMode ?? "once";
      harness.instances.push(this as unknown as MockCore);
    }
  },
}));

vi.mock("./PlayerDynamicLayers.js", () => ({
  DynamicCompileLayer: () => null,
}));

vi.mock("./VideoControls.js", () => ({
  VideoControls: () => null,
}));

import { Player } from "./Player.js";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

const success: LoadResult = {
  status: "success",
  totalFrames: 30,
  duration: 1,
  width: 320,
  height: 180,
  fps: 30,
};

function template(): PlayerInput {
  return {
    config: { width: 320, height: 180, fps: 30, duration: 1 },
    render: () => Html({ width: "fill", height: "fill", html: "<div>clip</div>" }),
  } as unknown as PlayerInput;
}

async function mountOnceThenHover(opts?: {
  autoPlay?: boolean;
}) {
  const load = deferred<LoadResult>();
  harness.loadPromises.push(load.promise);

  const view = render(
    createElement(Player, {
      media: template(),
      onceThenHover: true,
      autoPlay: opts?.autoPlay ?? true,
      hoverDelayMs: 0,
    }),
  );

  await waitFor(() => {
    expect(harness.instances.length).toBeGreaterThanOrEqual(1);
    expect(harness.instances.at(-1)?.load).toHaveBeenCalled();
  });

  const core = harness.instances.at(-1)!;

  await act(async () => {
    load.resolve(success);
    await load.promise;
  });

  await waitFor(() => {
    expect(core.isReady).toBe(true);
  });

  // Root node that owns hover handlers (outer Player box)
  const root = view.container.firstElementChild as HTMLElement;
  expect(root).toBeTruthy();

  return { view, core, root };
}

/** Simulate first full play finishing (session emits ended). */
function finishFirstPlay(core: MockCore) {
  core.currentFrame = core.totalFrames - 1;
  core.isPlaying = true;
  act(() => {
    core.emit("ended");
  });
}

describe("React Player onceThenHover (strict)", () => {
  beforeEach(() => {
    harness.instances.length = 0;
    harness.loadPromises.length = 0;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("constructs CorePlayer with playbackMode once (never loop)", async () => {
    const { core } = await mountOnceThenHover();
    expect(core.playbackMode).toBe("once");
    // SuperImg re-pins after load
    expect(core.playbackMode).not.toBe("loop");
  });

  it("autoPlays after load", async () => {
    const { core } = await mountOnceThenHover({ autoPlay: true });
    expect(core.play).toHaveBeenCalled();
  });

  it("after first ended: seeks frame 0, pauses, does not immediately replay", async () => {
    const { core } = await mountOnceThenHover();
    core.play.mockClear();
    core.pause.mockClear();
    core.seek.mockClear();

    finishFirstPlay(core);

    expect(core.pause).toHaveBeenCalled();
    expect(core.seek).toHaveBeenCalledWith({ frame: 0 });
    // Must not auto-restart (that caused infinite loop while pointer was over)
    expect(core.play).not.toHaveBeenCalled();
    expect(core.currentFrame).toBe(0);
  });

  it("does not pause when pointer leaves during the first once-play", async () => {
    const { core, root } = await mountOnceThenHover();
    core.pause.mockClear();

    // Still in intro (no ended yet)
    act(() => {
      fireEvent.mouseLeave(root);
    });

    expect(core.pause).not.toHaveBeenCalled();
  });

  it("ignores hover enter during first once-play", async () => {
    const { core, root } = await mountOnceThenHover();
    core.play.mockClear();

    act(() => {
      fireEvent.mouseEnter(root);
      vi.runAllTimers();
    });

    expect(core.play).not.toHaveBeenCalled();
  });

  it("after first play: hover enter plays (loop arm)", async () => {
    const { core, root } = await mountOnceThenHover();
    finishFirstPlay(core);
    core.play.mockClear();
    core.seek.mockClear();

    act(() => {
      fireEvent.mouseEnter(root);
      vi.runAllTimers();
    });

    expect(core.play).toHaveBeenCalledTimes(1);
  });

  it("after first play: hover leave pauses and seeks frame 0", async () => {
    const { core, root } = await mountOnceThenHover();
    finishFirstPlay(core);

    act(() => {
      fireEvent.mouseEnter(root);
      vi.runAllTimers();
    });
    core.pause.mockClear();
    core.seek.mockClear();

    act(() => {
      fireEvent.mouseLeave(root);
    });

    expect(core.pause).toHaveBeenCalledTimes(1);
    expect(core.seek).toHaveBeenCalledWith({ frame: 0 });
  });

  it("while hovering after first play: ended restarts (manual loop)", async () => {
    const { core, root } = await mountOnceThenHover();
    finishFirstPlay(core);

    act(() => {
      fireEvent.mouseEnter(root);
      vi.runAllTimers();
    });
    core.play.mockClear();
    core.seek.mockClear();

    // Simulate end of a hover loop cycle
    core.currentFrame = core.totalFrames - 1;
    act(() => {
      core.emit("ended");
    });

    expect(core.seek).toHaveBeenCalledWith({ frame: 0 });
    expect(core.play).toHaveBeenCalled();
  });

  it("after first play ends while pointer was over: does not auto-loop without re-enter", async () => {
    const { core, root } = await mountOnceThenHover();

    // Pointer enters during intro — must not arm hovering for auto-restart
    act(() => {
      fireEvent.mouseEnter(root);
      vi.runAllTimers();
    });
    core.play.mockClear();

    finishFirstPlay(core);

    // No immediate restart even though mouseenter fired during intro
    expect(core.play).not.toHaveBeenCalled();

    // Need a fresh enter after firstPlayDone
    act(() => {
      fireEvent.mouseLeave(root);
      fireEvent.mouseEnter(root);
      vi.runAllTimers();
    });
    expect(core.play).toHaveBeenCalled();
  });
});

describe("React Player hoverResetBehavior", () => {
  beforeEach(() => {
    harness.instances.length = 0;
    harness.loadPromises.length = 0;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("default pause: hover leave does not seek frame 0", async () => {
    const load = deferred<LoadResult>();
    harness.loadPromises.push(load.promise);

    const view = render(
      createElement(Player, {
        media: template(),
        hoverBehavior: "play",
        hoverDelayMs: 0,
        // default hoverResetBehavior is pause
      }),
    );

    await waitFor(() => expect(harness.instances[0]?.load).toHaveBeenCalled());
    const core = harness.instances[0]!;
    await act(async () => {
      load.resolve(success);
      await load.promise;
    });
    await waitFor(() => expect(core.isReady).toBe(true));

    const root = view.container.firstElementChild as HTMLElement;
    act(() => {
      fireEvent.mouseEnter(root);
      vi.runAllTimers();
    });
    core.seek.mockClear();
    core.pause.mockClear();

    act(() => {
      fireEvent.mouseLeave(root);
    });

    expect(core.pause).toHaveBeenCalled();
    expect(core.seek).not.toHaveBeenCalled();
  });

  it("reset: hover leave seeks frame 0", async () => {
    const load = deferred<LoadResult>();
    harness.loadPromises.push(load.promise);

    const view = render(
      createElement(Player, {
        media: template(),
        hoverBehavior: "play",
        hoverDelayMs: 0,
        hoverResetBehavior: "reset",
      }),
    );

    await waitFor(() => expect(harness.instances[0]?.load).toHaveBeenCalled());
    const core = harness.instances[0]!;
    await act(async () => {
      load.resolve(success);
      await load.promise;
    });
    await waitFor(() => expect(core.isReady).toBe(true));

    const root = view.container.firstElementChild as HTMLElement;
    act(() => {
      fireEvent.mouseEnter(root);
      vi.runAllTimers();
    });
    core.seek.mockClear();

    act(() => {
      fireEvent.mouseLeave(root);
    });

    expect(core.seek).toHaveBeenCalledWith({ frame: 0 });
  });
});
