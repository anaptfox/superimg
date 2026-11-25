import { describe, expect, it } from "vitest";
import { video } from "@superimg/types";
import { Html } from "@superimg/stdlib/tree";
import { choose, sequence } from "@superimg/core";
import { createPartProjector } from "./program-projector.js";
import type { DomPlayer } from "./dom-player.js";
import type { PlayerInput } from "./player-types.js";

const size = { width: 320, height: 180 };

function clip(label: string) {
  return video({
    size,
    fps: 10,
    duration: "1f",
    render: () => Html({ width: "fill", height: "fill", html: label }),
  });
}

function playerThatRecords(loaded: PlayerInput[]): DomPlayer {
  return {
    load: async (media: PlayerInput) => {
      loaded.push(media);
      return { status: "success", cues: [], totalFrames: 1, duration: 0.1, width: 320, height: 180, fps: 10 };
    },
  } as unknown as DomPlayer;
}

describe("createPartProjector routes", () => {
  it("translates full choice paths into each page's local projection", async () => {
    const rootChoice = choose({ basic: clip("root basic"), advanced: clip("root advanced") });
    const nestedChoice = sequence([
      { id: "decision", content: choose({ basic: clip("nested basic"), advanced: clip("nested advanced") }) },
    ]);
    const story = sequence([
      { id: "root-choice", content: rootChoice },
      { id: "nested", content: nestedChoice },
    ]);
    const loaded: PlayerInput[] = [];
    const projector = createPartProjector(playerThatRecords(loaded), story, {
      size,
      fps: 10,
      routes: { "root-choice": "advanced", "nested/decision": "advanced" },
    });

    await projector.ready;
    expect(loaded[0]?.composition?.schedule.selectedRoutes).toEqual({ root: "advanced" });
    expect(loaded[0]?.composition?.schedule.leaves.map((leaf) => leaf.path)).toEqual(["advanced"]);

    await projector.go("nested");
    expect(loaded[1]?.composition?.schedule.selectedRoutes).toEqual({ decision: "advanced" });
    expect(loaded[1]?.composition?.schedule.leaves.map((leaf) => leaf.path)).toEqual(["decision/advanced"]);
  });

  it("rejects route keys that are not choices in the source sequence", () => {
    const story = sequence([{ id: "page", content: choose({ basic: clip("basic"), advanced: clip("advanced") }) }]);

    expect(() => createPartProjector(playerThatRecords([]), story, {
      size,
      fps: 10,
      routes: { missing: "advanced" },
    })).toThrow('Unknown Program route "missing".');
  });
});
