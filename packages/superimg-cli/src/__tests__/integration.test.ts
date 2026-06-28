/**
 * Tests for the integration module (build-tool cache/manifest):
 *   - RenderCache / fingerprint (cache.ts)
 *   - buildManifest with a co-located `batch` export (manifest.ts)
 *   - defineBatch type-safety smoke test (batch-types.ts re-exported via @superimg/types)
 */

import { describe, it, expect, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { fingerprint, RenderCache } from "../integration/cache.js";
import { buildManifest } from "../integration/manifest.js";
import { inferMediaKind, defaultOutputFormat } from "../integration/kind.js";
import { defineBatch } from "@superimg/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(label: string): string {
  const dir = join(tmpdir(), `superimg-test-${label}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ---------------------------------------------------------------------------
// kind inference
// ---------------------------------------------------------------------------

describe("inferMediaKind", () => {
  it("maps svg medium to svg", () => {
    expect(inferMediaKind("svg", false)).toBe("svg");
  });

  it("maps still html to image", () => {
    expect(inferMediaKind("html", false)).toBe("image");
  });

  it("maps animated html to video by default", () => {
    expect(inferMediaKind("html", true)).toBe("video");
  });

  it("maps animated html with gif encoding to gif", () => {
    expect(
      inferMediaKind("html", true, { encoding: { format: "gif" } }),
    ).toBe("gif");
  });

  it("defaultOutputFormat matches kind", () => {
    expect(defaultOutputFormat("video")).toBe("mp4");
    expect(defaultOutputFormat("image")).toBe("png");
    expect(defaultOutputFormat("gif")).toBe("gif");
    expect(defaultOutputFormat("svg")).toBe("svg");
  });
});

// ---------------------------------------------------------------------------
// fingerprint
// ---------------------------------------------------------------------------

describe("fingerprint", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns a 16-char hex string", async () => {
    tmpDir = makeTmpDir("fp-hex");
    const file = join(tmpDir, "entry.ts");
    writeFileSync(file, "export const x = 1;");

    const fp = await fingerprint(file);

    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });

  it("produces the same fingerprint for the same file content", async () => {
    tmpDir = makeTmpDir("fp-stable");
    const file = join(tmpDir, "entry.ts");
    writeFileSync(file, "export const stable = true;");

    const fp1 = await fingerprint(file);
    const fp2 = await fingerprint(file);

    expect(fp1).toBe(fp2);
  });

  it("produces a different fingerprint when file content changes", async () => {
    tmpDir = makeTmpDir("fp-change");
    const file = join(tmpDir, "entry.ts");
    writeFileSync(file, "export const v = 1;");
    const fp1 = await fingerprint(file);

    writeFileSync(file, "export const v = 2;");
    const fp2 = await fingerprint(file);

    expect(fp1).not.toBe(fp2);
  });

  it("factors in the extra argument", async () => {
    tmpDir = makeTmpDir("fp-extra");
    const file = join(tmpDir, "entry.ts");
    writeFileSync(file, "export const x = 1;");

    const fp1 = await fingerprint(file, { preset: "youtube" });
    const fp2 = await fingerprint(file, { preset: "reel" });

    expect(fp1).not.toBe(fp2);
  });

  it("changes fingerprint when a transitively imported file changes", async () => {
    tmpDir = makeTmpDir("fp-transitive");

    // helper.ts — imported by entry.ts
    const helperPath = join(tmpDir, "helper.ts");
    writeFileSync(helperPath, "export const value = 'v1';");

    // entry.ts — imports helper
    const entryPath = join(tmpDir, "entry.ts");
    writeFileSync(entryPath, `import { value } from './helper.ts'; export const x = value;`);

    const fp1 = await fingerprint(entryPath);

    // Mutate the transitive dep
    writeFileSync(helperPath, "export const value = 'v2';");
    const fp2 = await fingerprint(entryPath);

    expect(fp1).not.toBe(fp2);
  });

  it("does not throw when entrypoint does not exist", async () => {
    const fp = await fingerprint("/nonexistent/path/module.ts");
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });
});

// ---------------------------------------------------------------------------
// RenderCache
// ---------------------------------------------------------------------------

describe("RenderCache", () => {
  let cacheDir: string;

  afterEach(() => {
    if (cacheDir && existsSync(cacheDir)) {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  it("isFresh returns false for an unknown key", () => {
    cacheDir = makeTmpDir("cache-unknown");
    const cache = new RenderCache(cacheDir);

    expect(cache.isFresh("missing-key", "abc123")).toBe(false);
  });

  it("isFresh returns true after a matching set()", () => {
    cacheDir = makeTmpDir("cache-fresh");
    const cache = new RenderCache(cacheDir);

    cache.set("my-key", "fp-xyz");

    expect(cache.isFresh("my-key", "fp-xyz")).toBe(true);
  });

  it("isFresh returns false when fingerprint does not match", () => {
    cacheDir = makeTmpDir("cache-stale-fp");
    const cache = new RenderCache(cacheDir);

    cache.set("my-key", "fp-old");

    expect(cache.isFresh("my-key", "fp-new")).toBe(false);
  });

  it("isFresh returns false when outputPaths contains a missing file", () => {
    cacheDir = makeTmpDir("cache-missing-output");
    const cache = new RenderCache(cacheDir);
    cache.set("render-key", "fp-abc");

    const missingOutput = join(cacheDir, "output.mp4");
    // missingOutput does not exist on disk
    expect(cache.isFresh("render-key", "fp-abc", [missingOutput])).toBe(false);
  });

  it("isFresh returns true when outputPaths contains existing files", () => {
    cacheDir = makeTmpDir("cache-existing-output");
    const cache = new RenderCache(cacheDir);
    cache.set("render-key", "fp-abc");

    const outputFile = join(cacheDir, "output.png");
    writeFileSync(outputFile, "fake image data");

    expect(cache.isFresh("render-key", "fp-abc", [outputFile])).toBe(true);
  });

  it("isFresh returns false when only some outputPaths exist", () => {
    cacheDir = makeTmpDir("cache-partial-output");
    const cache = new RenderCache(cacheDir);
    cache.set("render-key", "fp-abc");

    const existingFile = join(cacheDir, "output.png");
    writeFileSync(existingFile, "data");
    const missingFile = join(cacheDir, "thumb.png");

    expect(cache.isFresh("render-key", "fp-abc", [existingFile, missingFile])).toBe(false);
  });

  it("persists and reloads cache across instances", () => {
    cacheDir = makeTmpDir("cache-persist");
    const cache1 = new RenderCache(cacheDir);
    cache1.set("key-a", "fp-persist");
    cache1.save();

    const cache2 = new RenderCache(cacheDir);
    expect(cache2.isFresh("key-a", "fp-persist")).toBe(true);
  });

  it("prune removes keys not in the valid set", () => {
    cacheDir = makeTmpDir("cache-prune");
    const cache = new RenderCache(cacheDir);
    cache.set("keep", "fp1");
    cache.set("remove", "fp2");

    cache.prune(["keep"]);

    expect(cache.isFresh("keep", "fp1")).toBe(true);
    expect(cache.isFresh("remove", "fp2")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// defineBatch — runtime smoke test + type inference
// ---------------------------------------------------------------------------

describe("defineBatch", () => {
  // A minimal template stand-in (inference-only at runtime).
  const template = {
    medium: "html",
    animated: false,
    config: { width: 1, height: 1 },
    render: () => "<div/>",
  } satisfies import("@superimg/types").TemplateModule;

  it("returns the provider function unchanged", () => {
    const provider = defineBatch(template, () => [
      { slug: "a", data: { title: "x" } },
      { slug: "b", data: { title: "y" } },
    ]);

    expect(typeof provider).toBe("function");
    expect(provider()).toHaveLength(2);
  });

  it("async provider resolves to the expected entries", async () => {
    const provider = defineBatch(template, async () => [
      { slug: "async-a", data: { count: 1 } },
      { slug: "async-b", data: { count: 2 } },
    ]);

    const entries = await provider();

    expect(entries).toHaveLength(2);
    expect(entries[1]).toMatchObject({ slug: "async-b", data: { count: 2 } });
  });
});

// ---------------------------------------------------------------------------
// buildManifest — co-located `batch` export
// ---------------------------------------------------------------------------

describe("buildManifest", () => {
  let fixtureDir: string;

  afterEach(() => {
    if (fixtureDir && existsSync(fixtureDir)) {
      rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  it("returns a manifest with version 1 and correct projectRoot", async () => {
    fixtureDir = makeTmpDir("manifest-basic");

    const manifest = await buildManifest(fixtureDir);

    expect(manifest.version).toBe(1);
    expect(manifest.projectRoot).toBe(fixtureDir);
    expect(Array.isArray(manifest.templates)).toBe(true);
  });

  it("expands a template's co-located `batch` export with canonical names", async () => {
    fixtureDir = makeTmpDir("manifest-batch");

    // A template that exports both the default module and a `batch` provider.
    // No `superimg` import needed — the discovery stub only fires on `superimg`.
    writeFileSync(
      join(fixtureDir, "hero.media.ts"),
      `export default { medium: "html", animated: false, config: { width: 1200, height: 630 }, render: () => "<div/>" };
export const batch = () => [
  { slug: "post-1", sample: { title: "Post One" } },
  { slug: "post-2", sample: { title: "Post Two" } },
];`
    );

    const manifest = await buildManifest(fixtureDir);

    const batchEntries = manifest.templates.filter((t) => t.batch);
    expect(batchEntries).toHaveLength(2);
    const names = batchEntries.map((e) => e.name);
    // Canonical naming: `${stem}-${slug}` (hyphen, from template path).
    expect(names).toContain("hero-post-1");
    expect(names).toContain("hero-post-2");
    expect(batchEntries.every((e) => e.stem === "hero")).toBe(true);

    // The batch source is NOT also emitted as a standalone "hero" template.
    expect(manifest.templates.some((t) => t.name === "hero" && !t.batch)).toBe(false);
  });

  it("inherits isOg from the template (og-typed stem)", async () => {
    fixtureDir = makeTmpDir("manifest-og");

    // `og` stem → listVideos marks isOg=true; batch items inherit it.
    writeFileSync(
      join(fixtureDir, "og.media.ts"),
      `export default { medium: "html", animated: false, config: { width: 1200, height: 630 }, render: () => "<div/>" };
export const batch = () => [{ slug: "s1", sample: {} }];`
    );

    const manifest = await buildManifest(fixtureDir);

    const entry = manifest.templates.find((t) => t.name === "og-s1");
    expect(entry).toBeDefined();
    expect(entry!.isOg).toBe(true);
    expect(entry!.slug).toBe("s1");
  });

  it("emits a plain template as a single non-batch item", async () => {
    fixtureDir = makeTmpDir("manifest-single");

    writeFileSync(
      join(fixtureDir, "simple.media.ts"),
      `export default { medium: "html", animated: false, config: { width: 800, height: 600 }, render: () => "<div/>" };`
    );

    const manifest = await buildManifest(fixtureDir);

    const entry = manifest.templates.find((t) => t.name === "simple");
    expect(entry).toBeDefined();
    expect(entry!.batch).toBe(false);
    expect(entry!.stem).toBe("simple");
    expect(entry!.slug).toBeUndefined();
  });

  it("fails when a batch export cannot be bundled", async () => {
    fixtureDir = makeTmpDir("manifest-batch-error");
    writeFileSync(
      join(fixtureDir, "broken.media.ts"),
      `export default { medium: "html", animated: false, config: { width: 1200, height: 630 }, render: () => "<div/>" };
export const batch = async () => {
  const { missing } = await import("./does-not-exist.js");
  return missing.map((p: { slug: string }) => ({ slug: p.slug, sample: {} }));
};`,
    );

    await expect(buildManifest(fixtureDir)).rejects.toThrow(/Batch discovery failed/);
  });

  it("resolves a batch provider that lazy-imports a relative content module", async () => {
    fixtureDir = makeTmpDir("manifest-lazy-content");
    const src = join(fixtureDir, "src");
    mkdirSync(src, { recursive: true });

    writeFileSync(
      join(src, "content.ts"),
      `export const posts = [
  { slug: "alpha", title: "Alpha" },
  { slug: "beta", title: "Beta" },
];`,
    );
    writeFileSync(
      join(src, "og.media.ts"),
      `export default { medium: "html", animated: false, config: { width: 1200, height: 630 }, render: () => "<div/>" };
export const batch = async () => {
  const { posts } = await import("./content.js");
  return posts.map((p) => ({ slug: p.slug, sample: { title: p.title } }));
};`,
    );

    const manifest = await buildManifest(fixtureDir);

    const names = manifest.templates.map((t) => t.name);
    expect(names).toContain("og-alpha");
    expect(names).toContain("og-beta");
    expect(manifest.templates.filter((t) => t.batch)).toHaveLength(2);
  });

  it("includes batch entry data in manifest rows", async () => {
    fixtureDir = makeTmpDir("manifest-batch-data");

    writeFileSync(
      join(fixtureDir, "hero.media.ts"),
      `export default { medium: "html", animated: false, config: { width: 1200, height: 630 }, render: () => "<div/>" };
export const batch = () => [
  { slug: "a", data: { title: "Alpha" } },
  { slug: "b", data: { title: "Beta", accent: "#f00" } },
];`,
    );

    const manifest = await buildManifest(fixtureDir);

    const a = manifest.templates.find((t) => t.name === "hero-a");
    const b = manifest.templates.find((t) => t.name === "hero-b");
    expect(a?.data).toEqual({ title: "Alpha" });
    expect(b?.data).toEqual({ title: "Beta", accent: "#f00" });
  });
});
