import { describe, expect, it } from "vitest";
import * as root from "../index.js";

const AUTHORING_VALUES = [
  "Frame",
  "Stack",
  "Text",
  "Safe",
  "Vector",
  "vector",
  "Code",
  "Spacer",
  "Fill",
  "Image",
  "Video",
  "Plate",
  "Html",
  "isMediaElement",
] as const;

const TRIMMED_ROOT_VALUES = [
  "lower",
  "walkMediaTree",
  "compose",
  "MEDIA_ELEMENT",
  "TemplateCompilationError",
  "ValidationError",
  "RenderError",
] as const;

describe("authoring surface parity", () => {
  for (const name of AUTHORING_VALUES) {
    it(`exports ${name} from the neutral root`, () => {
      expect(root[name]).toBeDefined();
    });
  }

  it("does not export trimmed runtime and error symbols", () => {
    for (const name of TRIMMED_ROOT_VALUES) {
      expect(name in root).toBe(false);
    }
  });

  it("does not retain shallow pattern primitives", () => {
    for (const name of ["Card", "LowerThird", "Caption"] as const) {
      expect(name in root).toBe(false);
    }
  });

  it("exports authoring helpers on the root", () => {
    for (const name of ["video", "image", "svg", "ogImage", "define", "collection", "listCollectionEntries", "planNarration", "sequence", "time"] as const) {
      expect(root[name]).toBeTypeOf("function");
    }
  });

  it("keeps defineInteractive and createDirector off the root", () => {
    expect("defineInteractive" in root).toBe(false);
    expect("createDirector" in root).toBe(false);
  });
});
