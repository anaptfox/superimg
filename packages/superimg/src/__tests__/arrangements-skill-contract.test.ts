//! Arrangements skill contract.
//!
//! The pattern registry is the single owner of what arrangements exist. The
//! skill is what agents actually read. These tests fail when the two drift,
//! so a new pattern cannot land registered-but-undocumented (or be described
//! to agents without existing).

import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ARRANGE_PATTERNS } from "@superimg/core/arrange";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const SKILL_ROOT = join(REPO_ROOT, "skills", "superimg-arrangements");
const SKILL_MD = join(SKILL_ROOT, "SKILL.md");

function skill(): string {
  return readFileSync(SKILL_MD, "utf8");
}

describe("arrangements skill contract", () => {
  it("documents every registered pattern id", () => {
    const text = skill();
    const missing = ARRANGE_PATTERNS.map((entry) => entry.id).filter(
      (id) => !text.includes(`\`${id}\``),
    );
    expect(missing).toEqual([]);
  });

  it("ships a reference doc for every registered pattern", () => {
    const missing = ARRANGE_PATTERNS.map((entry) => entry.id).filter(
      (id) => !existsSync(join(SKILL_ROOT, "references", `${id}.md`)),
    );
    expect(missing).toEqual([]);
  });

  it("links each reference doc from the skill", () => {
    const text = skill();
    const unlinked = ARRANGE_PATTERNS.map((entry) => entry.id).filter(
      (id) => !text.includes(`references/${id}.md`),
    );
    expect(unlinked).toEqual([]);
  });

  it("does not describe a pattern that is not registered", () => {
    const registered = new Set(ARRANGE_PATTERNS.map((entry) => entry.id));
    const claimed = [...skill().matchAll(/`([a-z]+(?:-[a-z]+)+)`/g)]
      .map((match) => match[1]!)
      .filter((token) => existsSync(join(SKILL_ROOT, "references", `${token}.md`)));
    const orphans = claimed.filter((token) => !registered.has(token));
    expect([...new Set(orphans)]).toEqual([]);
  });

  it("tells agents to run the admission check before rendering", () => {
    expect(skill()).toContain("superimg check spec.json");
  });
});
