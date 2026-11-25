// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { createInteractivePlayer } from "@foxworth/superimg/interactive/player";
import { type SceneActionEvent } from "@foxworth/superimg/interactive/define";
import live from "./scene-process-live.media";
import type { ProcessData } from "./model";

afterEach(() => { document.body.innerHTML = ""; });

describe("process host authority at interactive publication", () => {
  it("emits an accepted action without changing material state; only host data changes it", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const player = createInteractivePlayer<ProcessData>({ container });
    try {
      const actions: SceneActionEvent[] = [];
      player.on("action", event => actions.push(event));
      const data = Object.freeze({ progress: 0.9, stamped: false });
      const result = await player.load(live, { data });
      expect(result.status).toBe("success");
      const accepted = player.player.getPresentation().accepted!;
      const snapshot = player.sceneSnapshot;
      const doc = container.querySelector("iframe")!.contentDocument!;
      const target = doc.querySelector('[data-si-instance="process/workpiece"][data-si-actions="select"]')!;
      expect(target).not.toBeNull();
      target.dispatchEvent(new doc.defaultView!.MouseEvent("click", { bubbles: true }));
      expect(actions).toHaveLength(1);
      expect(actions[0]).toMatchObject({ action: "select", frame: accepted.frame,
        presentation: { generation: player.player.getPresentation().generation, revision: accepted.revision } });
      expect(player.sceneSnapshot).toEqual(snapshot);
      expect(player.sceneSnapshot.nodes.find(n => n.id === "process/workpiece")?.label).toBe("Raw material");
      expect(data.stamped).toBe(false);

      await player.setData({ progress: 0.9, stamped: true });
      expect(player.sceneSnapshot.nodes.find(n => n.id === "process/workpiece")?.label).toBe("Stamped part");
      expect(player.player.getPresentation().accepted?.revision).toBeGreaterThan(accepted.revision);
    } finally { player.dispose(); }
  });

  it("retains prior accepted pixels, snapshot and action identity when a candidate fails", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const player = createInteractivePlayer<ProcessData>({ container });
    try {
      const actions: SceneActionEvent[] = [];
      const errors: Error[] = [];
      player.on("action", event => actions.push(event));
      player.on("error", error => errors.push(error));
      const result = await player.load(live, { data: { progress: 0.3, stamped: false } });
      expect(result.status).toBe("success");
      const accepted = player.player.getPresentation().accepted!;
      const snapshot = player.sceneSnapshot;
      const doc = container.querySelector("iframe")!.contentDocument!;
      const pixels = doc.body.innerHTML;
      await player.setData({ progress: NaN, stamped: true }).catch(() => undefined);
      expect(errors.some(error => error.message.includes("finite"))).toBe(true);
      expect(player.player.getPresentation().accepted).toEqual(accepted);
      expect(player.sceneSnapshot).toEqual(snapshot);
      expect(doc.body.innerHTML).toBe(pixels);
      const target = doc.querySelector('[data-si-instance="process/workpiece"][data-si-actions="select"]')!;
      target.dispatchEvent(new doc.defaultView!.MouseEvent("click", { bubbles: true }));
      expect(actions).toHaveLength(1);
      expect(actions[0]?.presentation.revision).toBe(accepted.revision);
      expect(player.sceneSnapshot.nodes.find(n => n.id === "process/workpiece")?.label).toBe("Raw material");
    } finally { player.dispose(); }
  });
});
