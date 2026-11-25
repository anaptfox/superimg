import { StrictMode, createElement } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoadResult, PlayerInput } from "@superimg/player";
import { Html } from "@superimg/stdlib/tree";

interface MockPlayerInstance {
  container: HTMLElement;
  iframe: HTMLIFrameElement;
  load: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  size: { width: number; height: number };
  currentFrame: number;
  isPlaying: boolean;
}

const playerHarness = vi.hoisted(() => ({
  instances: [] as MockPlayerInstance[],
  loadPromises: [] as Promise<unknown>[],
  updatePromises: [] as Promise<unknown>[],
}));

vi.mock("@superimg/player", () => ({
  Player: class MockCorePlayer {
    container: HTMLElement;
    iframe = document.createElement("iframe");
    isReady = false;
    isPlaying = false;
    currentFrame = 0;
    totalFrames = 1;
    size: { width: number; height: number };

    load = vi.fn(async () => {
      const pending = playerHarness.loadPromises.shift();
      if (!pending) throw new Error("Missing mock load promise");
      const result = (await pending) as LoadResult;

      // Reproduce CorePlayer's lifecycle race: the session mounts after an
      // earlier dispose() ran while load() was still awaiting setup.
      this.container.appendChild(this.iframe);
      this.isReady = result.status === "success";
      return result;
    });

    dispose = vi.fn(() => {
      this.isReady = false;
      this.iframe.remove();
    });

    listeners = new Map<string, (error: unknown) => void>();
    on = vi.fn((event: string, listener: (error: unknown) => void) => {
      this.listeners.set(event, listener);
      return () => this.listeners.delete(event);
    });
    store = {};
    update = vi.fn(async (patch: { size?: { width: number; height: number } }) => {
      try {
        await playerHarness.updatePromises.shift();
      } catch (error) {
        // CorePlayer forwards MediaSession's error event before rejecting.
        if (this.isReady) this.listeners.get("error")?.(error);
        throw error;
      }
      if (patch.size) this.size = patch.size;
    });
    play = vi.fn();
    pause = vi.fn();
    seek = vi.fn();

    constructor(options: { container: HTMLElement; size?: { width: number; height: number } }) {
      this.container = options.container;
      this.size = options.size ?? { width: 320, height: 180 };
      playerHarness.instances.push(this);
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
  reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((next, fail) => {
    resolve = next;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const success: LoadResult = {
  status: "success",
  totalFrames: 1,
  duration: 1,
  width: 320,
  height: 180,
  fps: 1,
};

function template(label: string): PlayerInput {
  return {
    config: { width: 320, height: 180 },
    render: () => Html({ width: "fill", height: "fill", html: `<div>${label}</div>` }),
  } as unknown as PlayerInput;
}

describe("React Player eager lifecycle", () => {
  beforeEach(() => {
    playerHarness.instances.length = 0;
    playerHarness.loadPromises.length = 0;
    playerHarness.updatePromises.length = 0;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("does not start the canceled StrictMode probe load", async () => {
    const activeLoad = deferred<LoadResult>();
    playerHarness.loadPromises.push(activeLoad.promise);

    render(
      createElement(
        StrictMode,
        null,
        createElement(Player, { media: template("strict") }),
      ),
    );

    await waitFor(() => {
      expect(playerHarness.instances).toHaveLength(2);
      expect(playerHarness.instances[1]?.load).toHaveBeenCalledTimes(1);
    });

    const probe = playerHarness.instances[0]!;
    expect(probe.dispose).toHaveBeenCalledTimes(1);
    expect(probe.load).not.toHaveBeenCalled();
    expect(probe.iframe.isConnected).toBe(false);

    await act(async () => {
      activeLoad.resolve(success);
      await activeLoad.promise;
    });
  });

  it("re-disposes a canceled load that mounts after its cleanup", async () => {
    const canceledLoad = deferred<LoadResult>();
    const activeLoad = deferred<LoadResult>();
    playerHarness.loadPromises.push(canceledLoad.promise, activeLoad.promise);

    const view = render(createElement(Player, { media: template("first") }));

    await waitFor(() => {
      expect(playerHarness.instances[0]?.load).toHaveBeenCalledTimes(1);
    });

    view.rerender(createElement(Player, { media: template("second") }));

    await waitFor(() => {
      expect(playerHarness.instances).toHaveLength(2);
      expect(playerHarness.instances[1]?.load).toHaveBeenCalledTimes(1);
    });

    const canceled = playerHarness.instances[0]!;
    const active = playerHarness.instances[1]!;
    expect(canceled.dispose).toHaveBeenCalledTimes(1);

    await act(async () => {
      activeLoad.resolve(success);
      await activeLoad.promise;
    });
    await waitFor(() => expect(active.iframe.isConnected).toBe(true));

    await act(async () => {
      canceledLoad.resolve(success);
      await canceledLoad.promise;
    });

    await waitFor(() => {
      expect(canceled.dispose).toHaveBeenCalledTimes(2);
      expect(canceled.iframe.isConnected).toBe(false);
    });
    expect(Array.from(view.container.querySelectorAll("iframe"))).toEqual([
      active.iframe,
    ]);
  });

  it("keeps the mounted player for fresh objects with equal size values", async () => {
    playerHarness.loadPromises.push(Promise.resolve(success));
    const media = template("same size");
    const view = render(createElement(Player, { media, size: { width: 320, height: 180 } }));
    await waitFor(() => expect(view.container.querySelectorAll("iframe")).toHaveLength(1));
    const active = playerHarness.instances[0]!;

    for (let i = 0; i < 3; i++) {
      view.rerender(createElement(Player, { media, size: { width: 320, height: 180 } }));
    }

    expect(playerHarness.instances).toHaveLength(1);
    expect(active.load).toHaveBeenCalledTimes(1);
    expect(active.dispose).not.toHaveBeenCalled();
    expect(active.update).not.toHaveBeenCalled();
    expect(view.container.querySelector("iframe")).toBe(active.iframe);
  });

  it("accepts the latest dimensions changed while loading without replacing the player", async () => {
    const load = deferred<LoadResult>();
    playerHarness.loadPromises.push(load.promise);
    const media = template("pending size");
    const view = render(createElement(Player, { media, size: { width: 320, height: 180 } }));
    await waitFor(() => expect(playerHarness.instances[0]!.load).toHaveBeenCalledTimes(1));
    const active = playerHarness.instances[0]!;
    view.rerender(createElement(Player, { media, size: { width: 640, height: 360 } }));
    view.rerender(createElement(Player, { media, size: { width: 800, height: 450 } }));
    expect(active.update).not.toHaveBeenCalled();

    await act(async () => { load.resolve(success); await load.promise; });

    expect(active.size).toEqual({ width: 800, height: 450 });
    expect(active.update).toHaveBeenCalledTimes(1);
    expect(playerHarness.instances).toHaveLength(1);
    expect(view.container.querySelector("iframe")).toBe(active.iframe);
  });

  it("resizes the same iframe without resetting playback and drains the newest pending size", async () => {
    playerHarness.loadPromises.push(Promise.resolve(success));
    const media = template("resize");
    const view = render(createElement(Player, { media, size: { width: 320, height: 180 } }));
    await waitFor(() => expect(view.container.querySelectorAll("iframe")).toHaveLength(1));
    const active = playerHarness.instances[0]!;
    active.currentFrame = 17;
    active.isPlaying = true;
    const update = deferred<void>();
    playerHarness.updatePromises.push(update.promise);

    view.rerender(createElement(Player, { media, size: { width: 640, height: 360 } }));
    view.rerender(createElement(Player, { media, size: { width: 800, height: 450 } }));
    expect(active.update).toHaveBeenCalledTimes(1);
    expect(active.size).toEqual({ width: 320, height: 180 });
    await act(async () => { update.resolve(); await update.promise; });

    expect(active.size).toEqual({ width: 800, height: 450 });
    expect(active.update).toHaveBeenCalledTimes(2);
    expect(active.currentFrame).toBe(17);
    expect(active.isPlaying).toBe(true);
    expect(active.dispose).not.toHaveBeenCalled();
    expect(active.load).toHaveBeenCalledTimes(1);
    expect(view.container.querySelector("iframe")).toBe(active.iframe);
  });

  it("reconciles size changed before lazy visibility and while its load is pending", async () => {
    let show!: () => void;
    const disconnect = vi.fn();
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback) {
        show = () => callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
      observe = vi.fn();
      disconnect = disconnect;
    });
    const load = deferred<LoadResult>();
    playerHarness.loadPromises.push(load.promise);
    const media = template("lazy");
    const view = render(createElement(Player, { media, loadMode: "lazy", size: { width: 320, height: 180 } }));
    const active = playerHarness.instances[0]!;
    view.rerender(createElement(Player, { media, loadMode: "lazy", size: { width: 640, height: 360 } }));
    expect(active.load).not.toHaveBeenCalled();
    act(() => show());
    view.rerender(createElement(Player, { media, loadMode: "lazy", size: { width: 800, height: 450 } }));
    await act(async () => { load.resolve(success); await load.promise; });

    expect(active.size).toEqual({ width: 800, height: 450 });
    expect(active.update).toHaveBeenCalledTimes(1);
    expect(active.load).toHaveBeenCalledTimes(1);
    expect(playerHarness.instances).toHaveLength(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(active.dispose).toHaveBeenCalledTimes(1);
    expect(active.iframe.isConnected).toBe(false);
    expect(disconnect).toHaveBeenCalledTimes(2);
  });

  it("reloads only when switching between explicit and authored size modes", async () => {
    playerHarness.loadPromises.push(Promise.resolve(success), Promise.resolve(success), Promise.resolve(success));
    const media = template("size modes");
    const view = render(createElement(Player, { media, size: { width: 640, height: 360 } }));
    await waitFor(() => expect(playerHarness.instances[0]?.iframe.isConnected).toBe(true));
    view.rerender(createElement(Player, { media }));
    await waitFor(() => expect(playerHarness.instances[1]?.iframe.isConnected).toBe(true));
    expect(playerHarness.instances[1]!.size).toEqual({ width: 320, height: 180 });
    view.rerender(createElement(Player, { media, size: { width: 800, height: 450 } }));
    await waitFor(() => expect(playerHarness.instances[2]?.iframe.isConnected).toBe(true));

    expect(playerHarness.instances).toHaveLength(3);
    expect(playerHarness.instances.map((player) => player.load.mock.calls.length)).toEqual([1, 1, 1]);
    expect(playerHarness.instances.map((player) => player.dispose.mock.calls.length)).toEqual([1, 1, 0]);
    expect(playerHarness.instances.map((player) => player.update.mock.calls.length)).toEqual([0, 0, 0]);
    expect(view.container.querySelectorAll("iframe")).toHaveLength(1);
  });

  it("reports a rejected resize once, retains the accepted size, and accepts a later resize", async () => {
    playerHarness.loadPromises.push(Promise.resolve(success));
    const media = template("failed resize");
    const onError = vi.fn();
    const view = render(createElement(Player, { media, onError, size: { width: 320, height: 180 } }));
    await waitFor(() => expect(view.container.querySelectorAll("iframe")).toHaveLength(1));
    const active = playerHarness.instances[0]!;
    const update = deferred<void>();
    playerHarness.updatePromises.push(update.promise);
    view.rerender(createElement(Player, { media, onError, size: { width: 640, height: 360 } }));
    const error = new Error("Rejected frame");
    await act(async () => { update.reject(error); await update.promise.catch(() => undefined); });
    expect(onError).toHaveBeenCalledExactlyOnceWith(error);
    expect(active.size).toEqual({ width: 320, height: 180 });
    view.rerender(createElement(Player, { media, onError, size: { width: 640, height: 360 } }));
    expect(active.update).toHaveBeenCalledTimes(1);
    view.rerender(createElement(Player, { media, onError, size: { width: 800, height: 450 } }));
    await waitFor(() => expect(active.size).toEqual({ width: 800, height: 450 }));
    expect(active.update).toHaveBeenCalledTimes(2);
    expect(active.dispose).not.toHaveBeenCalled();
    expect(playerHarness.instances).toHaveLength(1);
  });

  it.each(["fps", "duration", "width", "height"] as const)("reports an invalid NaN %s once without retrying the rejected snapshot", async (field) => {
    playerHarness.loadPromises.push(Promise.resolve(success));
    const media = template("invalid numeric override");
    const onError = vi.fn(() => {
      // Bound the failing implementation: a repeated rejection must fail this
      // test rather than spinning forever in the player's microtask queue.
      if (onError.mock.calls.length === 2) view.unmount();
    });
    const valid = { media, onError, fps: 30, duration: 1, size: { width: 320, height: 180 } };
    const invalid = {
      ...valid,
      ...(field === "fps" ? { fps: Number.NaN }
        : field === "duration" ? { duration: Number.NaN }
          : { size: { ...valid.size, [field]: Number.NaN } }),
    };
    const view = render(createElement(Player, valid));
    await waitFor(() => expect(view.container.querySelectorAll("iframe")).toHaveLength(1));
    const active = playerHarness.instances[0]!;
    const acceptUpdate = active.update.getMockImplementation()!;
    active.update.mockClear();
    const error = new Error("Invalid numeric override");
    active.update.mockRejectedValue(error);

    await act(async () => {
      view.rerender(createElement(Player, invalid));
    });

    expect(active.update).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledExactlyOnceWith(error);
    expect(active.dispose).not.toHaveBeenCalled();
    expect(active.size).toEqual({ width: 320, height: 180 });
    await act(async () => {
      view.rerender(createElement(Player, { ...invalid, size: { ...invalid.size } }));
    });
    expect(active.update).toHaveBeenCalledTimes(1);
    active.update.mockImplementation(acceptUpdate);
    await act(async () => { view.rerender(createElement(Player, valid)); });
    expect(active.update).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("does not resize an obsolete load or let it notify the replacement", async () => {
    const oldLoad = deferred<LoadResult>();
    const newLoad = deferred<LoadResult>();
    playerHarness.loadPromises.push(oldLoad.promise, newLoad.promise);
    const media = template("old");
    const onLoad = vi.fn();
    const view = render(createElement(Player, { media, onLoad, size: { width: 320, height: 180 } }));
    await waitFor(() => expect(playerHarness.instances[0]?.load).toHaveBeenCalledTimes(1));
    view.rerender(createElement(Player, { media, onLoad, size: { width: 640, height: 360 } }));
    const replacement = template("new");
    view.rerender(createElement(Player, { media: replacement, onLoad, size: { width: 800, height: 450 } }));
    await waitFor(() => expect(playerHarness.instances[1]?.load).toHaveBeenCalledTimes(1));
    await act(async () => { newLoad.resolve(success); await newLoad.promise; });
    await act(async () => { oldLoad.resolve(success); await oldLoad.promise; });

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(playerHarness.instances[0]!.update).not.toHaveBeenCalled();
    expect(playerHarness.instances[0]!.iframe.isConnected).toBe(false);
    expect(playerHarness.instances[1]!.size).toEqual({ width: 800, height: 450 });
    expect(view.container.querySelectorAll("iframe")).toHaveLength(1);
  });

  it("discards pending size work after a StrictMode mount is unmounted", async () => {
    playerHarness.loadPromises.push(Promise.resolve(success));
    const media = template("strict resize");
    const onError = vi.fn();
    const child = (width: number) => createElement(StrictMode, null, createElement(Player, { media, onError, size: { width, height: 180 } }));
    const view = render(child(320));
    await waitFor(() => expect(view.container.querySelectorAll("iframe")).toHaveLength(1));
    const active = playerHarness.instances[1]!;
    const update = deferred<void>();
    playerHarness.updatePromises.push(update.promise);
    view.rerender(child(640));
    view.rerender(child(800));
    view.unmount();
    await act(async () => { update.reject(new Error("Disposed")); await update.promise.catch(() => undefined); });

    expect(playerHarness.instances).toHaveLength(2);
    expect(playerHarness.instances[0]!.load).not.toHaveBeenCalled();
    expect(active.load).toHaveBeenCalledTimes(1);
    expect(active.update).toHaveBeenCalledTimes(1);
    expect(active.dispose).toHaveBeenCalledTimes(1);
    expect(active.iframe.isConnected).toBe(false);
    expect(onError).not.toHaveBeenCalled();
  });

  it("applies simultaneous data and size changes as one transactional update", async () => {
    playerHarness.loadPromises.push(Promise.resolve(success));
    const media = template("combined props");
    const view = render(createElement(Player, { media, data: { label: "before" }, size: { width: 320, height: 180 } }));
    await waitFor(() => expect(view.container.querySelectorAll("iframe")).toHaveLength(1));
    const active = playerHarness.instances[0]!;
    view.rerender(createElement(Player, { media, data: { label: "after" }, size: { width: 640, height: 360 } }));
    await waitFor(() => expect(active.size).toEqual({ width: 640, height: 360 }));

    expect(active.update).toHaveBeenCalledExactlyOnceWith({ data: { label: "after" }, size: { width: 640, height: 360 } });
    expect(active.dispose).not.toHaveBeenCalled();
  });
});
