import type { TemplateSourceMap } from "@superimg/types";

const EMPTY_SOURCE_MAP: TemplateSourceMap = {
  version: 3,
  sources: [],
  names: [],
  mappings: "",
};

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function readSourcesContent(value: unknown): (string | null)[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => (typeof item === "string" || item === null ? item : null));
}

/** Normalize rolldown/rollup output maps into our structural TemplateSourceMap. */
export function toTemplateSourceMap(map: unknown): TemplateSourceMap {
  if (!map || typeof map !== "object") return EMPTY_SOURCE_MAP;

  const record = map as Record<string, unknown>;
  const sourcesContent = readSourcesContent(record.sourcesContent);

  return {
    version: typeof record.version === "number" ? record.version : 3,
    sources: readStringArray(record.sources),
    names: readStringArray(record.names),
    mappings: typeof record.mappings === "string" ? record.mappings : "",
    ...(typeof record.file === "string" ? { file: record.file } : {}),
    ...(typeof record.sourceRoot === "string" ? { sourceRoot: record.sourceRoot } : {}),
    ...(sourcesContent !== undefined ? { sourcesContent } : {}),
  };
}