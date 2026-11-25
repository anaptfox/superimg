import { describe, expect, it } from "vitest";
import { lowerInteractiveDefinition } from "@foxworth/superimg/interactive/define";
import { assertSurfaceCssVarParity } from "../../kit/surface-renderer";
import { study02Artwork } from "./artwork";
import template from "./study-02.media";
import { study_02Profiles, study_02Renderer } from "./renderer";

describe("Study02 interactive contract", () => {
  it("is singular and follows its declared acts", () => {
    expect(template.kind).toBe("interactive");
    expect(template.guide.steps.map((step) => step.id)).toEqual(
      study02Artwork.acts.map((act) => act.id),
    );
    expect(template).not.toHaveProperty("entries");
  });

  it("lowers through the explicit interactive package", () => {
    const runtime = lowerInteractiveDefinition(template, {
      sceneRenderer: study_02Renderer,
      sceneStyle: study02Artwork.defaultSurface,
    });
    expect(runtime.config?.duration).toBe("6s");
    assertSurfaceCssVarParity(study_02Profiles);
  });
});
