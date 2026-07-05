import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("@superimg/node public surface", () => {
  it("keeps Playwright names out of the public entry", () => {
    const src = readFileSync(join(__dirname, "index.ts"), "utf8");
    expect(src).not.toContain("PlaywrightEngine");
    expect(src).toContain("createRenderSession");
    expect(src).toContain("installRuntime");
  });

  it("keeps low-level Playwright bindings on the internal entry", () => {
    const src = readFileSync(join(__dirname, "internal.ts"), "utf8");
    expect(src).toContain("PlaywrightEngine");
    expect(src).toContain("FfmpegGifEncoder");
  });
});
