//! Project scaffold = copy a monorepo example. No hand-written starter templates.
//! Used by `superimg init` and host-driven project creation.

import {
  mkdirSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
  lstatSync,
  realpathSync,
  copyFileSync,
  readFileSync,
} from "node:fs";
import { join, resolve, basename, relative, isAbsolute, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Alias → relative path under monorepo `examples/`. */
export const EXAMPLE_ALIASES: Readonly<Record<string, string>> = {
  default: "basics/hello-world",
  hello: "basics/hello-world",
  "hello-world": "basics/hello-world",
  "request-journey": "basics/request-journey",
};

export interface ScaffoldProjectOptions {
  /** Absolute path to the new project directory. */
  projectRoot: string;
  /** package.json name (defaults from directory basename). */
  name?: string;
  /**
   * Example id or alias (`hello-world`, `request-journey`, …).
   * Default: `hello-world`.
   */
  example?: string;
  /** superimg dependency version range (default "latest"). */
  superimgVersion?: string;
  /** Authored content directory relative to the project root. Defaults to media/. */
  contentDir?: string;
  /**
   * Parent directory that projectRoot must stay under (host path safety).
   */
  parentDir?: string;
}

export interface ScaffoldProjectResult {
  projectRoot: string;
  name: string;
  /** Primary media file copied into the authored content directory. */
  templatePath: string;
  /** Example key used (e.g. basics/hello-world). */
  exampleKey: string;
  filesWritten: string[];
}

function typescriptConfig(contentDir: string): string {
  const include = [...new Set(["*.ts", "media/**/*.ts", `${contentDir}/**/*.ts`])];
  return JSON.stringify({
    compilerOptions: {
      target: "ESNext",
      module: "ESNext",
      moduleResolution: "bundler",
      strict: true,
      noEmit: true,
      skipLibCheck: true,
    },
    include,
  }, null, 2) + "\n";
}

export function sanitizeProjectName(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return s || "my-superimg-project";
}

function assertUnderParent(projectRoot: string, parentDir: string): void {
  const root = resolve(projectRoot);
  const parent = resolve(parentDir);
  const rel = relative(parent, root);
  const portableRel = portablePath(rel);
  if (
    portableRel === ".." ||
    portableRel.startsWith("../") ||
    isAbsolute(rel)
  ) {
    throw new Error(
      `Project path escapes parent directory: ${projectRoot} not under ${parentDir}`,
    );
  }
  assertNoSymlinkComponents(parent, root, "Project path");
  if (existsSync(root)) {
    assertRealPathUnder(parent, root, "Project path");
  }
}

function isExamplesRoot(dir: string): boolean {
  return (
    existsSync(join(dir, "basics", "hello-world")) ||
    existsSync(join(dir, "basics", "request-journey")) ||
    existsSync(join(dir, "_templates.json"))
  );
}

/**
 * Locate examples for scaffolding:
 * 1. SUPERIMG_EXAMPLES_ROOT
 * 2. Packaged scaffold-examples next to this module (published CLI)
 * 3. Walk up for monorepo examples/
 */
export function findExamplesRoot(startDir = process.cwd()): string | null {
  if (process.env.SUPERIMG_EXAMPLES_ROOT) {
    const env = resolve(process.env.SUPERIMG_EXAMPLES_ROOT);
    if (isExamplesRoot(env)) return env;
  }

  // Published / built package: packages/superimg-cli/scaffold-examples or dist/scaffold-examples
  const here = dirname(fileURLToPath(import.meta.url));
  const packagedCandidates = [
    join(here, "scaffold-examples"),
    join(here, "..", "scaffold-examples"),
    join(here, "..", "..", "scaffold-examples"),
  ];
  for (const c of packagedCandidates) {
    if (isExamplesRoot(c)) return c;
  }

  const starts = [startDir, here];
  for (const start of starts) {
    let dir = resolve(start);
    for (let i = 0; i < 12; i++) {
      const candidate = join(dir, "examples");
      if (isExamplesRoot(candidate)) return candidate;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

export function resolveExampleKey(exampleOrTemplate?: string): string {
  const raw = (exampleOrTemplate ?? "hello-world").trim().toLowerCase();
  if (EXAMPLE_ALIASES[raw]) return EXAMPLE_ALIASES[raw]!;
  // Allow category/name paths
  if (raw.includes("/")) return raw;
  // Bare name: try basics/<name>
  return `basics/${raw}`;
}

function listMediaInDir(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir)
    .filter((f) => /\.media\.(ts|js)$/i.test(f))
    .sort();
}

const EXCLUDED_EXAMPLE_ENTRIES = new Set([
  ".DS_Store",
  ".git",
  "node_modules",
  "output",
  "_park",
]);

function isExampleTestFile(name: string): boolean {
  return /\.(test|spec)\.[cm]?[jt]sx?$/i.test(name);
}

/**
 * Enumerate the portable source payload for an example. Symlinks are rejected
 * so a local examples tree cannot make scaffolding read outside its directory.
 */
function listExampleFiles(sourceDir: string): string[] {
  const files: string[] = [];
  const visit = (relativeDir: string): void => {
    const absoluteDir = join(sourceDir, relativeDir);
    for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
      if (EXCLUDED_EXAMPLE_ENTRIES.has(entry.name) || isExampleTestFile(entry.name)) continue;
      const relativePath = join(relativeDir, entry.name);
      const absolutePath = join(sourceDir, relativePath);
      const stat = lstatSync(absolutePath);
      if (stat.isSymbolicLink()) {
        throw new Error(`Example contains unsupported symlink: ${relativePath}`);
      }
      if (stat.isDirectory()) visit(relativePath);
      else if (stat.isFile()) files.push(relativePath);
    }
  };
  visit("");
  return files.sort();
}

function portablePath(path: string): string {
  return path.split(/[/\\]/).join("/");
}

function isOutside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  const portableRel = portablePath(rel);
  return (
    portableRel === ".." ||
    portableRel.startsWith("../") ||
    isAbsolute(rel)
  );
}

function assertRealPathUnder(root: string, candidate: string, label: string): void {
  const realRoot = realpathSync(root);
  const realCandidate = realpathSync(candidate);
  if (isOutside(realRoot, realCandidate)) {
    throw new Error(`${label} escapes its allowed root through a symlink: ${candidate}`);
  }
}

function assertNoSymlinkComponents(root: string, candidate: string, label: string): void {
  const absoluteRoot = resolve(root);
  const absoluteCandidate = resolve(candidate);
  if (isOutside(absoluteRoot, absoluteCandidate)) {
    throw new Error(`${label} escapes its allowed root: ${candidate}`);
  }
  const rel = relative(absoluteRoot, absoluteCandidate);
  let current = absoluteRoot;
  for (const part of rel.split(/[/\\]/).filter(Boolean)) {
    current = join(current, part);
    if (!existsSync(current)) break;
    if (lstatSync(current).isSymbolicLink()) {
      throw new Error(`${label} contains unsupported symlink: ${current}`);
    }
  }
}

function prepareContentDirectory(projectRoot: string, contentDir: string): string {
  const root = resolve(projectRoot);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`Project root is not a directory: ${root}`);
  }
  if (lstatSync(root).isSymbolicLink()) {
    throw new Error(`Project root cannot be a symlink: ${root}`);
  }
  assertSafeRelativePath(contentDir, "Content directory");
  const contentPath = resolve(root, contentDir);
  assertNoSymlinkComponents(root, contentPath, "Content path");
  if (!existsSync(contentPath)) mkdirSync(contentPath, { recursive: true });
  if (!statSync(contentPath).isDirectory() || lstatSync(contentPath).isSymbolicLink()) {
    throw new Error(`Content path must be a real directory: ${contentPath}`);
  }
  assertRealPathUnder(root, contentPath, "Content path");
  return contentPath;
}

