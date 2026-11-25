import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { exportCommand, publicationDestination } from "./export.js";

describe("export interaction request validation", () => {
  it("requires at least one destination before opening a runtime", async () => {
    await expect(exportCommand(undefined, { for: [] })).rejects.toThrow(
      /at least one --for/,
    );
  });

  it("rejects conflicting still-frame policies before opening a runtime", async () => {
    await expect(exportCommand(undefined, {
      for: ["1200x630.png"],
      poster: true,
      at: "1s",
    })).rejects.toThrow(/either --poster or --at/);
  });

  it("publishes a slashed source id once under the exports root when -o names a file", () => {
    const projectRoot = "/videos";
    const slashed = publicationDestination(projectRoot, "quark-intro/quark-shape", "out.mp4");
    const root = resolve(projectRoot, ".superimg", "exports");
    expect(slashed.rootPath).toBe(root);
    expect(slashed.path).toBe(resolve(root, "quark-intro/quark-shape.export"));
    expect(slashed.copyTo).toBe(resolve("out.mp4"));
    expect(slashed.target).toEqual({
      targetId: "cli-publication",
      publicationId: "quark-intro/quark-shape.export",
    });

    const flat = publicationDestination(projectRoot, "hello", "clip.mp4");
    expect(flat.rootPath).toBe(root);
    expect(flat.path).toBe(resolve(root, "hello.export"));

    const implicit = publicationDestination(projectRoot, "quark-intro/quark-shape", undefined);
    expect(implicit.path).toBe(resolve(projectRoot, "output", "quark-intro/quark-shape.export"));
    expect(implicit.rootPath).toBeUndefined();

    const directory = publicationDestination(projectRoot, "hello", "/tmp/bundle");
    expect(directory.path).toBe(resolve("/tmp/bundle"));
    expect(directory.rootPath).toBe(dirname(resolve("/tmp/bundle")));
    expect(directory.copyTo).toBeUndefined();
  });

  it("rejects an unknown rasterizer before runtime preflight", async () => {
    await expect(exportCommand(undefined, {
      for: ["1200x630.png"],
      rasterizer: "skia" as never,
    })).rejects.toThrow(/Unknown --rasterizer skia/);
  });
});
