import type { Program, SequenceProgram, Use } from "@superimg/types";

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function assertId(id: string): void {
  if (!SAFE_ID.test(id) || id === "." || id === "..") {
    throw new TypeError("sequence(): every id must be a non-empty safe path segment");
  }
}

function assertAcyclic(program: Program, stack: Set<object>): void {
  if (stack.has(program)) throw new TypeError("sequence(): cyclic Program graph");
  stack.add(program);
  try {
    if (program.op === "sequence" || program.op === "together") {
      for (const use of program.parts) {
        if (use.content && typeof use.content === "object" && "op" in use.content) {
          assertAcyclic(use.content as Program, stack);
        }
      }
    } else {
      for (const content of Object.values(program.paths)) {
        if (content && typeof content === "object" && "op" in content) {
          assertAcyclic(content as Program, stack);
        }
      }
    }
  } finally {
    stack.delete(program);
  }
}

/**
 * Retain a named ordered relationship between authored works.
 * This returns an immutable Program; it does not choose a clock or flatten children.
 */
export function sequence(parts: readonly Use[]): SequenceProgram {
  if (parts.length === 0) throw new TypeError("sequence(): requires at least one part");
  const ids = new Set<string>();
  const copied = parts.map((part) => {
    if (!part || typeof part !== "object" || typeof part.id !== "string" || !part.content) {
      throw new TypeError("sequence(): every part requires an id and content");
    }
    assertId(part.id);
    if (ids.has(part.id)) throw new TypeError(`sequence(): duplicate sibling id "${part.id}"`);
    if (typeof part.content === "object" && part.content !== null && "composition" in part.content && part.content.composition) {
      throw new TypeError("sequence(): a time() projection cannot be used as a child; nest its Program instead");
    }
    ids.add(part.id);
    return Object.freeze({ ...part });
  });
  const program = Object.freeze({ op: "sequence" as const, parts: Object.freeze(copied) });
  assertAcyclic(program, new Set<object>());
  return program;
}
