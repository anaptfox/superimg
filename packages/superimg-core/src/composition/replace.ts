import type { CompositionContent, Program } from "@superimg/types";

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function parsePath(path: string): string[] {
  if (typeof path !== "string" || path.length === 0) {
    throw new TypeError("replaceOccurrence(): path must name an occurrence");
  }
  const segments = path.split("/");
  if (segments.some((segment) => !SAFE_ID.test(segment) || segment === "." || segment === "..")) {
    throw new TypeError("replaceOccurrence(): path must contain safe non-empty segments");
  }
  return segments;
}

/** Replace one qualified occurrence, preserving its identity and placement metadata. */
export function replaceOccurrence(
  program: Program,
  path: string,
  replacement: CompositionContent,
): Program {
  const segments = parsePath(path);
  if (!replacement || typeof replacement !== "object") {
    throw new TypeError("replaceOccurrence(): replacement content is required");
  }

  function visit(current: Program, depth: number): Program {
    const id = segments[depth]!;
    const fullPath = segments.slice(0, depth + 1).join("/");
    const descend = (content: CompositionContent): CompositionContent => {
      if (depth === segments.length - 1) return replacement;
      if (typeof content !== "object" || content === null || !("op" in content)) {
        throw new TypeError(`replaceOccurrence(): "${fullPath}" is not a nested Program`);
      }
      return visit(content as Program, depth + 1);
    }

    if (current.op === "sequence" || current.op === "together") {
      const index = current.parts.findIndex((part) => part.id === id);
      if (index < 0) throw new TypeError(`replaceOccurrence(): occurrence "${fullPath}" was not found`);
      const parts = [...current.parts];
      const use = parts[index]!;
      parts[index] = Object.freeze({ ...use, content: descend(use.content) });
      return Object.freeze({ ...current, parts: Object.freeze(parts) }) as Program;
    }

    if (!Object.hasOwn(current.paths, id)) {
      throw new TypeError(`replaceOccurrence(): choice branch "${fullPath}" was not found`);
    }
    const paths = { ...current.paths, [id]: descend(current.paths[id]!) };
    return Object.freeze({ ...current, paths: Object.freeze(paths) });
  }

  return visit(program, 0);
}
