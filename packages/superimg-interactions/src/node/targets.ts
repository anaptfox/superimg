import { existsSync, lstatSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { hashJson } from "./provider.js";

export type MediaLogicalTargetKind = "artifact" | "publication";

export type MediaTargetResolution = Readonly<{
  targetId: string;
  /** Private host path. It never enters an interaction result. */
  rootPath: string;
  /** Stable identity frozen by host control planning. */
  registryDigest: string;
}>;

export interface MediaTargetRegistry<Context> {
  resolve(args: Readonly<{
    kind: MediaLogicalTargetKind;
    targetId: string;
    context: Context;
  }>): Promise<MediaTargetResolution> | MediaTargetResolution;
}

/** Default trusted-local targets used by the CLI and project interaction host. */
export function createProjectMediaTargetRegistry<Context>(
  projectRoot: string,
): MediaTargetRegistry<Context> {
  const root = resolve(projectRoot, "output");
  const targets = Object.freeze({
    artifact: Object.freeze({ targetId: "project-artifacts", rootPath: root }),
    publication: Object.freeze({ targetId: "project-output", rootPath: root }),
  });
  return Object.freeze({
    resolve(args: Readonly<{
      kind: MediaLogicalTargetKind;
      targetId: string;
      context: Context;
    }>): MediaTargetResolution {
      const target = targets[args.kind];
      if (args.targetId !== target.targetId) {
        throw new Error(`Unknown ${args.kind} target: ${args.targetId}`);
      }
      return Object.freeze({
        ...target,
        registryDigest: hashJson({
          schemaVersion: 0,
          kind: args.kind,
          targetId: target.targetId,
          rootPath: target.rootPath,
        }),
      });
    },
  });
}

/** Resolve a portable logical id beneath a private host-owned target root. */
export function resolveMediaTargetPath(
  resolution: MediaTargetResolution,
  logicalId: string,
): string {
  assertLogicalTargetId(logicalId);
  if (!resolution.targetId || !isAbsolute(resolution.rootPath)) {
    throw new Error("Media target registries must return an id and absolute root path");
  }
  if (!/^[a-f0-9]{64}$/.test(resolution.registryDigest)) {
    throw new Error("Media target registry digest must be SHA-256");
  }
  const root = resolve(resolution.rootPath);
  if (existsSync(root) && lstatSync(root).isSymbolicLink()) {
    throw new Error(`Media target root cannot be a symlink: ${root}`);
  }
  const path = resolve(root, logicalId);
  const back = relative(root, path);
  if (!back || back === ".." || back.startsWith(`..${sep}`) || isAbsolute(back)) {
    throw new Error(`Media target id escapes its logical target: ${JSON.stringify(logicalId)}`);
  }
  let current = root;
  for (const part of logicalId.split("/")) {
    current = join(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      throw new Error(`Media target destination cannot contain a symlink: ${current}`);
    }
  }
  return path;
}

export function assertLogicalTargetId(value: string): void {
  if (
    !value || value !== value.trim() || value.startsWith("/") || value.endsWith("/") ||
    value.includes("\\") || value.includes("\0") || value.includes(":") ||
    value.includes("?") || value.includes("#")
  ) {
    throw new Error(`Invalid logical media target id: ${JSON.stringify(value)}`);
  }
  const parts = value.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Media target id escapes its logical target: ${JSON.stringify(value)}`);
  }
}
