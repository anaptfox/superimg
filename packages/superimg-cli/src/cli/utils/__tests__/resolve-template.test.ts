import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ValidationError } from "@superimg/types";
import { resolveTemplatePath } from "../resolve-template.js";

function makeProject(label: string): string {
  const root = join(tmpdir(), `superimg-resolve-${label}-${Date.now()}`);
  mkdirSync(join(root, "videos"), { recursive: true });
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

  it("resolves videos/{name}.media.ts by bare name", () => {
    root = makeProject("bare");
    const templatePath = join(root, "videos", "intro.media.ts");
    writeFileSync(templatePath, "export default {}");

    expect(resolveTemplatePath("intro", root)).toBe(templatePath);
  });

  it("resolves explicit ./videos/*.media.ts paths", () => {
    root = makeProject("explicit");
    const templatePath = join(root, "videos", "promo.media.ts");
    writeFileSync(templatePath, "export default {}");

    expect(resolveTemplatePath("./videos/promo.media.ts", root)).toBe(templatePath);
  });

  it("rejects explicit paths that are not *.media.ts", () => {
    root = makeProject("reject");
    const legacyPath = join(root, "videos", "promo.video.ts");
    writeFileSync(legacyPath, "export default {}");

    expect(() => resolveTemplatePath("./videos/promo.video.ts", root)).toThrow(ValidationError);
  });
});