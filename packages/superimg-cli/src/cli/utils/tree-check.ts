//! Filesystem asset checks remain host-owned; pure scanners live in core.
import { existsSync, readFileSync } from "node:fs";
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path";
import type { TreeCheckIssue } from "@superimg/core/validation";
export { buildInspectTreeSnapshot, scanTreeLayoutIssues, scanTreeSemanticIssues, missingTreeIssue, scanIdentityFlicker, INSPECT_TREE_SCHEMA_VERSION } from "@superimg/core/validation";
export type { TreeCheckIssue, SemanticBounds, SemanticGeometry, SemanticRelations, SemanticTreeNode, InspectTreeNodeSnapshot, InspectTreeSnapshot } from "@superimg/core/validation";

interface TreeLikeElement {
  type: string;
  props?: Record<string, unknown>;
  children?: readonly unknown[];
}

function isTreeLikeElement(value: unknown): value is TreeLikeElement {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

function plateName(src: string): string {
  const withoutQuery = src.split(/[?#]/, 1)[0] ?? src;
  return basename(withoutQuery, extname(withoutQuery))
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeManifestFile(root: string, file: string): string | undefined {
  if (!file || isAbsolute(file)) return undefined;
  const target = resolve(root, file);
  const rel = relative(root, target);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) return undefined;
  return target;
}

/** Validate a Plate against the atlas that `superimg plate` actually writes. */
export function scanPlateAssetIssues(
  tree: unknown,
  projectRoot: string,
  loc: { frame: number; progress: number },
): TreeCheckIssue[] {
  const issues: TreeCheckIssue[] = [];
  const visit = (value: unknown, path: string): void => {
    if (!isTreeLikeElement(value)) return;
    if (value.type === "Plate") {
      const src = typeof value.props?.src === "string" ? value.props.src : "";
      const name = plateName(src);
      const plateRoot = join(projectRoot, ".superimg", "plates", name);
      const manifestPath = join(plateRoot, "manifest.json");
      let problem: string | undefined;
      const missingFiles: string[] = [];

      if (!src || !name || !existsSync(manifestPath)) {
        problem = !src ? "Plate() has no source clip" : `compiled atlas not found for ${src}`;
      } else {
        try {
          const raw = JSON.parse(readFileSync(manifestPath, "utf8")) as {
            schemaVersion?: unknown;
            atlas?: { sheets?: Array<{ file?: unknown }> };
          };
          if (raw.schemaVersion !== 0 || !Array.isArray(raw.atlas?.sheets) || raw.atlas.sheets.length === 0) {
            problem = "compiled atlas manifest is invalid";
          } else {
            for (const sheet of raw.atlas.sheets) {
              const file = typeof sheet.file === "string" ? sheet.file : "";
              const target = safeManifestFile(plateRoot, file);
              if (!target || !existsSync(target)) missingFiles.push(file || "<missing file>");
            }
            if (missingFiles.length > 0) problem = "compiled atlas is missing sheet files";
          }
        } catch (error) {
          problem = `compiled atlas manifest is unreadable: ${error instanceof Error ? error.message : String(error)}`;
        }
      }

      if (problem) {
        const id = typeof value.props?.id === "string" ? value.props.id : undefined;
        issues.push({
          severity: "warning",
          code: "PLATE_NO_ASSET",
          message: problem,
          frame: loc.frame,
          progress: loc.progress,
          suggestion: src
            ? `Run: superimg plate ${src}`
            : "Give Plate() a source clip, then run superimg plate <source>.",
          ...(id !== undefined ? { nodeId: id } : {}),
          nodePath: path,
          details: { src, manifestPath, ...(missingFiles.length ? { missingFiles } : {}) },
        });
      }
    }
    for (const [index, child] of (value.children ?? []).entries()) {
      visit(child, `${path}/${index}`);
    }
  };
  visit(tree, "/0");
  return issues;
}
