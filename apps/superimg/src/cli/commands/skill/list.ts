//! superimg skill list — show what's installed where, and at what version.

import { existsSync } from "node:fs";
import { getSkillVersion } from "@superimg/skill";
import { HOST_IDS } from "../../skills/hosts.js";
import { resolveTargets, getHostLabel, type Scope } from "../../skills/targets.js";
import { readInstalledVersion } from "../../skills/formatters.js";

export interface ListOptions {
  global?: boolean;
}

export async function listCommand(options: ListOptions): Promise<void> {
  const cwd = process.cwd();
  const scopes: Scope[] = options.global ? ["global"] : ["project", "global"];

  const targets = resolveTargets({ cwd, hostIds: HOST_IDS, scopes });
  const bundled = getSkillVersion();

  let installed = 0;
  console.log(`SuperImg skill — bundled version v${bundled}\n`);
  for (const target of targets) {
    if (!existsSync(target.path)) continue;
    const v = readInstalledVersion(target.format, target.path);
    const versionStr = v === "installed" ? "(unstamped)" : v ? `v${v}` : "(unknown)";
    const hosts = target.hosts.map(getHostLabel).join(", ");
    const isVersionedFormat = target.format === "agents-md" || target.format === "gemini-md" || target.format === "copilot-instructions" || target.format === "rules-file";
    const status = isVersionedFormat ? (v === bundled ? "✓" : "!") : "✓";
    console.log(`  ${status} [${target.scope}] ${versionStr}  ${target.path}  → ${hosts}`);
    installed++;
  }

  if (installed === 0) {
    console.log("  Nothing installed yet. Run `superimg skill install`.");
  }
}
