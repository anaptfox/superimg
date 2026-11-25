//! Package manager detection and command helpers

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findProjectRoot, findWorkspaceRoot } from "./find-project-root.js";

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

interface PackageManagerCommands {
  install: string;
  add: string;
  exec: string;
  run: string;
}

const PM_COMMANDS: Record<PackageManager, PackageManagerCommands> = {
  npm:  { install: "npm install",  add: "npm install @foxworth/superimg",  exec: "npx",       run: "npm run" },
  yarn: { install: "yarn",         add: "yarn add @foxworth/superimg",     exec: "yarn",      run: "yarn" },
  pnpm: { install: "pnpm install", add: "pnpm add @foxworth/superimg",    exec: "pnpm exec", run: "pnpm run" },
  bun:  { install: "bun install",  add: "bun add @foxworth/superimg",     exec: "bunx",      run: "bun run" },
} satisfies Record<PackageManager, PackageManagerCommands>;

const PM_ADD_PATTERNS: Record<PackageManager, (pkgs: string[]) => string> = {
  npm:  (pkgs) => `npm install ${pkgs.join(" ")}`,
  yarn: (pkgs) => `yarn add ${pkgs.join(" ")}`,
  pnpm: (pkgs) => `pnpm add ${pkgs.join(" ")}`,
  bun:  (pkgs) => `bun add ${pkgs.join(" ")}`,
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
export function resolvePackageManager(override?: string, cwd = process.cwd()): PackageManager {
  if (override) {
    const lower = override.toLowerCase() as PackageManager;
    if (VALID_PACKAGE_MANAGERS.includes(lower)) return lower;
    throw new Error(`Unknown package manager "${override}". Valid: ${VALID_PACKAGE_MANAGERS.join(", ")}.`);
  }

  let packageRoot: string | null = null;
  try {
    packageRoot = findProjectRoot(cwd);
  } catch {
    // A fresh standalone target may not exist yet and therefore have no owner.
  }
  const workspaceRoot = findWorkspaceRoot(cwd);
  const packagePin = packageRoot ? readPackageManagerPin(packageRoot) : null;
  const workspacePin = workspaceRoot && workspaceRoot !== packageRoot
    ? readPackageManagerPin(workspaceRoot)
    : null;

  if (packagePin && workspacePin && packagePin !== workspacePin) {
    throw new Error(`Package manager conflict: ${packageRoot}/package.json declares ${packagePin}, but workspace ${workspaceRoot}/package.json declares ${workspacePin}. Align the packageManager fields or pass --pm explicitly.`);
  }

  const pinned = packagePin ?? workspacePin;
  const pinRoot = packagePin ? packageRoot : workspaceRoot;
  const lockfileRoot = workspaceRoot ?? packageRoot;
  const lockfileManagers = lockfileRoot ? managersFromLockfiles(lockfileRoot) : [];
  if (lockfileManagers.length > 1) {
    throw new Error(`Conflicting package-manager lockfiles in ${lockfileRoot}: ${lockfileManagers.join(", ")}. Keep the intended lockfile or pass --pm explicitly.`);
  }
  const lockfileManager = lockfileManagers[0];
  if (pinned && lockfileManager && pinned !== lockfileManager) {
    throw new Error(`${pinRoot}/package.json pins ${pinned}, but ${lockfileRoot} contains a ${lockfileManager} lockfile. Align them or pass --pm explicitly.`);
  }

  return pinned ?? lockfileManager ?? detectPackageManager();
}

function readPackageManagerPin(root: string): PackageManager | null {
  try {
    const value = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).packageManager;
    if (typeof value !== "string") return null;
    const name = value.split("@")[0]?.toLowerCase() as PackageManager | undefined;
    return name && VALID_PACKAGE_MANAGERS.includes(name) ? name : null;
  } catch {
    return null;
  }
}

const LOCKFILES: ReadonlyArray<readonly [string, PackageManager]> = [
  ["package-lock.json", "npm"], ["npm-shrinkwrap.json", "npm"],
  ["yarn.lock", "yarn"], ["pnpm-lock.yaml", "pnpm"],
  ["bun.lock", "bun"], ["bun.lockb", "bun"],
];

function managersFromLockfiles(root: string): PackageManager[] {
  return [...new Set(LOCKFILES.filter(([name]) => existsSync(join(root, name))).map(([, pm]) => pm))];
}

/**
 * Get install and exec commands for a given package manager.
 */
export function getPackageManagerCommands(pm: PackageManager): PackageManagerCommands {
  return PM_COMMANDS[pm];
}

/**
 * Get the command to add one or more packages.
 */
export function getAddPackagesCommand(pm: PackageManager, packages: string[]): string {
  return PM_ADD_PATTERNS[pm](packages);
}
