// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { together, time, image, visual, Vector, vector, Scene, Instance } from "@foxworth/superimg";
import { createDomPlayer } from "@foxworth/superimg/player";
import { present, type ProgramActionEvent } from "@foxworth/superimg/player/program";
import { resolveMediaIR } from "@superimg/core/ir";
import type { SceneSnapshot } from "@foxworth/superimg/interactive/define";
import live from "./scene-process-live.media";

const size = { width: 1280, height: 360 };
const twins = () => together([
  { id: "left", content: live, fit: "reflow", rect: { x: 0, y: 0, width: 640, height: 360 } },
  { id: "right", content: live, fit: "reflow", rect: { x: 640, y: 0, width: 640, height: 360 } },
], { end: "hold" });

interface ScenePacketPayload { ranges: { scenes: SceneSnapshot[] }[] }
function packets(ir: Awaited<ReturnType<typeof resolveMediaIR>>["ir"]) {
  const extension = ir.extensions["superimg/scene"];
  expect(extension).toBeDefined();
  return (extension.payload as unknown as ScenePacketPayload).ranges.flatMap(range => range.scenes);
}

afterEach(() => { document.body.innerHTML = ""; });

describe("shared scene in retained projections", () => {
  it("keeps two live occurrences distinct in portable IR", async () => {
    const timed = time(twins(), { size, fps: 2, inspection: true });
    const { ir } = await resolveMediaIR(timed, { sourceId: "process-twins", verify: true });
    const frames = packets(ir);
    expect(new Set(frames.map(frame => frame.sceneId))).toEqual(new Set(["left/process", "right/process"]));
    for (const frame of frames) {
      const occurrence = frame.sceneId.split("/")[0];
      expect(frame.nodes.some(node => node.id === `${occurrence}/process/workpiece`)).toBe(true);
    }
  });

  it("routes the two occurrences' declared actions to their own child hosts", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const player = createDomPlayer({ container, playerMode: "dev" });
    const session = present(player, twins(), { mode: "timeline", size, fps: 2, inspection: true });
    try {
      const result = await session.ready;
      if (result.status === "error") throw new Error(result.message);
      const actions: ProgramActionEvent[] = [];
      session.on("action", event => actions.push(event));
      const doc = container.querySelector("iframe")!.contentDocument!;
      for (const occurrence of ["left", "right"]) {
        const target = doc.querySelector(`[data-si-occurrence="${occurrence}"] [data-si-actions="select"]`);
        expect(target).not.toBeNull();
        target!.dispatchEvent(new doc.defaultView!.MouseEvent("click", { bubbles: true }));
      }
      expect(actions.map(action => action.path)).toEqual(["left", "right"]);
      expect(actions.map(action => action.presentation.sceneId)).toEqual(["left", "right"]);
      await session.setData("left", { progress: 0.9, stamped: false });
      const accepted = session.snapshot().interactive as Record<string, SceneSnapshot>;
      expect(accepted.left.nodes.find(node => node.label === "Raw material")).toBeDefined();
      expect(accepted.right.nodes.find(node => node.label === "Stamped part")).toBeDefined();
    } finally { session.dispose(); player.dispose(); }
  });

  it("retains a semantic annotation on typed visual content through Media IR", async () => {
    const annotated = visual<Record<string, never>>({ id: "process.annotated", render() {
      return { parts: [{ id: "mark", bounds: { x: 0, y: 0, width: 20, height: 20 },
        content: Vector({ width: 20, height: 20, semantic: { id: "finish-mark", kind: "indicator", label: "Stamp accepted", actions: ["inspect"] } },
          vector.path({ d: "M0 0H20V20H0Z", fill: "#83e4c3" })),
      }] };
    } });
    const media = image({ size: { width: 100, height: 100 }, render: () => Scene({ id: "annotation", width: 100, height: 100 },
      Instance({ id: "part", of: annotated, data: {}, at: { x: 30, y: 30 } })),
    });
    const { ir } = await resolveMediaIR(media, { sourceId: "typed-part-semantics", verify: true });
    expect(packets(ir).flatMap(frame => frame.nodes).find(node => node.label === "Stamp accepted"))
      .toMatchObject({ kind: "indicator", actions: ["inspect"] });
  });
});
