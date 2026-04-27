//! Public API for the canonical SuperImg skill.
//!
//! All content is embedded at build time from <repo>/skills/superimg/.
//! Consumers (the superimg CLI and @superimg/mcp) import from here instead of
//! reading the filesystem at runtime.

import {
  SKILL_VERSION,
  SKILL_NAME,
  SKILL_DESCRIPTION,
  SKILL_BODY,
  REFERENCES,
  EXAMPLES,
} from "./_generated.js";

export interface SkillFrontmatter {
  name: string;
  description: string;
  version: string;
}

export type SkillFormat = "raw" | "managed-block";

export interface SkillFormatOptions {
  /**
   * - "raw": just the SKILL.md body (no frontmatter, no markers).
   * - "managed-block": body wrapped in BEGIN/END markers stamped with the version.
   *   Safe to embed in user-managed files (AGENTS.md etc); update commands rewrite
   *   only the block contents, leaving surrounding user content untouched.
   */
  format?: SkillFormat;
}

export const BLOCK_BEGIN_PREFIX = "<!-- BEGIN superimg-skill";
export const BLOCK_END = "<!-- END superimg-skill -->";

/** Matches a managed block begin marker and captures the version. */
export const BLOCK_BEGIN_REGEX = /<!-- BEGIN superimg-skill v([0-9][^\s]*)[^>]*-->/;

/** Matches an entire managed block (BEGIN + body + END). Multiline. */
export const MANAGED_BLOCK_REGEX = /<!-- BEGIN superimg-skill v[^>]*-->[\s\S]*?<!-- END superimg-skill -->/;

export function getSkillFrontmatter(): SkillFrontmatter {
  return { name: SKILL_NAME, description: SKILL_DESCRIPTION, version: SKILL_VERSION };
}

export function getSkillVersion(): string {
  return SKILL_VERSION;
}

export function getSkillName(): string {
  return SKILL_NAME;
}

export function getSkillDescription(): string {
  return SKILL_DESCRIPTION;
}

/**
 * Returns the canonical SKILL.md body.
 *
 * - `raw`: no markers, no frontmatter — for files you own end-to-end (e.g.
 *   `.claude/skills/superimg/SKILL.md`, `.cursor/rules/superimg.mdc`).
 * - `managed-block`: BEGIN/END-wrapped — for shared files you co-own with the
 *   user (e.g. `AGENTS.md`).
 */
export function getSkillContent(options: SkillFormatOptions = {}): string {
  const format = options.format ?? "raw";
  if (format === "raw") return SKILL_BODY;
  return buildManagedBlock();
}

/** Build the managed block for the currently bundled skill. */
export function buildManagedBlock(): string {
  return [
    `<!-- BEGIN superimg-skill v${SKILL_VERSION} — managed by \`superimg skill update\`; do not edit -->`,
    SKILL_BODY.trimEnd(),
    BLOCK_END,
  ].join("\n");
}

/**
 * Replace any existing managed block in `content` with `block`.
 * If no managed block exists, appends `block` (with a leading blank line if needed).
 */
export function replaceManagedBlock(content: string, block: string): string {
  if (MANAGED_BLOCK_REGEX.test(content)) {
    return content.replace(MANAGED_BLOCK_REGEX, block);
  }
  const trimmed = content.replace(/\s+$/, "");
  if (trimmed.length === 0) return block + "\n";
  return trimmed + "\n\n" + block + "\n";
}

/** Returns the version stamped in a managed block within `content`, or null. */
export function findManagedBlockVersion(content: string): string | null {
  const m = content.match(BLOCK_BEGIN_REGEX);
  return m ? m[1] ?? null : null;
}

/** Strip the managed block from a file (used by `skill remove`). */
export function stripManagedBlock(content: string): string {
  return content.replace(MANAGED_BLOCK_REGEX, "").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

export function listReferences(): string[] {
  return Object.keys(REFERENCES).sort();
}

export function getReference(name: string): string | null {
  return REFERENCES[name] ?? null;
}

export function listExamples(): string[] {
  return Object.keys(EXAMPLES).sort();
}

export function getExample(name: string): string | null {
  return EXAMPLES[name] ?? null;
}

/** All references as an object — useful for hosts that materialize references/ on disk. */
export function getAllReferences(): Record<string, string> {
  return { ...REFERENCES };
}

/** All examples as an object — useful for hosts that materialize examples/ on disk. */
export function getAllExamples(): Record<string, string> {
  return { ...EXAMPLES };
}
