// Materialize the canonical SuperImg skill into the Codex plugin tree.
//
// Codex plugins reference a skills directory with one or more skill folders,
// each containing a SKILL.md (Anthropic skill format: YAML frontmatter + body).
// We reconstruct that file from @superimg/skill plus the references/ and
// examples/ subdirs Codex's skill loader will surface as additional context.

import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getSkillName,
  getSkillDescription,
  getSkillContent,
  getAllReferences,
  getAllExamples,
} from "@superimg/skill";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, "..");
const SKILL_ROOT = join(PKG_ROOT, "plugin", "skills", "superimg");

function ensureDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

function generateSkillFile(): string {
  const fm = `---
name: ${getSkillName()}
description: >
  ${getSkillDescription()}
---

`;
  return fm + getSkillContent({ format: "raw" });
}

function main(): void {
  // Clear stale generated content (keeps SKILL.md, references/, examples/
  // strictly in sync with the canonical source).
  if (existsSync(SKILL_ROOT)) rmSync(SKILL_ROOT, { recursive: true, force: true });

  const skillPath = join(SKILL_ROOT, "SKILL.md");
  ensureDir(skillPath);
  writeFileSync(skillPath, generateSkillFile());

  for (const [name, body] of Object.entries(getAllReferences())) {
    const refPath = join(SKILL_ROOT, "references", `${name}.md`);
    ensureDir(refPath);
    writeFileSync(refPath, body);
  }
  for (const [name, body] of Object.entries(getAllExamples())) {
    const exPath = join(SKILL_ROOT, "examples", `${name}.ts`);
    ensureDir(exPath);
    writeFileSync(exPath, body);
  }

  const refCount = Object.keys(getAllReferences()).length;
  const exCount = Object.keys(getAllExamples()).length;
  console.log(
    `@superimg/codex-plugin: generated SKILL.md + ${refCount} reference(s) + ${exCount} example(s) at ${SKILL_ROOT}`
  );
}

main();
