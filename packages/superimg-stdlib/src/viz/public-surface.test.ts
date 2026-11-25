import { describe, expect, it } from "vitest";
import * as viz from "./index.js";

describe("public visualization surface", () => {
  it("does not expose the legacy string-based Three helper", () => {
    expect(viz).not.toHaveProperty("three");
  });
});
