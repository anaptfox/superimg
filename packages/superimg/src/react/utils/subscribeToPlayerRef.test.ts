import { describe, it, expect } from "vitest";
import { createRef } from "react";
import {
  getEmptyPlayerState,
  getPlayerRefStateSnapshot,
} from "./subscribeToPlayerRef.js";
import type { PlayerRef } from "../components/Player.js";
import type { RuntimeStore } from "@superimg/media";

describe("subscribeToPlayerRef", () => {
  it("returns empty state when ref has no store", () => {
    const ref = createRef<PlayerRef | null>();
    expect(getPlayerRefStateSnapshot(ref)).toEqual(getEmptyPlayerState());
  });

  it("reads state from a populated ref", () => {
    const ref = createRef<PlayerRef | null>();
    const store = {
      getState: () => ({
        ...getEmptyPlayerState(),
        isReady: true,
        totalFrames: 90,
      }),
      subscribe: () => () => {},
    } as unknown as RuntimeStore;

    ref.current = {
      store,
      isReady: true,
      isPlaying: false,
      currentFrame: 0,
      totalFrames: 90,
      play: () => {},
      pause: () => {},
      seek: async () => {},
      update: async () => {},
      player: null,
    };

    expect(getPlayerRefStateSnapshot(ref).isReady).toBe(true);
    expect(getPlayerRefStateSnapshot(ref).totalFrames).toBe(90);
  });
});
