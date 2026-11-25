import { describe, expect, expectTypeOf, it } from "vitest";
import { validateProgram } from "@foxworth/boundary/program";
import { EDIT_INTERACTION_IDS, type EditInteractionDeclaredError } from "./contracts.js";
import { EDIT_COMPILED_INTERACTIONS } from "./compiled.js";
import { createEditInteractionMount } from "./mount.js";

describe("Edit compiled interactions", () => {
  it("is an independent exact Program with compiled handles", async () => {
    expectTypeOf<EditInteractionDeclaredError["schemaVersion"]>().toEqualTypeOf<1>();
    expect(await validateProgram(EDIT_COMPILED_INTERACTIONS.program)).toEqual(
      EDIT_COMPILED_INTERACTIONS.program,
    );
    expect(
      EDIT_COMPILED_INTERACTIONS.program.interactions.map((entry) => entry.contract.id),
    ).toEqual([
      EDIT_INTERACTION_IDS.bindings,
      EDIT_INTERACTION_IDS.setAudioClipPlacement,
      EDIT_INTERACTION_IDS.setCompositionHold,
      EDIT_INTERACTION_IDS.setNodeProperty,
      EDIT_INTERACTION_IDS.setNodeText,
      EDIT_INTERACTION_IDS.setNodeTransform,
      EDIT_INTERACTION_IDS.setPhaseBoundary,
      EDIT_INTERACTION_IDS.trimSceneEnd,
    ]);
    expect(EDIT_COMPILED_INTERACTIONS.handles.bindings.interactionId).toBe(
      EDIT_INTERACTION_IDS.bindings,
    );
  });

  it("keeps binding inspection on native dispatch and validates direct boundaries", async () => {
    const mount = createEditInteractionMount({
      handlers: {
        bindings({ input }) {
          return {
            schemaVersion: 0,
            kind: "media-edit-bindings",
            source: input.source,
            sourceId: "launch",
            manifest: {
              schemaVersion: 0,
              coordinates: { sourceId: "launch", variantId: "default", editionId: "default" },
              intentHash: "a".repeat(64),
              summary: { exactBindingCount: 0, inspectOnlyCount: 0, opaqueCount: 0 },
              bindings: [],
            },
            sourceHashes: {},
          };
        },
        setNodeTransform() { throw new Error("not called"); },
        trimSceneEnd() { throw new Error("not called"); },
        setPhaseBoundary() { throw new Error("not called"); },
        setCompositionHold() { throw new Error("not called"); },
        setNodeText() { throw new Error("not called"); },
        setNodeProperty() { throw new Error("not called"); },
        setAudioClipPlacement() { throw new Error("not called"); },
      },
    });
    expect(Object.keys(mount)).toEqual(["dispatch"]);
    const result = await mount.dispatch({
      interactionId: EDIT_INTERACTION_IDS.bindings,
      input: { source: "launch.media.ts" },
    }, {});
    expect(result).toMatchObject({ kind: "media-edit-bindings", sourceId: "launch" });
    await expect(mount.dispatch({
      interactionId: EDIT_INTERACTION_IDS.bindings,
      input: { source: "" },
    }, {})).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
