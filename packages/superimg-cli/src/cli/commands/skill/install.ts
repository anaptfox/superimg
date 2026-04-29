//! superimg skill install — write the SuperImg skill into one or more host targets.

import * as p from "@clack/prompts";
import { getSkillVersion } from "@superimg/skill";
import { HOSTS, HOST_IDS } from "../../skills/hosts.js";
import { detectHosts, resolveTargets, getHostLabel, type Scope } from "../../skills/targets.js";
import { writeForFormat } from "../../skills/formatters.js";

export interface InstallOptions {
  /** Comma-separated host IDs, or "all". */
  host?: string;
  /** Treat as `--host all`. */
  allHosts?: boolean;
  /** Install global paths in addition to project paths. */
  global?: boolean;
  /** Install only global paths (skip project). */
  globalOnly?: boolean;
  /** Skip prompts; use defaults / auto-detection. */
  yes?: boolean;
}

function parseHostList(arg: string | undefined, allFlag: boolean | undefined): string[] | null {
  if (allFlag) return [...HOST_IDS];
  if (!arg) return null;
  if (arg === "all") return [...HOST_IDS];
  return arg
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function installCommand(options: InstallOptions): Promise<void> {
  const cwd = process.cwd();

  const scopes: Scope[] = options.globalOnly
    ? ["global"]
    : options.global
      ? ["project", "global"]
      : ["project"];

  let hostIds = parseHostList(options.host, options.allHosts);

  if (!hostIds) {
    if (options.yes) {
      const detected = detectHosts(cwd, scopes);
      hostIds = detected.length > 0 ? detected : [...HOST_IDS];
    } else {
      p.intro("Install SuperImg skill");

      const detected = new Set(detectHosts(cwd, scopes));
      const initialValues = detected.size > 0 ? [...detected] : [...HOST_IDS];

      const result = await p.multiselect({
        message: "Which AI assistants?",
        options: HOSTS.map((h) => {
          const projectPath = h.paths.project ?? "—";
          const globalPath = h.paths.global ? `, global: ${h.paths.global}` : "";
          return {
            value: h.id,
            label: detected.has(h.id) ? `${h.label} (detected)` : h.label,
            hint: `${projectPath}${globalPath}`,
          };
        }),
        initialValues,
        required: true,
      });
      if (p.isCancel(result)) {
        p.cancel("Install cancelled.");
        process.exit(0);
      }
      hostIds = result as string[];
    }
  }

  const targets = resolveTargets({ cwd, hostIds, scopes });
  if (targets.length === 0) {
    console.error("No installable targets for the selected hosts/scopes.");
    process.exit(1);
  }

  const results = targets.map((t) => ({
    target: t,
    result: writeForFormat(t.format, t.path, {}),
  }));

  const version = getSkillVersion();
  if (!options.yes) {
    p.outro(`Installed SuperImg skill v${version}`);
  }
  for (const { target, result } of results) {
    const hosts = target.hosts.map(getHostLabel).join(", ");
    const note = result.previousVersion ? ` (was v${result.previousVersion})` : "";
    console.log(`  [${target.scope}] ${result.status === "wrote" ? "wrote" : "updated"}${note}: ${result.path}  → ${hosts}`);
  }

  if (!options.global && !options.globalOnly && hasGlobalPathFor(hostIds)) {
    console.log("\nTip: add --global to also install host-wide.");
  }
}

function hasGlobalPathFor(hostIds: readonly string[]): boolean {
  return HOSTS.some((h) => hostIds.includes(h.id) && h.paths.global !== null);
}
