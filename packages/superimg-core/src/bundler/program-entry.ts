import { selectMediaDefinition } from "../runtime/selection-value.js";
import { detectMediaCapabilitiesFromSource } from "../shared/stdlib-capability-detection.js";

export type MediaProgramSelection = Parameters<typeof selectMediaDefinition>[1];
interface ProgramContext {
  load(options: { id: string; resolveDependencies: boolean }): Promise<{ code: string | null; importedIds: string[]; dynamicallyImportedIds: string[] }>;
  resolve(id: string, importer?: string, options?: { isEntry: boolean }): Promise<{ id: string; external?: unknown } | null>;
}

/** A synthetic entry owns selection; authored exports and their source maps stay intact. */
export function createProgramEntry(sourceId: string, selection: MediaProgramSelection = {}, nativeModules: () => readonly string[] = () => []) {
  const id = `\0superimg-selection:${sourceId}`;
  return { id, plugin: {
    name: "superimg-selection",
    resolveId(request: string) { return request === id ? id : null; },
    async load(this: ProgramContext, request: string) {
      if (request !== id) return null;
      const seen = new Set<string>();
      const sources: string[] = [];
      const visit = async (context: ProgramContext, moduleId: string): Promise<void> => {
        if (seen.has(moduleId)) return;
        seen.add(moduleId);
        // Runtime/stdlib modules are not authored capability sources. In built
        // distributions their dead branches can reference external Node modules.
        if (moduleId !== sourceId && (moduleId.startsWith("\0") || /\/superimg-(?:core|stdlib|types)\//.test(moduleId))) return;
        const resolution = await context.resolve(moduleId, sourceId, { isEntry: false });
        // this.load requires a successfully resolved non-external module.
        // In 1.2, manually loading a null-resolution builtin can wait forever.
        if (!resolution || resolution.external) return;
        const info = await context.load({ ...resolution, id: moduleId, resolveDependencies: true });
        // Rolldown 1.2 returns no info after a failed preload; let its build
        // aggregate report the original resolution/parse failure.
        if (!info) return;
        if (info.code && (moduleId === sourceId || (!moduleId.startsWith("\0") && !/\/superimg-(?:core|stdlib|types)\//.test(moduleId)))) sources.push(info.code);
        for (const dependency of [...info.importedIds, ...info.dynamicallyImportedIds]) await visit(context, dependency);
      };
      await visit(this, sourceId);
      const capabilities = detectMediaCapabilitiesFromSource(sources.join("\n"));
      const nativeImports = nativeModules().map((id, index) => `import native${index} from ${JSON.stringify(id)};`).join("\n");
      const nativeValues = nativeModules().map((_, index) => `native${index}`).join(", ");
      return `import authored from ${JSON.stringify(sourceId)};
${nativeImports}
export * from ${JSON.stringify(sourceId)};
const selected = authored?.kind === "media" ? (${selectMediaDefinition.toString()})(authored, ${JSON.stringify(selection)}) : { ...authored };
${nativeValues ? `if (selected.kind === "collection") {
  selected.media = { ...selected.media, config: { ...selected.media.config, nativeModuleSets: [...(selected.media.config?.nativeModuleSets ?? []), ${nativeValues}] } };
} else {
  selected.config = { ...selected.config, nativeModuleSets: [...(selected.config?.nativeModuleSets ?? []), ${nativeValues}] };
}` : ""}
Object.defineProperty(selected,"mediaCapabilities",{value:${JSON.stringify(capabilities)},enumerable:true,configurable:true,writable:true});
export default selected;`;
    },
  } };
}
