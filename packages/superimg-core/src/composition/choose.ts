import type { ChooseProgram, CompositionContent, Program } from "@superimg/types";

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function assertProgramAcyclic(program: Program, stack: Set<object>): void {
  if (stack.has(program)) throw new TypeError("choose(): cyclic Program graph");
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

/** Retain named alternative authored paths. `time()` selects one explicitly. */
export function choose(paths: Readonly<Record<string, CompositionContent>>): ChooseProgram {
  const entries = Object.entries(paths);
  if (entries.length === 0) throw new TypeError("choose(): requires at least one path");
  const copied: Record<string, CompositionContent> = {};
  for (const [id, content] of entries) {
    if (!SAFE_ID.test(id) || id === "." || id === "..") {
      throw new TypeError("choose(): every path id must be a non-empty safe path segment");
    }
    if (!content) throw new TypeError(`choose(): path "${id}" requires content`);
    copied[id] = content;
  }
  const program = Object.freeze({ op: "choose" as const, paths: Object.freeze(copied) });
  assertProgramAcyclic(program, new Set<object>());
  return program;
}
