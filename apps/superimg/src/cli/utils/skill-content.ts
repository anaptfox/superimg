//! Load bundled SuperImg skill content for AGENTS.md

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Paths to try for skills/superimg/SKILL.md (works in dev and published package)
 */
const CANDIDATE_PATHS = [
  join(__dirname, "..", "skills", "superimg", "SKILL.md"), // dist/ chunk -> apps/superimg/skills
  join(__dirname, "..", "..", "..", "skills", "superimg", "SKILL.md"), // dist/cli/utils -> apps/superimg/skills
  join(__dirname, "..", "..", "..", "..", "..", "skills", "superimg", "SKILL.md"), // src/cli/utils -> repo root
];

export function getSkillContent(): string {
  for (const p of CANDIDATE_PATHS) {
    if (existsSync(p)) {
      const raw = readFileSync(p, "utf-8");
      return raw.replace(/^---\n[\s\S]*?\n---\n\n?/, "");
    }
  }
  throw new Error("SuperImg skill (SKILL.md) not found. Rebuild the package.");
}
