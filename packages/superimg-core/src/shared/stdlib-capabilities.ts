import type { RuntimeTemplate } from "../rendering/runtime-info.js";
import type { Stdlib } from "@superimg/types";
import { isComposedTemplate } from "@superimg/types";
import { stdlib } from "./stdlib.js";

export type StdlibCapability = "code" | "rough" | "katex" | "lottie" | "mermaid" | "three";

const loaded = new Set<StdlibCapability>();
const loading = new Map<StdlibCapability, Promise<void>>();

function renderSources(template: RuntimeTemplate): string {
  const sources = [template.render.toString()];
  if (isComposedTemplate(template)) {
    for (const scene of template.scenes) sources.push(scene.template.render.toString());
  }
  return sources.join("\n");
}

export function detectStdlibCapabilities(template: RuntimeTemplate): StdlibCapability[] {
  const source = renderSources(template);
  const capabilities: StdlibCapability[] = [];
  if (/\bstd\.code\b/.test(source)) capabilities.push("code");
  if (/\bstd\.svg\.rough\b/.test(source)) capabilities.push("rough");
  if (/\bstd\.viz\.katex\b|\bstd\.viz\.(?:equation|equationSteps|equationMatch|katexCss)\b/.test(source)) capabilities.push("katex");
  if (/\bstd\.viz\.lottie\b/.test(source)) capabilities.push("lottie");
  if (/\bstd\.viz\.mermaid\b/.test(source)) capabilities.push("mermaid");
  if (/\bstd\.viz\.three\b/.test(source)) capabilities.push("three");
  return capabilities;
}

async function loadCapability(capability: StdlibCapability): Promise<void> {
  if (loaded.has(capability)) return;
  const pending = loading.get(capability);
  if (pending) return pending;

  const task = (async () => {
    if (capability === "code") {
      stdlib.code = await import("@superimg/stdlib/code");
    } else if (capability === "rough") {
      stdlib.svg.rough = await import("@superimg/stdlib/svg/rough");
    } else if (capability === "three") {
      stdlib.viz.three = await import("@superimg/stdlib/viz/three");
    } else if (capability === "lottie") {
      const module = await import("@superimg/stdlib/viz/lottie");
      Object.assign(stdlib.viz, {
        lottie: module.lottie,
        lottieApi: module,
        lottieDurationFrames: module.durationFrames,
        lottieDurationSeconds: module.durationSeconds,
        LOTTIE_VERSION: module.LOTTIE_VERSION,
        LOTTIE_MODULE_LIGHT: module.LOTTIE_MODULE_LIGHT,
        LOTTIE_MODULE_FULL: module.LOTTIE_MODULE_FULL,
      });
    } else if (capability === "mermaid") {
      const module = await import("@superimg/stdlib/viz/mermaid");
      stdlib.viz.mermaid = module.mermaid;
    } else {
      const module = await import("@superimg/stdlib/viz/katex");
      Object.assign(stdlib.viz, {
        equation: module.equation,
        equationSteps: module.equationSteps,
        equationMatch: module.equationMatch,
        parseEquationSteps: module.parseEquationSteps,
        katexCss: module.css,
        katex: module,
      });
    }
    loaded.add(capability);
  })().finally(() => loading.delete(capability));
  loading.set(capability, task);
  return task;
}

export async function prepareStdlibForTemplate(template: RuntimeTemplate): Promise<void> {
  await Promise.all(detectStdlibCapabilities(template).map(loadCapability));
}

export function getLoadedStdlibCapabilities(): readonly StdlibCapability[] {
  return [...loaded].sort();
}

export type PreparedStdlib = Stdlib;
