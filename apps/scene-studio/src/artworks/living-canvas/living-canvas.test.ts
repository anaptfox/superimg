import { describe, expect, it } from "vitest";
import { lowerInteractiveDefinition, type SceneSnapshot } from "@foxworth/superimg/interactive/define";
import { livingCanvasArtwork } from "./artwork";
import { livingCanvasProfiles, livingCanvasRenderer } from "./renderer";
import livingCanvas from "./living-canvas.media";
import { assertSurfaceCssVarParity } from "../../kit/surface-renderer";

describe("The Weight of a Choice", () => {
  it("is one singular interactive experience with the complete reading guide", () => {
    expect(livingCanvas.kind).toBe("interactive");
    expect(livingCanvas.guide.steps.map((step) => step.id)).toEqual(
      livingCanvasArtwork.acts.map((act) => act.id),
    );
    expect(livingCanvas.guide.steps.map((step) => step.focusNodeId)).toEqual(
      livingCanvasArtwork.acts.map((act) => act.focus),
    );
    expect(livingCanvas).not.toHaveProperty("entries");
  });

  it("lowers to the passive media engine only at the interactive boundary", () => {
    const runtime = lowerInteractiveDefinition(livingCanvas, {
      sceneRenderer: livingCanvasRenderer,
      sceneStyle: "nocturne",
    });
    expect(runtime).toMatchObject({
      kind: "media",
      media: "video",
      config: { fps: 30, duration: "18s" },
    });
  });

  it("keeps surface identity outside the semantic snapshot", () => {
    const snapshot: SceneSnapshot = {
      schemaVersion: 0,
      sceneId: "living-canvas",
      activeState: "encounter",
      rootIds: ["wallet"],
      nodes: [{
        id: "wallet",
        kind: "wallet",
        role: "subject",
        label: null,
        state: null,
        parentId: null,
        childIds: [],
        tags: [],
        actions: [],
        space: "world",
        visible: true,
        opacity: 1,
        transform: {},
        animation: null,
        properties: {},
        metadata: {},
      }],
      states: {},
      camera: { x: 0, y: 0, zoom: 1, rotation: 0, fit: null, follow: null },
    };
    const html = livingCanvasRenderer.render({
      html: '<div data-si-node="wallet">wallet</div>',
      scene: snapshot,
      medium: "html",
      style: "blueprint",
    });
    expect(html).toContain('data-scene-renderer="blueprint"');
    expect(html).toContain('data-si-node="wallet"');
    assertSurfaceCssVarParity(livingCanvasProfiles);
  });
});
