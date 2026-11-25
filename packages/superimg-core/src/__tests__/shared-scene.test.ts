import { describe, expect, it } from "vitest";
import { image, video } from "@superimg/types";
import {
  h,
  visual,
  Instance,
  Scene,
  collectSceneSnapshots,
} from "@superimg/stdlib/tree";
import { resolveMediaIR } from "../ir/resolve-media-ir.js";
import { together } from "../composition/together.js";
import { time } from "../composition/time.js";
import { makeTestContext } from "./__test-utils__/index.js";
const shape = visual<null>({
  id: "part",
  render: () => ({
    parts: [
      {
        id: "body",
        bounds: { x: 0, y: 0, width: 20, height: 10 },
        content: h("rect", { width: 20, height: 10, fill: "blue" }),
      },
    ],
  }),
});
const scene = () =>
  Scene(
    { id: "world", width: 100, height: 100 },
    Instance({
      id: "actor",
      entityId: "actor-1",
      of: shape,
      data: null,
      at: { x: 20, y: 40 },
    }),
  );
describe("shared scenes in media and retained composition", () => {
  it("hashes semantic scene evidence and emits frame-indexed packets for a still", async () => {
    const template = image({
      size: { width: 100, height: 100 },
      render: scene,
    });
    const { ir } = await resolveMediaIR(template);
    const payload = ir.extensions["superimg/scene"]!.payload as {
      ranges: {
        startFrame: number;
        endFrame: number;
        scenes: {
          instances: { entityId: string; bounds: { x: number; y: number } }[];
        }[];
      }[];
    };
    expect(payload.ranges).toHaveLength(1);
    expect(payload.ranges[0]).toMatchObject({
      startFrame: 0,
      endFrame: 1,
      scenes: [
        { instances: [{ entityId: "actor-1", bounds: { x: 20, y: 40 } }] },
      ],
    });
    const { ir: changed } = await resolveMediaIR(
      image({
        size: { width: 100, height: 100 },
        render: () =>
          Scene(
            { id: "world", width: 100, height: 100 },
            Instance({
              id: "actor",
              entityId: "actor-2",
              of: shape,
              data: null,
              at: { x: 20, y: 40 },
            }),
          ),
      }),
    );
    expect(changed.hashes.intentHash).not.toBe(ir.hashes.intentHash);
  });
  it("qualifies repeated occurrences and applies the exact contain placement to geometry", () => {
    const child = video({
      size: { width: 100, height: 100 },
      duration: "1s",
      fps: 10,
      render: scene,
    });
    const media = time(
      together(
        [
          {
            id: "left",
            content: child,
            fit: "contain",
            rect: { x: 0, y: 0, width: 100, height: 100 },
          },
          {
            id: "right",
            content: child,
            fit: "contain",
            rect: { x: 100, y: 0, width: 100, height: 100 },
          },
        ],
        { end: "hold" },
      ),
      { size: { width: 200, height: 100 }, fps: 10 },
    );
    const packets = collectSceneSnapshots(
      media.render(
        makeTestContext({ width: 200, height: 100, fps: 10, totalFrames: 10 }),
      ),
    );
    expect(packets.map((p) => p.instances[0]!.id)).toEqual([
      "left/world/actor",
      "right/world/actor",
    ]);
    expect(packets.map((p) => p.instances[0]!.bounds.x)).toEqual([20, 120]);
    expect(packets.map((p) => p.instances[0]!.entityId)).toEqual([
      "actor-1",
      "actor-1",
    ]);
  });
  it("keeps ordinary semantic descriptors in static media evidence", async () => {
    const { ir } = await resolveMediaIR(
      image({
        size: { width: 100, height: 100 },
        render: () =>
          h("Frame", {
            width: 100,
            height: 100,
            semantic: {
              id: "diagram",
              kind: "process",
              label: "Stamped material",
            },
          }),
      }),
    );
    expect(JSON.stringify(ir.extensions["superimg/scene"])).toContain(
      "Stamped material",
    );
  });
});