function assertSafeRelativePath(path: string, label: string): void {
  if (!path || isAbsolute(path)) throw new Error(`${label} must be a relative path`);
  const normalized = portablePath(path);
  if (normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error(`${label} escapes the destination: ${path}`);
  }
}

function assertAvailableTargets(targets: readonly string[]): void {
  const seen = new Set<string>();
  for (const target of targets) {
    const key = resolve(target);
    if (seen.has(key)) throw new Error(`Example files collide at: ${target}`);
    seen.add(key);
    if (existsSync(target)) throw new Error(`Already exists: ${target}`);
  }
}

function copyExamplePayload(
  sourceDir: string,
  destinationDir: string,
  options: { primaryMedia: string; primaryDestination?: string; includeReadme?: boolean },
): string[] {
  const sourceFiles = listExampleFiles(sourceDir).filter(
    (path) => options.includeReadme || portablePath(path).toLowerCase() !== "readme.md",
  );
  const copies = sourceFiles.map((sourceRelative) => {
    const destinationRelative =
      sourceRelative === options.primaryMedia && options.primaryDestination
        ? options.primaryDestination
        : sourceRelative;
    assertSafeRelativePath(destinationRelative, "Example destination");
    return {
      source: join(sourceDir, sourceRelative),
      destination: join(destinationDir, destinationRelative),
    };
  });
  for (const copy of copies) {
    assertNoSymlinkComponents(destinationDir, copy.destination, "Example destination");
  }
  assertAvailableTargets(copies.map((copy) => copy.destination));
  for (const copy of copies) {
    mkdirSync(dirname(copy.destination), { recursive: true });
    copyFileSync(copy.source, copy.destination);
  }
  return copies.map((copy) => copy.destination);
}

