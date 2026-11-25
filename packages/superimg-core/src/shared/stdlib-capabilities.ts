import { createStaticStdlib, type StaticStdlib } from "./stdlib.js";
import type { RuntimeTemplate } from "../rendering/runtime-info.js";
import type { CompositionContent, InteractiveCompositionChild, Program, RetainedComposition } from "@superimg/types";
import {
  declaredStdlibCapabilities,
  STDLIB_CAPABILITIES,
  type StdlibCapability,
} from "./stdlib-capability-types.js";
import type { StdlibCapabilitySource } from "./stdlib-capability-detection.js";

export type { MediaCapabilities, MediaCapabilityName } from "@superimg/types";
export type { StdlibCapability } from "./stdlib-capability-types.js";

async function capabilitiesForTemplate(template: RuntimeTemplate): Promise<StdlibCapability[]> {
  const declared = declaredStdlibCapabilities(template);
  const composition = "composition" in template
    ? template.composition as RetainedComposition | undefined
    : undefined;
  if (declared && !composition) return declared;
  const { detectStdlibCapabilities } = await import("./stdlib-capability-detection.js");
  const seen = new Set(declared ?? detectStdlibCapabilities(template));
  if (composition) {
    const visit = (program: Program): void => {
      const children = program.op === "choose"
        ? Object.values(program.paths)
        : program.parts.map((part) => part.content);
      for (const child of children) {
        if (isProgram(child)) visit(child);
        else {
          // Composition erases each child's independent data contract. The
          // capability scanners inspect its render function, not that contract.
          const template = capabilityTemplate(child);
          for (const capability of declaredStdlibCapabilities(template) ?? detectStdlibCapabilities(template)) seen.add(capability);
        }
      }
    };
    visit(composition.program);
  }
  return STDLIB_CAPABILITIES.filter((name) => seen.has(name));
}

function capabilityTemplate(child: CompositionContent): StdlibCapabilitySource {
  if (isInteractiveChild(child)) return child.createCompositionRuntime().media;
  if (isProgram(child)) throw new TypeError("Expected a composition leaf while scanning stdlib capabilities.");
  return child;
}

function isProgram(child: CompositionContent): child is Program {
  return typeof child === "object" && child !== null && "op" in child;
}

function isInteractiveChild(child: CompositionContent): child is InteractiveCompositionChild {
  return typeof child === "object" && child !== null && "kind" in child &&
    child.kind === "interactive" && "createCompositionRuntime" in child &&
    typeof child.createCompositionRuntime === "function";
}

/**
 * Build a session-local stdlib. Optional packs are installed on cloned
 * namespaces, so one Player cannot change the capabilities of another.
 */
export async function createPreparedStdlibForTemplate(
  template: RuntimeTemplate,
): Promise<PreparedStdlib> {
  const prepared = createStaticStdlib();
  const capabilities = await capabilitiesForTemplate(template);
  if (capabilities.length > 0) {
    const { applyStdlibCapability } = await import("./stdlib-capability-loader.js");
    await Promise.all(
      capabilities.map((capability) => applyStdlibCapability(prepared, capability)),
    );
  }
  Object.freeze(prepared.svg);
  Object.freeze(prepared.viz);
  return Object.freeze(prepared);
}

export type PreparedStdlib = StaticStdlib;
