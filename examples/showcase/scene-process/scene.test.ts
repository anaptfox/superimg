import { describe, expect, it } from "vitest";
import { collectSceneSnapshots, resolveSceneTree } from "@foxworth/superimg";
import { filmData } from "./model";
import { processScene } from "./scene";

function snapshot(seconds: number, width = 640, height = 360) {
  const scene = collectSceneSnapshots(resolveSceneTree(processScene(filmData(seconds), width, height)))[0];
  if (!scene) throw new Error("Process scene must expose its resolved snapshot");
  return scene;
}

describe("connected process scene", () => {
  it("retains one workpiece and the same definitions through the process", () => {
    const start = snapshot(0);
    for (const seconds of [2.4, 2.5, 4.5, 5]) {
      const current = snapshot(seconds);
      expect(current.instances.map(i => [i.id, i.definitionId, i.entityId])).toEqual(
        start.instances.map(i => [i.id, i.definitionId, i.entityId]),
      );
      expect(current.instances.filter(i => i.entityId === "batch-01.part-01")).toHaveLength(1);
      expect(current.parts.filter(p => p.instanceId === "process/workpiece")).toHaveLength(1);
    }
  });

  it("keeps the tool mount exactly on the moving chuck at different scales", () => {
    for (const [width, height] of [[640, 360], [1280, 720], [640, 640]]) {
      for (const seconds of [0, 2.4, 3.3, 5]) {
        const scene = snapshot(seconds, width, height);
        const machine = scene.instances.find(i => i.id === "process/machine")!;
        const tool = scene.instances.find(i => i.id === "process/tool")!;
        expect(tool.attachment).toEqual({ instance: machine.id, anchor: "chuck" });
        expect(tool.anchors.mount.x).toBeCloseTo(machine.anchors.chuck.x, 8);
        expect(tool.anchors.mount.y).toBeCloseTo(machine.anchors.chuck.y, 8);
      }
    }
  });

  it("reproduces the resolved packet after shuffled seeks", () => {
    const contact = snapshot(2.4);
    snapshot(5); snapshot(0); snapshot(3.3);
    expect(snapshot(2.4)).toEqual(contact);
    expect(contact.parts.every(p => !p.opaque)).toBe(true);
  });
});
