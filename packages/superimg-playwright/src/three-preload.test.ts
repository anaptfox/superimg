import { describe, expect, it } from "vitest";
import { THREE_MODULE as authoredModule, THREE_VERSION as authoredVersion } from "@superimg/stdlib/compat/three";
import { THREE_MODULE, THREE_VERSION } from "./three-preload.js";

describe("legacy Three artifact compatibility", () => {
  it("captures with the version expected by the retained authoring helper", () => {
    expect(THREE_VERSION).toBe(authoredVersion);
    expect(THREE_MODULE).toBe(authoredModule);
  });

});