/**
 * Resolve an example directory under examples/ and its media files.
 * Throws if examples root or the example cannot be found.
 */
export function resolveExampleSource(
  exampleOrTemplate?: string,
  cwd = process.cwd(),
): { exampleKey: string; sourceDir: string; mediaFiles: string[] } {
  const exampleKey = resolveExampleKey(exampleOrTemplate);
  const examplesRoot = findExamplesRoot(cwd);
  if (!examplesRoot) {
    throw new Error(
      "Cannot find scaffold examples. Scaffolding only copies packaged examples " +
        "(no generated starters). Expected scaffold-examples/ in the CLI package, " +
        "a monorepo examples/ tree, or SUPERIMG_EXAMPLES_ROOT.",
    );
  }
  const sourceDir = resolve(examplesRoot, exampleKey);
  const sourceRelative = relative(resolve(examplesRoot), sourceDir);
  const portableSourceRelative = portablePath(sourceRelative);
  if (
    sourceRelative === "" ||
    portableSourceRelative === ".." ||
    portableSourceRelative.startsWith("../") ||
    isAbsolute(sourceRelative)
  ) {
    throw new Error(
      `Invalid example "${exampleOrTemplate ?? ""}": resolved path must stay under the examples root.`,
    );
  }
  if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
    const aliases = Object.keys(EXAMPLE_ALIASES).join(", ");
    throw new Error(
      `Unknown example "${exampleOrTemplate ?? ""}" (resolved ${exampleKey}). ` +
      `Known aliases: ${aliases}. Or pass a path like basics/hello-world.`,
    );
  }
  assertRealPathUnder(examplesRoot, sourceDir, "Example source");
  const mediaFiles = listMediaInDir(sourceDir);
  if (mediaFiles.length === 0) {
    throw new Error(`Example ${exampleKey} has no *.media.ts / *.media.js files`);
  }
  return { exampleKey, sourceDir, mediaFiles };
}

/**
 * Create a minimal SuperImg project by copying a monorepo example into media/.
 * Does not install dependencies or download Chromium.
 */
