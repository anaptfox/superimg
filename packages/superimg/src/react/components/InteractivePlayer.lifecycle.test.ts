import { StrictMode, createElement, createRef } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoadOptions, LoadResult } from "@superimg/player";
import type { InteractiveDefinition } from "../../../../superimg-interactive/src/contracts.js";
import type { InteractivePlayerRef } from "../../../../superimg-interactive/src/InteractivePlayer.js";

type Data = { value: number };
type Listener = (...values: unknown[]) => void;

interface MockController {
  container: HTMLElement;
  iframe: HTMLIFrameElement;
  load: ReturnType<typeof vi.fn>;
  setData: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  staleListeners: Map<string, Listener[]>;
  acceptedData: Data | undefined;
}

const harness = vi.hoisted(() => ({
  instances: [] as MockController[],
  loads: [] as Promise<LoadResult>[],
  updates: [] as Promise<void>[],
}));

vi.mock("../../../../superimg-interactive/src/controller.js", () => ({
  createInteractivePlayer: (options: { container: HTMLElement }) => {
    const controller = {
      container: options.container,
      iframe: document.createElement("iframe"),
      isReady: false,
      acceptedData: undefined as Data | undefined,
      staleListeners: new Map<string, Listener[]>(),
      load: vi.fn(async (_media: unknown, input: { data: Data }) => {
        const result = await (harness.loads.shift() ?? Promise.resolve(success));
        // Model a late asynchronous mount after an earlier cleanup.
        controller.container.appendChild(controller.iframe);
        controller.isReady = result.status === "success";
        controller.acceptedData = input.data;
        return result;
      }),
      setData: vi.fn(async (data: Data) => {
        await (harness.updates.shift() ?? Promise.resolve());
        controller.acceptedData = data;
      }),
      update: vi.fn(async (update: { data?: Data; size?: { width: number; height: number }; sceneStyle?: string }) => {
        await (harness.updates.shift() ?? Promise.resolve());
        if (update.data) controller.acceptedData = update.data;
      }),
      dispose: vi.fn(() => {
        controller.isReady = false;
        controller.iframe.remove();
      }),
      on: (event: string, listener: Listener) => {
        const listeners = controller.staleListeners.get(event) ?? [];
        listeners.push(listener);
        controller.staleListeners.set(event, listeners);
        // Retain callbacks to model an event already queued at cleanup.
        return () => undefined;
      },
      guide: { goToStep: vi.fn(), next: vi.fn(), previous: vi.fn() },
      play: vi.fn(),
      pause: vi.fn(),
    };
    harness.instances.push(controller);
    return controller;
  },
}));

import { InteractivePlayer } from "../../../../superimg-interactive/src/InteractivePlayer.js";

const DataPlayer = InteractivePlayer<Data>;

