//! superimg skill update — refresh installed skills to the bundled version.
//!
//! Scans every known host target. Files that don't exist are left alone
//! (use `superimg skill install` to create them). Files that do exist get
//! their managed block (or the entire file, for non-block formats) rewritten
//! with the bundled content.

import { existsSync } from "node:fs";
import { getSkillVersion } from "@superimg/skill";
import { HOSTS, HOST_IDS } from "../../skills/hosts.js";
import { resolveTargets, getHostLabel, type Scope } from "../../skills/targets.js";
import { writeForFormat, readInstalledVersion } from "../../skills/formatters.js";

export interface UpdateOptions {
  host?: string;
  allHosts?: boolean;
  global?: boolean;
  globalOnly?: boolean;
  /** Print status without writing. */
  check?: boolean;
}

function parseHostList(arg: string | undefined, allFlag: boolean | undefined): string[] {
  if (allFlag) return [...HOST_IDS];
  if (!arg) return [...HOST_IDS];
  if (arg === "all") return [...HOST_IDS];
  return arg
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function updateCommand(options: UpdateOptions): Promise<void> {
  const cwd = process.cwd();
  const scopes: Scope[] = options.globalOnly
    ? ["global"]
    : options.global
      ? ["project", "global"]
      : ["project", "global"];

  const hostIds = parseHostList(options.host, options.allHosts);
  const targets = resolveTargets({ cwd, hostIds, scopes });

  const bundled = getSkillVersion();
  let updated = 0;
  let upToDate = 0;
  let absent = 0;

  for (const target of targets) {
    const exists = existsSync(target.path);
    if (!exists) {
      absent++;
      continue;
    }

    const installed = readInstalledVersion(target.format, target.path);
    const sameVersion = installed === bundled;
    const hosts = target.hosts.map(getHostLabel).join(", ");
    const fmtPrior = (v: string | null): string => {
      if (!v) return "(no version)";
      if (v === "installed") return "(unstamped)";
      return `v${v}`;
    };

    if (options.check) {
      if (sameVersion) {
        console.log(`  [${target.scope}] up-to-date (v${bundled}): ${target.path}  → ${hosts}`);
        upToDate++;
      } else {
        console.log(`  [${target.scope}] outdated ${fmtPrior(installed)} → v${bundled}: ${target.path}  → ${hosts}`);
        updated++;
      }
      continue;
    }

    const result = writeForFormat(target.format, target.path, { updateOnly: true });
    if (result.status === "noop") {
      absent++;
    } else if (sameVersion) {
      console.log(`  [${target.scope}] up-to-date (v${bundled}): ${target.path}  → ${hosts}`);
      upToDate++;
    } else {
      console.log(`  [${target.scope}] updated ${fmtPrior(result.previousVersion ?? installed)} → v${bundled}: ${target.path}  → ${hosts}`);
      updated++;
    }
  }

  if (options.check) {
    console.log(`\n${updated} outdated, ${upToDate} up-to-date, ${absent} not installed.`);
    process.exit(updated > 0 ? 1 : 0);
  }

  console.log(`\n${updated} updated, ${upToDate} already current, ${absent} not installed.`);
  if (absent > 0) {
    console.log("Run `superimg skill install` to add missing targets.");
  }
}
