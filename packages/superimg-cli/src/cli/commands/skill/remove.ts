//! superimg skill remove — strip the SuperImg skill from installed targets.

import * as p from "@clack/prompts";
import { HOST_IDS } from "../../skills/hosts.js";
import { resolveTargets, getHostLabel, type Scope } from "../../skills/targets.js";
import { removeForFormat } from "../../skills/formatters.js";

export interface RemoveOptions {
  host?: string;
  allHosts?: boolean;
  global?: boolean;
  globalOnly?: boolean;
  yes?: boolean;
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

export async function removeCommand(options: RemoveOptions): Promise<void> {
  const cwd = process.cwd();
  const scopes: Scope[] = options.globalOnly
    ? ["global"]
    : options.global
      ? ["project", "global"]
      : ["project"];

  const hostIds = parseHostList(options.host, options.allHosts);
  const targets = resolveTargets({ cwd, hostIds, scopes });

  if (!options.yes) {
    p.intro("Remove SuperImg skill");
    const confirm = await p.confirm({
      message: `This will remove SuperImg from ${targets.length} target(s). Continue?`,
      initialValue: false,
    });
    if (p.isCancel(confirm) || !confirm) {
      p.cancel("Cancelled.");
      process.exit(0);
    }
  }

  let removed = 0;
  let stripped = 0;
  let absent = 0;
  for (const target of targets) {
    const result = removeForFormat(target.format, target.path);
    const hosts = target.hosts.map(getHostLabel).join(", ");
    if (result.status === "absent") {
      absent++;
      continue;
    }
    console.log(`  [${target.scope}] ${result.status}: ${target.path}  → ${hosts}`);
    if (result.status === "removed") removed++;
    else stripped++;
  }

  console.log(`\n${removed} removed, ${stripped} stripped, ${absent} not present.`);
}
