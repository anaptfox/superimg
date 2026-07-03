import { TEMPLATE_EXAMPLES } from "./from-templates";
import { BUILTIN_EXAMPLES } from "./from-builtins";

export type ExampleCategoryId =
  | "basics"
  | "marketing"
  | "events"
  | "social"
  | "interfaces"
  | "data"
  | "vector"
  | "developer";

export interface PlaygroundMeta {
  /** Pre-built rolldown IIFE — browser skips WASM when liveEdit is false */
  liveEdit?: boolean;
  /** Template declares config.assets */
  needsAssets?: boolean;
  /** Rolldown pre-bundle required (multi-file / relative imports) */
  needsBundle?: boolean;
  /** Declared scene duration in seconds (for grid badges) */
  duration?: number;
}

export interface EditorExample {
  id: string;
  title: string;
  category: ExampleCategoryId;
  /** Inline source — omitted when codeUrl is set */
  code?: string;
  /** Sidecar source — public/playground/examples/{id}/code.{hash}.ts */
  codeUrl?: string;
  /** @deprecated Use bundledUrl — inline IIFE kept for backwards compat only */
  bundled?: string;
  /** Pre-built rolldown IIFE — public/playground/examples/{id}/bundle.{hash}.iife.js */
  bundledUrl?: string;
  playground?: PlaygroundMeta;
}

export const EXAMPLE_CATEGORIES = [
  { id: "basics", title: "Basics" },
  { id: "marketing", title: "Marketing" },
  { id: "events", title: "Events" },
  { id: "social", title: "Social" },
  { id: "interfaces", title: "Interfaces" },
  { id: "data", title: "Data" },
  { id: "vector", title: "Vector" },
  { id: "developer", title: "Developer" },
] as const satisfies ReadonlyArray<{ id: ExampleCategoryId; title: string }>;

export const EDITOR_EXAMPLES: EditorExample[] = [
  ...TEMPLATE_EXAMPLES,
  ...BUILTIN_EXAMPLES,
];

export const getExamplesByCategory = (cat: string) =>
  EDITOR_EXAMPLES.filter((e) => e.category === cat);

export const getExampleById = (id: string) =>
  EDITOR_EXAMPLES.find((e) => e.id === id);
