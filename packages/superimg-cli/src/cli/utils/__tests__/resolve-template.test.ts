import { mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { isSuperImgError } from "@superimg/types";
import { resolveTemplatePath } from "../resolve-template.js";

function makeProject(label: string): string {
  const root = join(tmpdir(), `superimg-resolve-${label}-${Date.now()}`);
  mkdirSync(join(root, "media"), { recursive: true });
  writeFileSync(join(root, "package.json"), "{}");
  return root;
}

describe("resolveTemplatePath", () => {
  let root: string;

  afterEach(() => {
    if (root) {
      rmSync(root, { recursive: true, force: true });
      root = "";
    }
  });

  it("gives media/{name}.media.ts priority over project-wide search", () => {
    root = makeProject("bare");
    const templatePath = join(root, "media", "intro.media.ts");
    writeFileSync(templatePath, "export default {}");

    mkdirSync(join(root, "videos"));
    writeFileSync(join(root, "videos", "intro.media.ts"), "export default {}");
    expect(resolveTemplatePath("intro", root)).toBe(templatePath);
  });

  it("resolves explicit ./media/*.media.ts paths", () => {
    root = makeProject("explicit");
    const templatePath = join(root, "media", "promo.media.ts");
    writeFileSync(templatePath, "export default {}");

    expect(resolveTemplatePath("./media/promo.media.ts", root)).toBe(templatePath);
  });

  it("rejects explicit paths that are not *.media.ts", () => {
    root = makeProject("reject");
    const legacyPath = join(root, "media", "promo.video.ts");
    writeFileSync(legacyPath, "export default {}");

    try {
      resolveTemplatePath("./media/promo.video.ts", root);
      expect.fail("Expected a validation error");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(isSuperImgError(error, "VALIDATION_ERROR")).toBe(true);
      expect(error).toMatchObject({ details: { field: "template", receivedValue: "./media/promo.video.ts", expectedType: ".media.ts or .media.js file" }, suggestion: "Rename the file to end in `.media.ts`." });
    }
  });

  it("does not let the media convention bypass a nested package boundary", () => {
    root = makeProject("nested-package");
    writeFileSync(join(root, "media", "package.json"), "{}");
    const template = join(root, "media", "intro.media.ts");
    writeFileSync(template, "export default {}");
    try {
      resolveTemplatePath("intro", root);
      expect.fail("Expected an IO error");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(isSuperImgError(error, "IO_ERROR")).toBe(true);
      expect(error).toMatchObject({ details: { operation: "read", path: "intro" }, suggestion: "Check that the file exists and you have read permissions." });
    }
    expect(realpathSync(resolveTemplatePath("intro", join(root, "media")))).toBe(realpathSync(template));
    expect(resolveTemplatePath("./media/intro.media.ts", root)).toBe(template);
  });
});
