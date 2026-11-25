import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bundleTemplateCodeWithMap } from "@superimg/core/bundler";
import type { TemplateBundle } from "@superimg/types";

/** Bundle the interactive-owned lowering into one self-contained offline media program. */
export async function bundleInteractiveOfflineProgram(
  templatePath: string,
): Promise<TemplateBundle> {
  const interactiveModule = fileURLToPath(import.meta.resolve("@superimg/interactive/define"));
  const source = [
    `import definition from ${JSON.stringify(templatePath)};`,
    `import { lowerInteractiveDefinition } from ${JSON.stringify(interactiveModule)};`,
    `export default lowerInteractiveDefinition(definition);`,
  ].join("\n");
  return bundleTemplateCodeWithMap(source, {
    resolveDir: dirname(templatePath),
    sourcefile: `${templatePath}.offline.ts`,
  });
}
