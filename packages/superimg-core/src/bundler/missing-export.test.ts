import { describe, expect, it } from "vitest";
import { bundleTemplateCode } from "./bundler.js";

describe("template missing exports", () => {
  it("rejects host runtime imports from interactive authoring", async () => {
    await expect(bundleTemplateCode(`
      import { defineInteractive, InteractivePlayer } from "@foxworth/superimg/interactive/define";
      export default defineInteractive({ render: () => InteractivePlayer });
    `, { sourcefile: "bad-interactive.media.ts" })).rejects.toMatchObject({
      code: "TEMPLATE_MISSING_EXPORT",
      message: expect.stringContaining("'@foxworth/superimg/interactive/define' has no export named 'InteractivePlayer'"),
    });
  });

  it("rejects import { lower } from superimg", async () => {
    const code = `
      import { video, lower } from "@foxworth/superimg";
      export default video({
        duration: "1s",
        render: () => (lower as unknown as () => never)(),
      });
    `;
    await expect(
      bundleTemplateCode(code, { sourcefile: "bad.media.ts" }),
    ).rejects.toMatchObject({
      code: "TEMPLATE_MISSING_EXPORT",
      message: expect.stringContaining("'@foxworth/superimg' has no export named 'lower'"),
    });
  });
});