export function scaffoldProject(
  options: ScaffoldProjectOptions,
): ScaffoldProjectResult {
  const projectRoot = resolve(options.projectRoot);
  if (options.parentDir) {
    assertUnderParent(projectRoot, options.parentDir);
  }

  const name = sanitizeProjectName(options.name ?? basename(projectRoot));
  const version = options.superimgVersion ?? "latest";
  const contentDir = options.contentDir ?? "media";
  assertSafeRelativePath(contentDir, "Content directory");
  const exampleHint = options.example;
  const { exampleKey, sourceDir, mediaFiles } = resolveExampleSource(
    exampleHint,
    projectRoot,
  );

  if (existsSync(projectRoot)) {
    const st = statSync(projectRoot);
    if (!st.isDirectory()) {
      throw new Error(`Path exists and is not a directory: ${projectRoot}`);
    }
    const entries = readdirSync(projectRoot).filter((e) => !e.startsWith("."));
    if (entries.length > 0) {
      throw new Error(
        `Directory is not empty: ${projectRoot} (contains ${entries.slice(0, 5).join(", ")}${entries.length > 5 ? "…" : ""})`,
      );
    }
  } else {
    mkdirSync(projectRoot, { recursive: true });
  }

  if (options.parentDir) {
    assertRealPathUnder(resolve(options.parentDir), projectRoot, "Project path");
  }
  const contentPath = prepareContentDirectory(projectRoot, contentDir);

  const filesWritten: string[] = [];
  const write = (abs: string, content: string) => {
    writeFileSync(abs, content);
    filesWritten.push(relative(projectRoot, abs).split(/[/\\]/).join("/"));
  };
  // Primary media = first *.media.* (stable sort).
  const primaryMedia = mediaFiles[0]!;

  const copied = copyExamplePayload(sourceDir, contentPath, { primaryMedia });
  filesWritten.push(...copied.map((path) => portablePath(relative(projectRoot, path))));

  // Keep the example README outside the content directory so it cannot affect module lookup.
  const exampleReadme = join(sourceDir, "README.md");
  if (existsSync(exampleReadme) && statSync(exampleReadme).isFile()) {
    const destination = join(projectRoot, "README.example.md");
    copyFileSync(exampleReadme, destination);
    filesWritten.push("README.example.md");
  }

  const needsTs = copied.some((path) => /\.[cm]?tsx?$/i.test(path));
  write(
    join(projectRoot, "package.json"),
    JSON.stringify(
      {
        name,
        private: true,
        type: "module",
        scripts: {
          "media:dev": "superimg dev",
          "media:list": "superimg list",
        },
        dependencies: {
          "@foxworth/superimg": version,
        },
        devDependencies: {
          "@foxworth/superimg-cli": version,
        },
      },
      null,
      2,
    ) + "\n",
  );

  if (needsTs) {
    write(join(projectRoot, "tsconfig.json"), typescriptConfig(contentDir));
  }

  // Tiny pointer so users know this is a copy, not a generated starter
  write(
    join(projectRoot, "SUPERIMG.md"),
    `# ${name}\n\n` +
      `Scaffolded by copying monorepo example \`${exampleKey}\`.\n` +
      `Edit \`${contentDir}/${primaryMedia}\`. Preview: \`npx superimg dev\`. List work: \`npx superimg list\`. Check or export a source directly with SuperImg.\n`,
  );

  return {
    projectRoot,
    name,
    templatePath: join(contentPath, primaryMedia),
    exampleKey,
    filesWritten,
  };
}

/** Copy one example into an existing project's selected media directory. */
export function copyExampleIntoProject(
  projectRoot: string,
  exampleOrTemplate: string,
  destName?: string,
  options: { contentDir?: string } = {},
): { templatePath: string; exampleKey: string; filesWritten: string[] } {
  const root = resolve(projectRoot);
  const { exampleKey, sourceDir, mediaFiles } = resolveExampleSource(
    exampleOrTemplate,
    root,
  );
  const contentDir = options.contentDir ?? "media";
  const contentPath = prepareContentDirectory(root, contentDir);

  const primary = mediaFiles[0]!;
  const ext = primary.endsWith(".js") ? ".media.js" : ".media.ts";
  const outBase =
    destName?.replace(/\.media\.(ts|js)$/i, "") ??
    primary.replace(/\.media\.(ts|js)$/i, "");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(outBase)) {
    throw new Error(
      `Invalid destination name "${destName ?? outBase}". Use letters, numbers, dots, dashes, or underscores.`,
    );
  }
  const outName = `${outBase}${ext}`;
  const dest = join(contentPath, outName);
  const sourceFiles = listExampleFiles(sourceDir).filter(
    (path) => portablePath(path).toLowerCase() !== "readme.md",
  );
  const candidateTargets = sourceFiles.map((path) =>
    join(contentPath, path === primary ? outName : path),
  );
  for (const target of candidateTargets) {
    assertNoSymlinkComponents(contentPath, target, "Example destination");
    if (existsSync(target)) {
      const stat = lstatSync(target);
      if (stat.isSymbolicLink() || !stat.isFile()) {
        throw new Error(`Existing example destination must be a regular file: ${target}`);
      }
    }
  }
  if (candidateTargets.length > 0 && candidateTargets.every((target) => existsSync(target))) {
    return {
      templatePath: dest,
      exampleKey,
      filesWritten: [],
    };
  }
  const copied = copyExamplePayload(sourceDir, contentPath, {
    primaryMedia: primary,
    primaryDestination: outName,
  });
  return {
    templatePath: dest,
    exampleKey,
    filesWritten: copied.map((path) => portablePath(relative(root, path))),
  };
}

/** List alias → example keys for help text. */
export function listScaffoldExamples(): string[] {
  return Object.entries(EXAMPLE_ALIASES).map(([alias, key]) => `${alias} → ${key}`);
}