const success: LoadResult = {
  status: "success",
  totalFrames: 1,
  duration: 1,
  width: 320,
  height: 180,
  fps: 1,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const media = { render: () => null } as unknown as InteractiveDefinition<Data>;

describe("InteractivePlayer React lifecycle", () => {
  beforeEach(() => {
    harness.instances.length = 0;
    harness.loads.length = 0;
    harness.updates.length = 0;
  });

  afterEach(() => cleanup());

  it("accepts the latest data received during load before notifying onLoad", async () => {
    const load = deferred<LoadResult>();
    const update = deferred<void>();
    harness.loads.push(load.promise);
    harness.updates.push(update.promise);
    const initial = { value: 0 };
    const latest = { value: 2 };
    const onLoad = vi.fn();
    const view = render(createElement(DataPlayer, { media, data: initial, onLoad }));
    view.rerender(createElement(DataPlayer, { media, data: { value: 1 }, onLoad }));
    view.rerender(createElement(DataPlayer, { media, data: latest, onLoad }));
    const controller = harness.instances[0]!;
    expect(controller.load.mock.calls[0]?.[1]).toMatchObject({ data: initial });
    expect(controller.setData).not.toHaveBeenCalled();

    await act(async () => { load.resolve(success); await load.promise; });
    await waitFor(() => expect(controller.setData).toHaveBeenCalledWith(latest));
    expect(onLoad).not.toHaveBeenCalled();
    await act(async () => { update.resolve(); await update.promise; });
    await waitFor(() => expect(onLoad).toHaveBeenCalledOnce());
    expect(controller.acceptedData).toBe(latest);
    expect(controller.setData).toHaveBeenCalledOnce();
  });

  it("notifies onLoad after its initialization boundary while later live updates keep arriving", async () => {
    const load = deferred<LoadResult>();
    const initialUpdate = deferred<void>();
    const nextUpdate = deferred<void>();
    const lastUpdate = deferred<void>();
    harness.loads.push(load.promise);
    harness.updates.push(initialUpdate.promise, nextUpdate.promise, lastUpdate.promise);
    const onLoad = vi.fn();
    const view = render(createElement(DataPlayer, { media, data: { value: 0 }, onLoad }));
    const atLoad = { value: 1 };
    view.rerender(createElement(DataPlayer, { media, data: atLoad, onLoad }));
    const controller = harness.instances[0]!;
    await act(async () => { load.resolve(success); await load.promise; });
    await waitFor(() => expect(controller.setData).toHaveBeenCalledWith(atLoad));
    view.rerender(createElement(DataPlayer, { media, data: { value: 2 }, onLoad }));
    expect(onLoad).not.toHaveBeenCalled();

    // The stream has already queued another replacement when initialization
    // accepts. onLoad must not require the live stream to become quiet.
    await act(async () => { initialUpdate.resolve(); await initialUpdate.promise; });
    await waitFor(() => expect(onLoad).toHaveBeenCalledOnce());
    expect(controller.acceptedData).toBe(atLoad);
    expect(controller.setData.mock.calls.map(([data]) => data)).toEqual([{ value: 1 }, { value: 2 }]);
    view.rerender(createElement(DataPlayer, { media, data: { value: 3 }, onLoad }));
    await act(async () => { nextUpdate.resolve(); await nextUpdate.promise; });
    await waitFor(() => expect(controller.setData).toHaveBeenCalledTimes(3));
    expect(controller.acceptedData).toEqual({ value: 2 });
    await act(async () => { lastUpdate.resolve(); await lastUpdate.promise; });
    expect(controller.acceptedData).toEqual({ value: 3 });
    expect(onLoad).toHaveBeenCalledOnce();
  });

  it("serializes ready prop updates and coalesces queued replacements", async () => {
    const first = deferred<void>();
    const last = deferred<void>();
    harness.updates.push(first.promise, last.promise);
    const onLoad = vi.fn();
    const view = render(createElement(DataPlayer, { media, data: { value: 0 }, onLoad }));
    await waitFor(() => expect(onLoad).toHaveBeenCalledOnce());
    const controller = harness.instances[0]!;
    view.rerender(createElement(DataPlayer, { media, data: { value: 1 }, onLoad }));
    view.rerender(createElement(DataPlayer, { media, data: { value: 2 }, onLoad }));
    view.rerender(createElement(DataPlayer, { media, data: { value: 3 }, onLoad }));
    expect(controller.setData.mock.calls.map(([data]) => data)).toEqual([{ value: 1 }]);

    await act(async () => { first.resolve(); await first.promise; });
    await waitFor(() => expect(controller.setData.mock.calls.map(([data]) => data))
      .toEqual([{ value: 1 }, { value: 3 }]));
    await act(async () => { last.resolve(); await last.promise; });
    expect(controller.acceptedData).toEqual({ value: 3 });
  });

  it("resolves each imperative update only after that requested record is accepted", async () => {
    const load = deferred<LoadResult>();
    const first = deferred<void>();
    const second = deferred<void>();
    harness.loads.push(load.promise);
    harness.updates.push(first.promise, second.promise);
    const ref = createRef<InteractivePlayerRef<Data>>();
    render(createElement(DataPlayer, { ref, media, data: { value: 0 } }));
    const accepted: number[] = [];
    const pendingFirst = ref.current!.setData({ value: 1 }).then(() => { accepted.push(1); });
    const pendingSecond = ref.current!.setData({ value: 2 }).then(() => { accepted.push(2); });
    const controller = harness.instances[0]!;
    expect(controller.setData).not.toHaveBeenCalled();
    await act(async () => { load.resolve(success); await load.promise; });
    await waitFor(() => expect(controller.setData).toHaveBeenCalledOnce());
    expect(accepted).toEqual([]);
    await act(async () => { first.resolve(); await pendingFirst; });
    expect(accepted).toEqual([1]);
    expect(controller.setData.mock.calls.map(([data]) => data)).toEqual([{ value: 1 }, { value: 2 }]);
    await act(async () => { second.resolve(); await pendingSecond; });
    expect(accepted).toEqual([1, 2]);
  });

  it("passes host resources and starts a fresh private mount when any resource identity changes", async () => {
    let assets: LoadOptions["assets"] = {};
    let assetResolver: LoadOptions["assetResolver"] = (file) => `/first/${file}`;
    let fonts: LoadOptions["fonts"] = { css: "" };
    const data = { value: 0 };
    const onLoad = vi.fn();
    const element = () => createElement(DataPlayer, { media, data, assets, assetResolver, fonts, onLoad });
    const view = render(element());
    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(1));
    expect(harness.instances[0]!.load.mock.calls[0]?.[1]).toMatchObject({ assets, assetResolver, fonts });

    assets = {};
    view.rerender(element());
    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(2));
    assetResolver = (file) => `/second/${file}`;
    view.rerender(element());
    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(3));
    fonts = { css: "body{font-family:Local}" };
    view.rerender(element());
    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(4));

    expect(harness.instances).toHaveLength(4);
    expect(harness.instances.slice(0, 3).every((controller) => controller.dispose.mock.calls.length === 1)).toBe(true);
    expect(Array.from(view.container.querySelectorAll("iframe"))).toEqual([harness.instances[3]!.iframe]);
    expect(harness.instances[3]!.load.mock.calls[0]?.[1]).toMatchObject({ assets, assetResolver, fonts });
  });

  it("isolates StrictMode's late mount and suppresses all callbacks from its canceled effect", async () => {
    const staleLoad = deferred<LoadResult>();
    const liveLoad = deferred<LoadResult>();
    harness.loads.push(staleLoad.promise, liveLoad.promise);
    const onLoad = vi.fn();
    const onError = vi.fn();
    const onAction = vi.fn();
    const onStepChange = vi.fn();
    const onSceneUpdate = vi.fn();
    const view = render(createElement(StrictMode, null, createElement(DataPlayer, {
      media, data: { value: 0 }, onLoad, onError, onAction, onStepChange, onSceneUpdate,
    })));
    expect(harness.instances).toHaveLength(2);
    const stale = harness.instances[0]!;
    const live = harness.instances[1]!;
    for (const listeners of stale.staleListeners.values()) {
      for (const listener of listeners) listener(new Error("stale"), 0);
    }
    expect(onError).not.toHaveBeenCalled();
    expect(onAction).not.toHaveBeenCalled();
    expect(onStepChange).not.toHaveBeenCalled();
    expect(onSceneUpdate).not.toHaveBeenCalled();
    await act(async () => { liveLoad.resolve(success); await liveLoad.promise; });
    await waitFor(() => expect(onLoad).toHaveBeenCalledOnce());
    await act(async () => { staleLoad.resolve(success); await staleLoad.promise; });
    await waitFor(() => expect(stale.dispose).toHaveBeenCalledTimes(2));
    expect(Array.from(view.container.querySelectorAll("iframe"))).toEqual([live.iframe]);
    expect(onLoad).toHaveBeenCalledOnce();
  });

  it("rejects an imperative update and suppresses late data errors when its mount is replaced", async () => {
    const update = deferred<void>();
    harness.updates.push(update.promise);
    const ref = createRef<InteractivePlayerRef<Data>>();
    const onLoad = vi.fn();
    const onError = vi.fn();
    const data = { value: 0 };
    const view = render(createElement(DataPlayer, { ref, media, data, onLoad, onError }));
    await waitFor(() => expect(onLoad).toHaveBeenCalledOnce());
    const pending = ref.current!.setData({ value: 1 });
    const rejected = expect(pending).rejects.toThrow(/superseded|disposed/i);
    view.rerender(createElement(DataPlayer, { ref, media, data, assets: {}, onLoad, onError }));
    await rejected;
    await act(async () => { update.reject(new Error("late data error")); });
    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(2));
    expect(onError).not.toHaveBeenCalled();
  });

  it("rejects queued and subsequent imperative updates after a failed load", async () => {
    const load = deferred<LoadResult>();
    harness.loads.push(load.promise);
    const ref = createRef<InteractivePlayerRef<Data>>();
    const onLoad = vi.fn();
    render(createElement(DataPlayer, { ref, media, data: { value: 0 }, onLoad }));
    const pending = ref.current!.setData({ value: 1 });
    const rejected = expect(pending).rejects.toThrow("load failed");
    await act(async () => {
      load.resolve({ status: "error", errorType: "validation", message: "invalid scene", suggestion: "Repair the definition" });
      await rejected;
    });
    await expect(ref.current!.setData({ value: 2 })).rejects.toThrow("invalid scene");
    expect(harness.instances[0]!.setData).not.toHaveBeenCalled();
    expect(onLoad).toHaveBeenCalledWith(expect.objectContaining({ status: "error" }));
  });
  it("accepts latest combined data/style/explicit size changed during load before onLoad", async () => {
    const load = deferred<LoadResult>();
    const update = deferred<void>();
    harness.loads.push(load.promise); harness.updates.push(update.promise);
    const onLoad = vi.fn();
    const view = render(createElement(DataPlayer, { media, data: { value: 0 }, size: { width: 320, height: 180 }, sceneStyle: "first", onLoad }));
    view.rerender(createElement(DataPlayer, { media, data: { value: 1 }, size: { width: 640, height: 360 }, sceneStyle: "second", onLoad }));
    view.rerender(createElement(DataPlayer, { media, data: { value: 2 }, size: { width: 800, height: 600 }, sceneStyle: "last", onLoad }));
    const controller = harness.instances[0]!;
    expect(harness.instances).toHaveLength(1);
    await act(async () => { load.resolve(success); await load.promise; });
    await waitFor(() => expect(controller.update).toHaveBeenCalledExactlyOnceWith({ data: { value: 2 }, size: { width: 800, height: 600 }, sceneStyle: "last" }));
    expect(onLoad).not.toHaveBeenCalled();
    await act(async () => { update.resolve(); await update.promise; });
    await waitFor(() => expect(onLoad).toHaveBeenCalledOnce());
    expect(controller.dispose).not.toHaveBeenCalled();
    expect(view.container.querySelector("iframe")).toBe(controller.iframe);
  });

  it("serializes hot replacements while each imperative record retains its acceptance promise", async () => {
    const first = deferred<void>(); const imperative = deferred<void>(); const last = deferred<void>();
    const onLoad = vi.fn(); const ref = createRef<InteractivePlayerRef<Data>>();
    const data = { value: 0 };
    const view = render(createElement(DataPlayer, { ref, media, data, size: { width: 320, height: 180 }, sceneStyle: "first", onLoad }));
    await waitFor(() => expect(onLoad).toHaveBeenCalledOnce());
    harness.updates.push(first.promise, imperative.promise, last.promise);
    view.rerender(createElement(DataPlayer, { ref, media, data, size: { width: 640, height: 360 }, sceneStyle: "second", onLoad }));
    const accepted: string[] = [];
    const request = ref.current!.setData({ value: 9 }).then(() => { accepted.push("imperative"); });
    view.rerender(createElement(DataPlayer, { ref, media, data, size: { width: 800, height: 600 }, sceneStyle: "third", onLoad }));
    view.rerender(createElement(DataPlayer, { ref, media, data, size: { width: 900, height: 600 }, sceneStyle: "last", onLoad }));
    const controller = harness.instances[0]!;
    expect(controller.update).toHaveBeenCalledOnce();
    expect(controller.setData).not.toHaveBeenCalled();
    await act(async () => { first.resolve(); await first.promise; });
    await waitFor(() => expect(controller.setData).toHaveBeenCalledExactlyOnceWith({ value: 9 }));
    expect(accepted).toEqual([]);
    await act(async () => { imperative.resolve(); await request; });
    expect(accepted).toEqual(["imperative"]);
    await waitFor(() => expect(controller.update).toHaveBeenCalledTimes(2));
    expect(controller.update.mock.calls[1]?.[0]).toEqual({ data, size: { width: 900, height: 600 }, sceneStyle: "last" });
    await act(async () => { last.resolve(); await last.promise; });
    expect(harness.instances).toHaveLength(1);
  });

  it("reports an emitted hot-update rejection once and can recover without remounting", async () => {
    const onLoad = vi.fn(); const onError = vi.fn(); const data = { value: 0 };
    const view = render(createElement(DataPlayer, { media, data, sceneStyle: "first", onLoad, onError }));
    await waitFor(() => expect(onLoad).toHaveBeenCalledOnce());
    const failure = deferred<void>(); harness.updates.push(failure.promise);
    view.rerender(createElement(DataPlayer, { media, data, sceneStyle: "bad", onLoad, onError }));
    const controller = harness.instances[0]!;
    const error = new Error("bad style");
    await act(async () => {
      controller.staleListeners.get("error")![0]!(error);
      failure.reject(error);
      await failure.promise.catch(() => undefined);
    });
    expect(onError).toHaveBeenCalledExactlyOnceWith(error);
    view.rerender(createElement(DataPlayer, { media, data, sceneStyle: "good", onLoad, onError }));
    await waitFor(() => expect(controller.update).toHaveBeenCalledTimes(2));
    expect(harness.instances).toHaveLength(1);
    expect(controller.dispose).not.toHaveBeenCalled();
  });

  it("keeps numeric dimensions hot but authored sizing and renderer identity structural", async () => {
    const onLoad = vi.fn(); const data = { value: 0 };
    const renderer = { id: "test-renderer", render: ({ html }: { html: string }) => html };
    const view = render(createElement(DataPlayer, { media, data, size: { width: 320, height: 180 }, sceneRenderer: renderer, onLoad }));
    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(1));
    view.rerender(createElement(DataPlayer, { media, data, size: { width: 640, height: 360 }, sceneRenderer: renderer, onLoad }));
    await waitFor(() => expect(harness.instances[0]!.update).toHaveBeenCalledOnce());
    view.rerender(createElement(DataPlayer, { media, data, sceneRenderer: renderer, onLoad }));
    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(2));
    view.rerender(createElement(DataPlayer, { media, data, sceneRenderer: { ...renderer }, onLoad }));
    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(3));
    expect(harness.instances).toHaveLength(3);
    expect(harness.instances.slice(0, 2).every(controller => controller.dispose.mock.calls.length === 1)).toBe(true);
  });

});
