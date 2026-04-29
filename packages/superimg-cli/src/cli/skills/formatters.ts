//! Per-format writers and removers. Each takes an absolute path and applies the
//! appropriate transformation to install, update, or remove the SuperImg skill.

import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, statSync, readdirSync, rmdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  buildManagedBlock,
  replaceManagedBlock,
  findManagedBlockVersion,
  stripManagedBlock,
  getSkillContent,
  getAllReferences,
  getAllExamples,
  getSkillName,
  getSkillDescription,
} from "@superimg/skill";
import type { FormatId } from "./hosts.js";

export interface WriteOptions {
  /** Skip work if the target file exists with the same version stamp. */
  updateOnly?: boolean;
}

export type WriteStatus = "wrote" | "updated" | "noop";

export interface WriteResult {
  status: WriteStatus;
  path: string;
  /** Version found in an existing managed block before the write. */
  previousVersion?: string | null;
}

export interface RemoveResult {
  status: "removed" | "stripped" | "absent";
  path: string;
}

const CURSOR_MDC_FRONTMATTER =
  `---
description: "SuperImg video generation framework. Use when working with superimg templates or video rendering."
globs: "*.ts,*.tsx,*.js,*.jsx"
alwaysApply: false
---

`;

function ensureDirFor(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

function writeManagedBlockFile(path: string, opts: WriteOptions): WriteResult {
  const exists = existsSync(path);
  if (!exists && opts.updateOnly) return { status: "noop", path };

  const existing = exists ? readFileSync(path, "utf-8") : "";
  const previousVersion = exists ? findManagedBlockVersion(existing) : null;
  const block = buildManagedBlock();
  const next = replaceManagedBlock(existing, block);

  ensureDirFor(path);
  writeFileSync(path, next);
  return { status: exists ? "updated" : "wrote", path, previousVersion };
}

function writeRawFile(path: string, content: string, opts: WriteOptions): WriteResult {
  const exists = existsSync(path);
  if (!exists && opts.updateOnly) return { status: "noop", path };

  ensureDirFor(path);
  writeFileSync(path, content);
  return { status: exists ? "updated" : "wrote", path };
}

function writeCursorMdc(path: string, opts: WriteOptions): WriteResult {
  return writeRawFile(path, CURSOR_MDC_FRONTMATTER + getSkillContent({ format: "raw" }), opts);
}

function writeClaudeSkillDir(skillMdPath: string, opts: WriteOptions): WriteResult {
  const exists = existsSync(skillMdPath);
  if (!exists && opts.updateOnly) return { status: "noop", path: skillMdPath };

  const skillFile =
    `---
name: ${getSkillName()}
description: >
  ${getSkillDescription()}
---

` + getSkillContent({ format: "raw" });

  ensureDirFor(skillMdPath);
  writeFileSync(skillMdPath, skillFile);

  const skillDir = dirname(skillMdPath);
  for (const [name, body] of Object.entries(getAllReferences())) {
    const refPath = join(skillDir, "references", `${name}.md`);
    ensureDirFor(refPath);
    writeFileSync(refPath, body);
  }
  for (const [name, body] of Object.entries(getAllExamples())) {
    const exPath = join(skillDir, "examples", `${name}.ts`);
    ensureDirFor(exPath);
    writeFileSync(exPath, body);
  }

  return { status: exists ? "updated" : "wrote", path: skillMdPath };
}

export function writeForFormat(format: FormatId, path: string, opts: WriteOptions = {}): WriteResult {
  switch (format) {
    case "agents-md":
    case "gemini-md":
    case "copilot-instructions":
    case "rules-file":
      return writeManagedBlockFile(path, opts);
    case "cursor-mdc":
      return writeCursorMdc(path, opts);
    case "claude-skill-dir":
      return writeClaudeSkillDir(path, opts);
    default: {
      const _exhaust: never = format;
      throw new Error(`Unhandled format: ${String(_exhaust)}`);
    }
  }
}

export function removeForFormat(format: FormatId, path: string): RemoveResult {
  if (!existsSync(path)) return { status: "absent", path };

  switch (format) {
    case "agents-md":
    case "gemini-md":
    case "copilot-instructions":
    case "rules-file": {
      const existing = readFileSync(path, "utf-8");
      const stripped = stripManagedBlock(existing);
      if (stripped.trim().length === 0) {
        rmSync(path);
        return { status: "removed", path };
      }
      writeFileSync(path, stripped);
      return { status: "stripped", path };
    }
    case "cursor-mdc": {
      rmSync(path);
      pruneEmptyDirs(dirname(path), 2);
      return { status: "removed", path };
    }
    case "claude-skill-dir": {
      const skillDir = dirname(path);
      try {
        if (statSync(skillDir).isDirectory()) {
          rmSync(skillDir, { recursive: true, force: true });
        }
      } catch {
        // dir disappeared between checks — fine
      }
      pruneEmptyDirs(dirname(skillDir), 2);
      return { status: "removed", path };
    }
    default: {
      const _exhaust: never = format;
      throw new Error(`Unhandled format: ${String(_exhaust)}`);
    }
  }
}

/** Walk up from `dir`, removing each directory that's empty. Stops after `maxLevels` ascents. */
function pruneEmptyDirs(dir: string, maxLevels: number): void {
  let current = dir;
  for (let i = 0; i < maxLevels; i++) {
    try {
      if (!existsSync(current)) return;
      const entries = readdirSync(current);
      if (entries.length > 0) return;
      rmdirSync(current);
      current = dirname(current);
    } catch {
      return;
    }
  }
}

/** Read the version stamped in an existing target file, if any. */
export function readInstalledVersion(format: FormatId, path: string): string | null {
  if (!existsSync(path)) return null;
  switch (format) {
    case "agents-md":
    case "gemini-md":
    case "copilot-instructions":
    case "rules-file":
      return findManagedBlockVersion(readFileSync(path, "utf-8"));
    case "cursor-mdc":
    case "claude-skill-dir":
      // These formats don't carry a managed block; presence == "installed at bundled version"
      return existsSync(path) ? "installed" : null;
    default:
      return null;
  }
}
