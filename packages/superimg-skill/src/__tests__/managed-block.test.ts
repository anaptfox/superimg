import { describe, it, expect } from "vitest";
import {
  buildManagedBlock,
  replaceManagedBlock,
  findManagedBlockVersion,
  stripManagedBlock,
  getSkillContent,
  getSkillVersion,
  BLOCK_END,
} from "../index.js";

describe("managed-block API", () => {
  it("buildManagedBlock wraps content with BEGIN/END markers and version", () => {
    const block = buildManagedBlock();
    expect(block).toMatch(/^<!-- BEGIN superimg-skill v\d/);
    expect(block).toContain(BLOCK_END);
    expect(block).toContain("# SuperImg Skill");
  });

  it("getSkillContent({ format: 'managed-block' }) matches buildManagedBlock", () => {
    expect(getSkillContent({ format: "managed-block" })).toBe(buildManagedBlock());
  });

  it("getSkillContent() defaults to raw (no markers)", () => {
    const raw = getSkillContent();
    expect(raw).not.toContain("<!-- BEGIN superimg-skill");
    expect(raw).not.toContain(BLOCK_END);
    expect(raw).toContain("# SuperImg Skill");
  });

  it("findManagedBlockVersion returns the stamped version", () => {
    const block = buildManagedBlock();
    expect(findManagedBlockVersion(block)).toBe(getSkillVersion());
  });

  it("findManagedBlockVersion returns null when no block is present", () => {
    expect(findManagedBlockVersion("# Plain markdown\n\nNo skill here.")).toBeNull();
  });

  it("replaceManagedBlock appends the block to a file with no existing block", () => {
    const original = "# Project Notes\n\nSome project-specific content.\n";
    const block = buildManagedBlock();
    const result = replaceManagedBlock(original, block);
    expect(result).toContain("# Project Notes");
    expect(result).toContain("Some project-specific content.");
    expect(result).toContain(block);
    expect(result.indexOf("# Project Notes")).toBeLessThan(result.indexOf(block));
  });

  it("replaceManagedBlock replaces an existing block in place, preserving surrounding content", () => {
    const before = "# Project\n\nUser content above.\n\n";
    const after = "\n\nUser content below.\n";
    const oldBlock = "<!-- BEGIN superimg-skill v0.0.1 -->\nold content\n<!-- END superimg-skill -->";
    const file = before + oldBlock + after;

    const newBlock = buildManagedBlock();
    const result = replaceManagedBlock(file, newBlock);

    expect(result).toContain("User content above.");
    expect(result).toContain("User content below.");
    expect(result).toContain(newBlock);
    expect(result).not.toContain("old content");
  });

  it("replaceManagedBlock writes block alone when content is empty", () => {
    const block = buildManagedBlock();
    const result = replaceManagedBlock("", block);
    expect(result).toBe(block + "\n");
  });

  it("stripManagedBlock removes the block and collapses extra blank lines", () => {
    const before = "# Project\n\nUser content.\n";
    const block = buildManagedBlock();
    const file = before + "\n" + block + "\n\nMore user content.\n";

    const stripped = stripManagedBlock(file);
    expect(stripped).toContain("User content.");
    expect(stripped).toContain("More user content.");
    expect(stripped).not.toContain("BEGIN superimg-skill");
    expect(stripped).not.toContain(BLOCK_END);
    expect(stripped).not.toMatch(/\n{3,}/);
  });

  it("stripManagedBlock is a no-op when no block is present", () => {
    const original = "# Plain notes\n\nNothing to strip.\n";
    expect(stripManagedBlock(original)).toBe(original);
  });
});
