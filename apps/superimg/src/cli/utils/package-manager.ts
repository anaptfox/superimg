//! Package manager detection and command helpers

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

interface PackageManagerCommands {
  install: string;
  add: string;
  exec: string;
  run: string;
}

const PM_COMMANDS: Record<PackageManager, PackageManagerCommands> = {
  npm:  { install: "npm install",  add: "npm install superimg",  exec: "npx",       run: "npm run" },
  yarn: { install: "yarn",         add: "yarn add superimg",     exec: "yarn",      run: "yarn" },
  pnpm: { install: "pnpm install", add: "pnpm add superimg",    exec: "pnpm exec", run: "pnpm run" },
  bun:  { install: "bun install",  add: "bun add superimg",     exec: "bunx",      run: "bun run" },
};

const VALID_PACKAGE_MANAGERS = Object.keys(PM_COMMANDS) as PackageManager[];

/**
 * Detect the package manager from the npm_config_user_agent environment variable.
 * This is set by npm, yarn, pnpm, and bun when they invoke a script or binary.
 */
export function detectPackageManager(): PackageManager {
  const agent = process.env.npm_config_user_agent ?? "";
  if (agent.startsWith("pnpm")) return "pnpm";
  if (agent.startsWith("yarn")) return "yarn";
  if (agent.startsWith("bun"))  return "bun";
  return "npm";
}

/**
 * Resolve the package manager to use, with optional override from a CLI flag.
 */
export function resolvePackageManager(override?: string): PackageManager {
  if (override) {
    const lower = override.toLowerCase() as PackageManager;
    if (VALID_PACKAGE_MANAGERS.includes(lower)) return lower;
    console.warn(`Unknown package manager "${override}". Valid: ${VALID_PACKAGE_MANAGERS.join(", ")}. Falling back to auto-detect.`);
  }
  return detectPackageManager();
}

/**
 * Get install and exec commands for a given package manager.
 */
export function getPackageManagerCommands(pm: PackageManager): PackageManagerCommands {
  return PM_COMMANDS[pm];
}
