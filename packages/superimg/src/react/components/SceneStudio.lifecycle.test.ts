import { createElement, useEffect, useImperativeHandle, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InteractivePlayerProps, InteractivePlayerRef } from "../../../../superimg-interactive/src/InteractivePlayer.js";
import type { SceneSnapshot } from "@foxworth/superimg/interactive/define";
import type { Artwork } from "../../../../../apps/scene-studio/src/kit/artwork.js";

const harness = vi.hoisted(() => ({
  use: vi.fn<(state: string) => Promise<void>>(),
  camera: vi.fn<() => Promise<void>>(),
  set: vi.fn<() => Promise<void>>(),
  props: null as InteractivePlayerProps<Record<string, unknown>> | null,
}));

// Native view-transition behavior has browser coverage; this test isolates app
// command ownership and accepted-state/error handling.
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  ViewTransition: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@foxworth/superimg/react/interactive", () => ({
  InteractivePlayer: (props: InteractivePlayerProps<Record<string, unknown>>) => {
    harness.props = props;
    useImperativeHandle(props.ref, () => ({
      controller: { scene: { use: harness.use, camera: harness.camera, set: harness.set } },
    }) as unknown as InteractivePlayerRef<Record<string, unknown>>, [props.sceneRenderer]);
    useEffect(() => {
      props.onLoad?.({ status: "success", totalFrames: 10, duration: 1, fps: 10, width: 100, height: 100 });
    }, []);
    return createElement("div", { "data-testid": "mock-live-art" });
  },
}));

import { ArtworkStudio } from "../../../../../apps/scene-studio/src/ArtworkStudio.js";

function snapshot(activeState = "first", role = "evidence"): SceneSnapshot {
  return { schemaVersion: 0, sceneId: "studio", activeState, rootIds: ["subject"],
    nodes: [{ id: "subject", parentId: null, childIds: [], kind: "subject", role, label: "Subject", state: null,
      tags: [], actions: [], space: "world", visible: true, opacity: 1, transform: {}, animation: null, properties: {}, metadata: {} }],
    states: {}, camera: { x: 0, y: 0, zoom: 1, rotation: 0, fit: null, follow: null } };
}

