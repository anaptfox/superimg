import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  readdirSync,
  statSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

const EXCLUDED_DIRECTORIES = new Set([
  "node_modules", ".next", ".nitro", ".output", ".vinxi", ".astro",
  ".vercel", "dist", "out", ".git", "build", "coverage", ".turbo",
  ".claude", ".superimg", ".superimg-drafts", ".private",
  // Author scratch. Discovery ignores it, and export does not record a take.
  "scratch",
]);

export type DiscoveredMediaSource = Readonly<{
  name: string;
  shortName: string;
  entrypoint: string;
  relativePath: string;
}>;

export type ResolvedMediaSource = Readonly<{
  templatePath: string;
  relativePath: string;
  sourceId: string;
}>;

export function isMediaSourceFile(filename: string): boolean {
  return filename.endsWith(".media.ts") || filename.endsWith(".media.js");
}

export function normalizeProjectRoot(projectRoot: string): string {
  const root = realpathSync(resolve(projectRoot));
  if (!statSync(root).isDirectory()) {
    throw new Error(`Media project root must be a directory: ${projectRoot}`);
  }
  return root;
}

export function discoverMediaSources(projectRoot: string): DiscoveredMediaSource[] {
  const root = normalizeProjectRoot(projectRoot);
  const sources: DiscoveredMediaSource[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(entry.name) && !existsSync(join(path, "package.json"))) walk(path);
        continue;
      }
      if (!entry.isFile() || !isMediaSourceFile(entry.name)) continue;
      const relativePath = relative(root, path).replaceAll(sep, "/");
      const name = stripMediaExtension(relativePath);
      const parts = relativePath.split("/");
      const base = stripMediaExtension(parts.at(-1) ?? "");
      const parent = parts.at(-2);
      const shortName = parent && (base === parent || base === "index") ? parent : base;
      sources.push(Object.freeze({ name, shortName, entrypoint: path, relativePath }));
    }
  };
  walk(root);
  return sources.sort((left, right) => left.name.localeCompare(right.name));
}

export function resolveMediaSource(
  projectRoot: string,
  requested: string,
): ResolvedMediaSource {
  if (!requested.trim()) throw new TypeError("Media source selector is required");
  const root = normalizeProjectRoot(projectRoot);
  const direct = resolve(root, requested);
  if (existsSync(direct)) return resolvedSource(root, direct);
  if (isAbsolute(requested)) throw new Error(`Media source does not exist: ${requested}`);
  const matches = discoverMediaSources(root).filter((source) =>
    source.name === requested ||
    source.shortName === requested ||
    source.relativePath === requested
  );
  if (matches.length === 0) {
    throw new Error(`No media source found for ${JSON.stringify(requested)}`);
  }
  if (matches.length > 1) {
    throw new Error(
      `Media source ${JSON.stringify(requested)} is ambiguous; use its project-relative path`,
    );
  }
  return resolvedSource(root, matches[0]!.entrypoint);
}

export function readMediaSource(source: ResolvedMediaSource): string {
  return readFileSync(source.templatePath, "utf8");
}

function resolvedSource(root: string, filename: string): ResolvedMediaSource {
  if (!isMediaSourceFile(filename)) {
    throw new Error(`Media source must use the *.media.ts or *.media.js extension: ${filename}`);
  }
  const link = lstatSync(filename);
  if (link.isSymbolicLink() || !link.isFile()) {
    throw new Error(`Media source must be a regular non-symlink file: ${filename}`);
  }
  const realFile = realpathSync(filename);
  const back = relative(root, realFile);
  if (!back || back === ".." || back.startsWith(`..${sep}`) || isAbsolute(back)) {
    throw new Error(`Media source must be inside the project root: ${filename}`);
  }
  const relativePath = back.replaceAll(sep, "/");
  return Object.freeze({
    templatePath: realFile,
    relativePath,
    sourceId: stripMediaExtension(relativePath),
  });
}

function stripMediaExtension(path: string): string {
  return path.replace(/\.media\.(?:ts|js)$/, "");
}
