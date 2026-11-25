import { describe, it, expect, vi } from "vitest";
import {
  scaffoldProject,
  sanitizeProjectName,
  resolveExampleKey,
  findExamplesRoot,
  copyExampleIntoProject,
} from "./scaffold-project.js";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  symlinkSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("scaffoldProject (example copy only)", () => {
  it("sanitizes project names", () => {
    expect(sanitizeProjectName("My Cool Project!")).toBe("my-cool-project");
    expect(sanitizeProjectName("")).toBe("my-superimg-project");
  });

  it("resolves example aliases", () => {
    expect(resolveExampleKey("request-journey")).toBe("basics/request-journey");
    expect(resolveExampleKey("hello-world")).toBe("basics/hello-world");
    expect(resolveExampleKey(undefined)).toBe("basics/hello-world");
  });

  it("finds monorepo examples from cwd", () => {
    // Tests run from package dir or monorepo root — either should walk up.
    const root = findExamplesRoot(process.cwd());
    expect(root).toBeTruthy();
    expect(existsSync(join(root!, "basics", "hello-world"))).toBe(true);
  });

  it("copies hello-world example into a new project", () => {
    const parent = mkdtempSync(join(tmpdir(), "si-scaf-parent-"));
    const root = join(parent, "demo-proj");
    try {
      const result = scaffoldProject({
        projectRoot: root,
        parentDir: parent,
        name: "Demo Proj",
        example: "hello-world",
      });
      expect(result.name).toBe("demo-proj");
      expect(result.exampleKey).toBe("basics/hello-world");
      expect(existsSync(join(root, "package.json"))).toBe(true);
      expect(existsSync(join(root, "media", "hello-world.media.js"))).toBe(true);
      expect(result.filesWritten).toContain("media/hello-world.media.js");
      const media = readFileSync(
        join(root, "media", "hello-world.media.js"),
        "utf8",
      );
      expect(media).toContain("video(");
      expect(media).toContain("Hello, SuperImg");
      const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
      expect(pkg.scripts["media:dev"]).toBe("superimg dev");
      expect(pkg.scripts["media:list"]).toBe("superimg list");
      expect(pkg.scripts.check).toBeUndefined();
      expect(pkg.scripts.export).toBeUndefined();
      expect(pkg.dependencies["@foxworth/superimg"]).toBe("latest");
      expect(pkg.devDependencies["@foxworth/superimg-cli"]).toBe("latest");
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("copies the request-journey example", () => {
    const parent = mkdtempSync(join(tmpdir(), "si-scaf-rj-"));
    const root = join(parent, "rj");
    try {
      const result = scaffoldProject({
        projectRoot: root,
        parentDir: parent,
        example: "request-journey",
      });
      expect(result.exampleKey).toBe("basics/request-journey");
      expect(existsSync(join(root, "media", "request-journey.media.ts"))).toBe(
        true,
      );
      const src = readFileSync(
        join(root, "media", "request-journey.media.ts"),
        "utf8",
      );
      expect(src).toContain("SceneGuide");
      expect(src).toContain('from "@foxworth/superimg/interactive/define"');
      expect(src).toContain("defineInteractive");
      expect(src).not.toContain("collection(");
      expect(src).toContain("dns");
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("copies to media/ and preserves a repeat", () => {
    const root = mkdtempSync(join(tmpdir(), "si-media-lib-"));
    try {
      writeFileSync(join(root, "package.json"), '{"name":"x"}\n');
      const first = copyExampleIntoProject(root, "hello-world");
      expect(first.templatePath).toContain(`${join("media", "hello-world.media.js")}`);
      writeFileSync(first.templatePath, "user edit\n");

      const second = copyExampleIntoProject(root, "hello-world");
      expect(second.templatePath).toBe(first.templatePath);
      expect(readFileSync(first.templatePath, "utf8")).toBe("user edit\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("defaults to media/ even when videos/ already exists", () => {
    const root = mkdtempSync(join(tmpdir(), "si-old-videos-"));
    try {
      writeFileSync(join(root, "package.json"), '{"name":"x"}\n');
      mkdirSync(join(root, "videos"));
      const result = copyExampleIntoProject(root, "hello-world");
      expect(result.templatePath).toBe(join(root, "media", "hello-world.media.js"));
      expect(existsSync(join(root, "videos", "hello-world.media.js"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("supports explicit root placement and makes an unchanged repeat a no-op", () => {
    const root = mkdtempSync(join(tmpdir(), "si-root-content-"));
    try {
      writeFileSync(join(root, "package.json"), '{"name":"workspace-media"}\n');
      const first = copyExampleIntoProject(root, "hello-world", undefined, { contentDir: "." });
      expect(first.templatePath).toBe(join(root, "hello-world.media.js"));
      expect(first.filesWritten).toContain("hello-world.media.js");
      writeFileSync(first.templatePath, "user edit\n");

      const second = copyExampleIntoProject(root, "hello-world", undefined, { contentDir: "." });
      expect(second.filesWritten).toEqual([]);
      expect(readFileSync(first.templatePath, "utf8")).toBe("user edit\n");
      expect(existsSync(join(root, "package.json"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects non-file and symlink payload targets before treating them as preserved", () => {
    const examples = mkdtempSync(join(tmpdir(), "si-idempotent-example-"));
    const source = join(examples, "basics", "compound");
    const root = mkdtempSync(join(tmpdir(), "si-idempotent-target-"));
    const outside = join(examples, "outside.ts");
    try {
      mkdirSync(source, { recursive: true });
      mkdirSync(join(root, "media"));
      writeFileSync(join(source, "compound.media.ts"), "export default {};\n");
      writeFileSync(join(source, "helper.ts"), "export {};\n");
      writeFileSync(join(examples, "_templates.json"), "{}\n");
      writeFileSync(join(root, "media", "compound.media.ts"), "user edit\n");
      writeFileSync(outside, "outside\n");
      vi.stubEnv("SUPERIMG_EXAMPLES_ROOT", examples);

      mkdirSync(join(root, "media", "helper.ts"));
      expect(() => copyExampleIntoProject(root, "compound")).toThrow(/regular file/);
      rmSync(join(root, "media", "helper.ts"), { recursive: true });
      symlinkSync(outside, join(root, "media", "helper.ts"));
      expect(() => copyExampleIntoProject(root, "compound")).toThrow(/unsupported symlink/);
    } finally {
      vi.unstubAllEnvs();
      rmSync(examples, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("copies local modules and assets with the primary media", () => {
    const examples = mkdtempSync(join(tmpdir(), "si-examples-"));
    const source = join(examples, "basics", "compound");
    const root = mkdtempSync(join(tmpdir(), "si-compound-"));
    try {
      mkdirSync(join(source, "lib"), { recursive: true });
      mkdirSync(join(source, "assets"), { recursive: true });
      writeFileSync(join(source, "compound.media.ts"), 'import { value } from "./lib/value.js";\nexport default value;\n');
      writeFileSync(join(source, "lib", "value.ts"), "export const value = 1;\n");
      writeFileSync(join(source, "assets", "logo.svg"), "<svg/>\n");
      writeFileSync(join(examples, "_templates.json"), "{}\n");
      mkdirSync(join(root, "media"));
      vi.stubEnv("SUPERIMG_EXAMPLES_ROOT", examples);

      const result = copyExampleIntoProject(root, "compound", "renamed");

      expect([...result.filesWritten].sort()).toEqual([
        "media/assets/logo.svg",
        "media/renamed.media.ts",
        "media/lib/value.ts",
      ].sort());
      expect(existsSync(join(root, "media", "renamed.media.ts"))).toBe(true);
      expect(existsSync(join(root, "media", "lib", "value.ts"))).toBe(true);
      expect(existsSync(join(root, "media", "assets", "logo.svg"))).toBe(true);
    } finally {
      vi.unstubAllEnvs();
      rmSync(examples, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects unsafe destination names and preflights companion collisions", () => {
    const examples = mkdtempSync(join(tmpdir(), "si-examples-safe-"));
    const source = join(examples, "basics", "compound");
    const root = mkdtempSync(join(tmpdir(), "si-compound-safe-"));
    try {
      mkdirSync(source, { recursive: true });
      mkdirSync(join(root, "media"));
      writeFileSync(join(source, "compound.media.ts"), "export default {};\n");
      writeFileSync(join(source, "helper.ts"), "export {};\n");
      writeFileSync(join(examples, "_templates.json"), "{}\n");
      vi.stubEnv("SUPERIMG_EXAMPLES_ROOT", examples);

      expect(() => copyExampleIntoProject(root, "compound", "../../escape")).toThrow(
        /Invalid destination name/,
      );
      writeFileSync(join(root, "media", "helper.ts"), "user work\n");
      expect(() => copyExampleIntoProject(root, "compound", "safe")).toThrow(/Already exists/);
      expect(existsSync(join(root, "media", "safe.media.ts"))).toBe(false);
      expect(readFileSync(join(root, "media", "helper.ts"), "utf8")).toBe("user work\n");
    } finally {
      vi.unstubAllEnvs();
      rmSync(examples, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects example selectors that escape the examples root", () => {
    const parent = mkdtempSync(join(tmpdir(), "si-examples-escape-"));
    const examples = join(parent, "examples");
    const outside = join(parent, "outside");
    const root = mkdtempSync(join(tmpdir(), "si-example-destination-"));
    try {
      mkdirSync(examples);
      mkdirSync(outside);
      mkdirSync(join(root, "media"));
      writeFileSync(join(examples, "_templates.json"), "{}\n");
      writeFileSync(join(outside, "outside.media.ts"), "export default {};\n");
      vi.stubEnv("SUPERIMG_EXAMPLES_ROOT", examples);

      expect(() => copyExampleIntoProject(root, "../outside")).toThrow(
        /must stay under the examples root/,
      );
      expect(existsSync(join(root, "media", "outside.media.ts"))).toBe(false);
    } finally {
      vi.unstubAllEnvs();
      rmSync(parent, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("realpath-confines a symlinked selected example directory", () => {
    const parent = mkdtempSync(join(tmpdir(), "si-source-symlink-"));
    const examples = join(parent, "examples");
    const outside = join(parent, "outside");
    const root = mkdtempSync(join(tmpdir(), "si-source-symlink-destination-"));
    try {
      mkdirSync(join(examples, "basics"), { recursive: true });
      mkdirSync(outside);
      mkdirSync(join(root, "media"));
      writeFileSync(join(examples, "_templates.json"), "{}\n");
      writeFileSync(join(outside, "linked.media.ts"), "export default {};\n");
      symlinkSync(outside, join(examples, "basics", "linked"), "dir");
      vi.stubEnv("SUPERIMG_EXAMPLES_ROOT", examples);

      expect(() => copyExampleIntoProject(root, "linked")).toThrow(
        /Example source escapes its allowed root through a symlink/,
      );
      expect(existsSync(join(root, "media", "linked.media.ts"))).toBe(false);
    } finally {
      vi.unstubAllEnvs();
      rmSync(parent, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects symlinked project, media, and nested destination paths", () => {
    const examples = mkdtempSync(join(tmpdir(), "si-destination-symlink-examples-"));
    const source = join(examples, "basics", "compound");
    const parent = mkdtempSync(join(tmpdir(), "si-destination-symlink-"));
    try {
      mkdirSync(join(source, "lib"), { recursive: true });
      writeFileSync(join(source, "compound.media.ts"), "export default {};\n");
      writeFileSync(join(source, "lib", "helper.ts"), "export {};\n");
      writeFileSync(join(examples, "_templates.json"), "{}\n");
      vi.stubEnv("SUPERIMG_EXAMPLES_ROOT", examples);

      const actualProject = join(parent, "actual-project");
      const projectLink = join(parent, "project-link");
      mkdirSync(join(actualProject, "media"), { recursive: true });
      symlinkSync(actualProject, projectLink, "dir");
      expect(() => copyExampleIntoProject(projectLink, "compound")).toThrow(
        /Project root cannot be a symlink/,
      );

      const mediaProject = join(parent, "media-project");
      const outsideMedia = join(parent, "outside-media");
      mkdirSync(mediaProject);
      mkdirSync(outsideMedia);
      symlinkSync(outsideMedia, join(mediaProject, "media"), "dir");
      expect(() => copyExampleIntoProject(mediaProject, "compound")).toThrow(
        /Content path contains unsupported symlink/,
      );
      expect(existsSync(join(outsideMedia, "compound.media.ts"))).toBe(false);

      const nestedProject = join(parent, "nested-project");
      const outsideLib = join(parent, "outside-lib");
      mkdirSync(join(nestedProject, "media"), { recursive: true });
      mkdirSync(outsideLib);
      symlinkSync(outsideLib, join(nestedProject, "media", "lib"), "dir");
      expect(() => copyExampleIntoProject(nestedProject, "compound")).toThrow(
        /Example destination contains unsupported symlink/,
      );
      expect(existsSync(join(nestedProject, "media", "compound.media.ts"))).toBe(false);
      expect(existsSync(join(outsideLib, "helper.ts"))).toBe(false);

      const scaffoldParent = join(parent, "scaffold-parent");
      const outsideProjects = join(parent, "outside-projects");
      mkdirSync(scaffoldParent);
      mkdirSync(outsideProjects);
      symlinkSync(outsideProjects, join(scaffoldParent, "linked"), "dir");
      expect(() => scaffoldProject({
        projectRoot: join(scaffoldParent, "linked", "demo"),
        parentDir: scaffoldParent,
      })).toThrow(/Project path contains unsupported symlink/);
      expect(existsSync(join(outsideProjects, "demo"))).toBe(false);
    } finally {
      vi.unstubAllEnvs();
      rmSync(examples, { recursive: true, force: true });
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("refuses non-empty directory and parent escape", () => {
    const parent = mkdtempSync(join(tmpdir(), "si-scaf-p2-"));
    const root = join(parent, "taken");
    mkdirSync(root);
    writeFileSync(join(root, "x.txt"), "nope");
    try {
      expect(() =>
        scaffoldProject({ projectRoot: root, parentDir: parent }),
      ).toThrow(/not empty/);
      expect(() =>
        scaffoldProject({
          projectRoot: join(parent, "..", "escape"),
          parentDir: parent,
        }),
      ).toThrow(/escapes parent/);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
