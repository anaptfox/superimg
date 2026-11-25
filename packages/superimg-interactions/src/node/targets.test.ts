import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createProjectMediaTargetRegistry,
  resolveMediaTargetPath,
} from "./targets.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("logical media targets", () => {
  it("maps portable ids through a private host registry", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-targets-"));
    roots.push(root);
    const registry = createProjectMediaTargetRegistry(root);
    const target = await registry.resolve({
      kind: "publication",
      targetId: "project-output",
      context: {},
    });
    expect(target.registryDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(resolveMediaTargetPath(target, "campaign/launch.export")).toBe(
      join(root, "output/campaign/launch.export"),
    );
  });

  it("rejects absolute paths, traversal, and destination symlinks", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-targets-"));
    roots.push(root);
    const output = join(root, "output");
    const elsewhere = join(root, "elsewhere");
    await mkdir(output);
    await mkdir(elsewhere);
    await symlink(elsewhere, join(output, "linked"));
    const target = await createProjectMediaTargetRegistry(root).resolve({
      kind: "publication",
      targetId: "project-output",
      context: {},
    });

    expect(() => resolveMediaTargetPath(target, "/absolute")).toThrow("Invalid logical");
    expect(() => resolveMediaTargetPath(target, "../escape")).toThrow("escapes");
    expect(() => resolveMediaTargetPath(target, "linked")).toThrow("symlink");
  });
});
