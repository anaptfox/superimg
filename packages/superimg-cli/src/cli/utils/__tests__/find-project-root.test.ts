import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { findProjectRoot, findWorkspaceRoot } from "../find-project-root.js";

describe("package ownership", () => {
  let root = "";
  afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); root = ""; });

  it("returns the nearest package while keeping workspace lookup separate", () => {
    root = join(tmpdir(), `superimg-roots-${Date.now()}`);
    const member = join(root, "packages", "media");
    const nested = join(member, "nested");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
    writeFileSync(join(member, "package.json"), "{}");

    expect(findProjectRoot(nested)).toBe(member);
    expect(findWorkspaceRoot(nested)).toBe(root);
  });
});
