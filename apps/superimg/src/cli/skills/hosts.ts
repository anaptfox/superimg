//! Host registry — every AI assistant SuperImg can install a skill into.
//!
//! Multiple hosts share the project-level `AGENTS.md` file (Codex, OpenCode,
//! Pi, Aider, modern Claude Code). The install loop dedups by absolute target
//! path so we don't write the same file once per host.

import { homedir } from "node:os";
import { join } from "node:path";

export type FormatId =
  | "agents-md"             // managed block in a shared AGENTS.md
  | "claude-skill-dir"      // .claude/skills/superimg/SKILL.md (+ references/, examples/)
  | "cursor-mdc"            // .cursor/rules/superimg.mdc with .mdc frontmatter
  | "rules-file"            // managed block in a host-specific rules file
  | "copilot-instructions"  // managed block in .github/copilot-instructions.md
  | "gemini-md";            // managed block in GEMINI.md

export interface HostPaths {
  /** Path relative to project cwd, or null if no project install for this host. */
  project: string | null;
  /** Absolute path with $HOME resolved, or null if no global install for this host. */
  global: string | null;
}

export interface Host {
  id: string;
  label: string;
  format: FormatId;
  paths: HostPaths;
  /** Files/dirs whose presence indicates the host is in use. */
  detectMarkers?: { project?: string[]; global?: string[] };
}

const home = homedir();

export const HOSTS: Host[] = [
  {
    id: "claude",
    label: "Claude Code",
    format: "claude-skill-dir",
    paths: {
      project: ".claude/skills/superimg/SKILL.md",
      global: join(home, ".claude/skills/superimg/SKILL.md"),
    },
    detectMarkers: {
      project: [".claude"],
      global: [join(home, ".claude")],
    },
  },
  {
    id: "codex",
    label: "Codex CLI",
    format: "agents-md",
    paths: {
      project: "AGENTS.md",
      global: join(home, ".codex/AGENTS.md"),
    },
    detectMarkers: {
      global: [join(home, ".codex")],
    },
  },
  {
    id: "cursor",
    label: "Cursor",
    format: "cursor-mdc",
    paths: {
      project: ".cursor/rules/superimg.mdc",
      global: null,
    },
    detectMarkers: { project: [".cursor"] },
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    format: "gemini-md",
    paths: {
      project: "GEMINI.md",
      global: join(home, ".gemini/GEMINI.md"),
    },
    detectMarkers: { global: [join(home, ".gemini")] },
  },
  {
    id: "opencode",
    label: "OpenCode",
    format: "agents-md",
    paths: {
      project: "AGENTS.md",
      global: join(home, ".config/opencode/AGENTS.md"),
    },
    detectMarkers: { global: [join(home, ".config/opencode")] },
  },
  {
    id: "pi",
    label: "Pi",
    format: "agents-md",
    paths: {
      project: "AGENTS.md",
      global: join(home, ".pi/agent/AGENTS.md"),
    },
    detectMarkers: { global: [join(home, ".pi")] },
  },
  {
    id: "aider",
    label: "Aider",
    format: "agents-md",
    paths: {
      project: "AGENTS.md",
      global: null,
    },
    detectMarkers: { project: [".aider.conf.yml", ".aider.conf.yaml"] },
  },
  {
    id: "continue",
    label: "Continue",
    format: "rules-file",
    paths: {
      project: ".continuerules",
      global: null,
    },
    detectMarkers: { project: [".continuerules", ".continue"] },
  },
  {
    id: "windsurf",
    label: "Windsurf",
    format: "rules-file",
    paths: {
      project: ".windsurfrules",
      global: null,
    },
    detectMarkers: { project: [".windsurfrules", ".windsurf"] },
  },
  {
    id: "copilot",
    label: "GitHub Copilot",
    format: "copilot-instructions",
    paths: {
      project: ".github/copilot-instructions.md",
      global: null,
    },
    detectMarkers: { project: [".github"] },
  },
];

export const HOST_IDS = HOSTS.map((h) => h.id);

export function getHost(id: string): Host | null {
  return HOSTS.find((h) => h.id === id) ?? null;
}

export function getHostsByIds(ids: readonly string[]): Host[] {
  return ids
    .map((id) => getHost(id))
    .filter((h): h is Host => h !== null);
}
