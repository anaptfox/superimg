import { describe, expect, it } from "vitest";
import { createPlayerStore } from "./state.js";
import { createRuntimeStoreAdapter } from "./runtime-store-adapter.js";

describe("createRuntimeStoreAdapter", () => {
  it("returns a stable snapshot reference when store state is unchanged", () => {
    const store = createPlayerStore({ fps: 30, duration: 2 });
    const runtimeStore = createRuntimeStoreAdapter(store, () => null);

    const first = runtimeStore.getState();
    const second = runtimeStore.getState();

    expect(first).toBe(second);
  });

  it("returns a new snapshot reference after playback state changes", () => {
    const store = createPlayerStore({ fps: 30, duration: 2 });
    const runtimeStore = createRuntimeStoreAdapter(store, () => null);

    const before = runtimeStore.getState();
    store.getState().play();
    const after = runtimeStore.getState();

    expect(before).not.toBe(after);
    expect(after.isPlaying).toBe(true);
  });
});