const artwork: Artwork = {
  id: "test", template: { sample: {} } as Artwork["template"],
  renderer: { id: "test", render: input => input.html },
  acts: ["first", "second", "third"].map(id => ({ id, numeral: id, label: id, note: id, focus: "subject" })),
  surfaces: [{ id: "ink", label: "Ink", swatch: "black" }], defaultSurface: "ink",
  editions: [{ id: "square", label: "Square", glyph: "□", width: 100, height: 100 }], defaultEdition: "square",
  resetCamera: { zoom: 1 }, roleFilters: [{ role: "evidence", label: "Evidence" }],
  meta: { title: "Test artwork", eyebrow: "Test", synopsis: "Test", description: "Test" },
};

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  harness.props = null;
  harness.use.mockReset().mockImplementation(async state => { harness.props?.onSceneUpdate?.(snapshot(state)); });
  harness.camera.mockReset().mockResolvedValue(undefined);
  harness.set.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("Scene Studio command ownership", () => {
  it("dispatches once per act change and shows accepted rather than pending state", async () => {
    const view = render(createElement(ArtworkStudio, { artwork, reducedMotion: true }));
    await waitFor(() => expect(harness.use).toHaveBeenCalledOnce());
    let accept!: () => void;
    harness.use.mockImplementationOnce(state => new Promise(resolve => {
      accept = () => { harness.props?.onSceneUpdate?.(snapshot(state)); resolve(); };
    }));
    fireEvent.click(view.container.querySelector('[data-state-id="second"]')!);
    await waitFor(() => expect(harness.use).toHaveBeenCalledTimes(2));
    expect(view.container.querySelector('[data-testid="artwork-player"]')?.getAttribute("data-active-state")).toBe("first");
    await act(async () => { accept(); });
    expect(view.container.querySelector('[data-testid="artwork-player"]')?.getAttribute("data-active-state")).toBe("second");
    fireEvent.click(view.container.querySelector('[data-state-id="second"]')!);
    expect(harness.use).toHaveBeenCalledTimes(2);
  });

  it("observes interrupted commands and retains usable accepted art after real failures", async () => {
    const view = render(createElement(ArtworkStudio, { artwork, reducedMotion: true }));
    await waitFor(() => expect(harness.use).toHaveBeenCalledOnce());
    harness.use.mockRejectedValueOnce(Object.assign(new Error("interrupted"), { code: "PLAYER_PRESENTATION_SUPERSEDED" }));
    fireEvent.click(view.container.querySelector('[data-state-id="second"]')!);
    await waitFor(() => expect(harness.use).toHaveBeenCalledTimes(2));
    expect(view.container.textContent).not.toContain("interrupted");
    harness.camera.mockRejectedValueOnce(new Error("Camera rejected"));
    fireEvent.click(view.container.querySelector('[data-testid="camera-zoom-in"]')!);
    await waitFor(() => expect(view.container.textContent).toContain("Camera rejected"));
    expect(view.container.querySelector(".live-dot.is-ready")).not.toBeNull();
    act(() => { harness.props?.onError?.(new Error("Update rejected")); });
    expect(view.container.querySelector(".live-dot.is-ready")).not.toBeNull();
    fireEvent.click(view.container.querySelector('[data-testid="camera-reset"]')!);
    await waitFor(() => expect(harness.camera).toHaveBeenCalledTimes(2));
    fireEvent.click(view.container.querySelector('[data-state-id="third"]')!);
    await waitFor(() => expect(view.container.querySelector('[data-testid="artwork-player"]')?.getAttribute("data-active-state")).toBe("third"));
  });

  it("recomputes query membership from a replacement accepted snapshot", async () => {
    const view = render(createElement(ArtworkStudio, { artwork, reducedMotion: true }));
    await waitFor(() => expect(harness.use).toHaveBeenCalledOnce());
    fireEvent.click(view.container.querySelector('[data-query-role="evidence"]')!);
    expect(view.container.querySelector('[data-testid="query-result"]')?.textContent).toContain("→ 1");
    act(() => { harness.props?.onSceneUpdate?.(snapshot("first", "subject")); });
    expect(view.container.querySelector('[data-testid="query-result"]')?.textContent).toContain("→ 0");
    expect(view.container.querySelector('[data-node-id="subject"]')).toBeNull();
  });

  it("ignores an old command failure after the child replaces its controller before onLoad", async () => {
    const view = render(createElement(ArtworkStudio, { artwork, reducedMotion: true }));
    await waitFor(() => expect(harness.use).toHaveBeenCalledOnce());
    let reject!: (error: Error) => void;
    harness.camera.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    fireEvent.click(view.container.querySelector('[data-testid="camera-zoom-in"]')!);
    const replacement = { ...artwork, renderer: { ...artwork.renderer, id: "replacement" } };
    view.rerender(createElement(ArtworkStudio, { artwork: replacement, reducedMotion: true }));
    await act(async () => { reject(new Error("stale disposed controller")); });
    expect(view.container.textContent).not.toContain("stale disposed controller");
  });

  it("retries the same failed unaccepted act and retains the latest command status", async () => {
    const view = render(createElement(ArtworkStudio, { artwork, reducedMotion: true }));
    await waitFor(() => expect(harness.use).toHaveBeenCalledOnce());
    harness.use.mockRejectedValueOnce(new Error("Act rejected"));
    fireEvent.click(view.container.querySelector('[data-state-id="second"]')!);
    await waitFor(() => expect(view.container.textContent).toContain("Act rejected"));
    fireEvent.click(view.container.querySelector('[data-state-id="second"]')!);
    await waitFor(() => expect(harness.use).toHaveBeenCalledTimes(3));
    expect(view.container.querySelector('[data-testid="artwork-player"]')?.getAttribute("data-active-state")).toBe("second");

    let reject!: (error: Error) => void;
    harness.camera.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    fireEvent.click(view.container.querySelector('[data-testid="camera-zoom-in"]')!);
    fireEvent.click(view.container.querySelector('[data-state-id="third"]')!);
    await waitFor(() => expect(harness.use).toHaveBeenCalledTimes(4));
    await act(async () => { reject(new Error("older camera rejected")); });
    expect(view.container.textContent).not.toContain("older camera rejected");
  });
  it("does not focus disappeared selection intent and keeps camera controls usable", async () => {
    const view = render(createElement(ArtworkStudio, { artwork, reducedMotion: true }));
    await waitFor(() => expect(harness.use).toHaveBeenCalledOnce());
    act(() => { harness.props?.onSceneUpdate?.({ ...snapshot(), nodes: [], rootIds: [] }); });
    expect(view.container.querySelector('[data-testid="selected-node-id"]')).toBeNull();
    fireEvent.click(view.container.querySelector('[data-testid="camera-focus"]')!);
    expect(harness.camera).not.toHaveBeenCalled();
    fireEvent.click(view.container.querySelector('[data-testid="camera-zoom-in"]')!);
    await waitFor(() => expect(harness.camera).toHaveBeenCalledExactlyOnceWith({ zoom: 1.12 }));
    act(() => { harness.props?.onSceneUpdate?.(snapshot()); });
    fireEvent.click(view.container.querySelector('[data-testid="camera-focus"]')!);
    await waitFor(() => expect(harness.camera).toHaveBeenCalledTimes(2));
    expect(harness.camera).toHaveBeenLastCalledWith({ zoom: 1.12, rotation: 0, fit: { target: "subject", padding: 72 } });
  });

});
