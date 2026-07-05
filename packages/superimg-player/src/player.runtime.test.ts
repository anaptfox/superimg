/** @vitest-environment happy-dom */

import { describe, expect, it } from "vitest";
import { define } from "@superimg/types";
import { compose } from "@superimg/core";
import { Player, type PlayerInput } from "./player.js";

describe("Player vNext MediaSession integration", () => {
  it("loads, seeks, updates, and disposes through MediaSession", async () => {
    const container = document.createElement("div");
    const template = define({
      sample: { label: "initial" },
      config: { width: 320, height: 180, fps: 10, duration: 1 },
      render: (ctx) => `<div>${ctx.globalFrame}:${ctx.data.label}</div>`,
    });
    const player = new Player({ container });

    const result = await player.load(template as unknown as PlayerInput);

    expect(result.status).toBe("success");
    expect(player.getState().totalFrames).toBe(10);

    player.seekFrame(999);
    expect(player.currentFrame).toBe(9);

    player.update({ data: { label: "updated" } });
    expect(player.getState().currentFrame).toBe(9);

    player.dispose();
    expect(container.children.length).toBe(0);
  });

  it("exposes a Zustand store for UI controls", async () => {
    const container = document.createElement("div");
    const template = define({
      config: { width: 320, height: 180, fps: 10, duration: 1 },
      render: (ctx) => `<div>${ctx.globalFrame}</div>`,
    });
    const player = new Player({ container });
    await player.load(template as unknown as PlayerInput);

    expect(player.store).toBeDefined();
    expect(player.store.getState().totalFrames).toBe(10);
    player.store.getState().setFrame(5);
    expect(player.currentFrame).toBe(5);
  });

  it("emits ready after the runtime store is available", async () => {
    const container = document.createElement("div");
    const template = define({
      config: { width: 320, height: 180, fps: 10, duration: 1 },
      render: (ctx) => `<div>${ctx.globalFrame}</div>`,
    });
    const player = new Player({ container });
    const readySnapshots: boolean[] = [];
    player.on("ready", () => {
      readySnapshots.push(player.getRuntimeStore().getState().isReady);
    });

    const result = await player.load(template as unknown as PlayerInput);

    expect(result.status).toBe("success");
    expect(readySnapshots).toEqual([true]);
  });

  it("forwards scenechange events from composed media sessions", async () => {
    const sceneA = define({
      config: { width: 320, height: 180, fps: 10, duration: 0.5 },
      render: (ctx) => `<main>A:${ctx.globalFrame}</main>`,
    });
    const sceneB = define({
      config: { width: 320, height: 180, fps: 10, duration: 0.5 },
      render: (ctx) => `<main>B:${ctx.globalFrame}</main>`,
    });
    const template = compose([
      { id: "a", template: sceneA },
      { id: "b", template: sceneB },
    ]);
    const player = new Player({ container: document.createElement("div") });
    const sceneIds: string[] = [];
    player.on("scenechange", (scene) => sceneIds.push(scene.id));

    const result = await player.load(template as unknown as PlayerInput);
    await player.render(5);

    expect(result.status).toBe("success");
    expect(sceneIds).toContain("a");
    expect(sceneIds).toContain("b");
  });

  it("does not expose removed legacy aliases", () => {
    const player = new Player({ container: document.createElement("div") });
    const exposed = player as unknown as Record<string, unknown>;

    expect(exposed.seekToFrame).toBeUndefined();
    expect(exposed.seekToProgress).toBeUndefined();
    expect(exposed.setData).toBeUndefined();
    expect(exposed.setFormat).toBeUndefined();
    expect(exposed.captureFrame).toBeUndefined();
    expect(exposed.destroy).toBeUndefined();
  });
});
