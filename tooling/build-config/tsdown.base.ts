import type { UserConfig } from "tsdown";

/** Shared defaults for library packages in the monorepo. */
export const libraryDefaults = {
  format: ["esm"] as const,
  dts: { resolve: true },
  hash: false,
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
} satisfies Partial<UserConfig>;

/** Quality gates for the published superimg package. */
export const publishChecks = {
  publint: { level: "error" as const },
  attw: { profile: "esm-only" as const, level: "error" as const },
} satisfies Partial<UserConfig>;