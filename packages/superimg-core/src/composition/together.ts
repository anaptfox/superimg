import type { PlacedUse, Program, TogetherProgram } from "@superimg/types";

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function assertProgramAcyclic(program: Program, stack: Set<object>): void {
  if (stack.has(program)) throw new TypeError("together(): cyclic Program graph");
  stack.add(program);
  try {
    if (program.op === "choose") {
      for (const content of Object.values(program.paths)) {
        if (content && typeof content === "object" && "op" in content) assertProgramAcyclic(content as Program, stack);
      }
      return;
    }
    for (const use of program.parts) {
      if (use.content && typeof use.content === "object" && "op" in use.content) assertProgramAcyclic(use.content as Program, stack);
    }
  } finally {
    stack.delete(program);
  }
}

function assertRect(rect: PlacedUse["rect"]): void {
  if (!rect || !Number.isFinite(rect.x) || !Number.isFinite(rect.y) || !Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) {
    throw new TypeError("together(): every part requires a finite rect with positive width and height");
  }
}

/** Place named works on one shared clock. The group ends when its longest child ends. */
export function together(
  parts: readonly PlacedUse[],
  options: Readonly<{ end: "hold" | "hide"; size?: Readonly<{ width: number; height: number }> }>,
): TogetherProgram {
  if (parts.length === 0) throw new TypeError("together(): requires at least one part");
  if (options?.end !== "hold" && options?.end !== "hide") {
    throw new TypeError("together(): requires an explicit end of \"hold\" or \"hide\"");
  }
  if (options.size && (!Number.isInteger(options.size.width) || !Number.isInteger(options.size.height) || options.size.width <= 0 || options.size.height <= 0)) {
    throw new TypeError("together(): size must use positive integer pixels");
  }
  const ids = new Set<string>();
  const copied = parts.map((part) => {
    if (!part || typeof part !== "object" || typeof part.id !== "string" || !part.content) {
      throw new TypeError("together(): every part requires an id and content");
    }
    if (!SAFE_ID.test(part.id) || part.id === "." || part.id === "..") {
      throw new TypeError("together(): every id must be a non-empty safe path segment");
    }
    if (ids.has(part.id)) throw new TypeError(`together(): duplicate sibling id "${part.id}"`);
    if (part.fit !== "contain" && part.fit !== "cover" && part.fit !== "reflow") throw new TypeError("together(): every part requires contain, cover, or reflow fit");
    assertRect(part.rect);
    ids.add(part.id);
    return Object.freeze({ ...part, rect: Object.freeze({ ...part.rect }) });
  });
  const program = Object.freeze({ op: "together" as const, parts: Object.freeze(copied), end: options.end, ...(options.size ? { size: Object.freeze({ ...options.size }) } : {}) });
  assertProgramAcyclic(program, new Set<object>());
  return program;
}
