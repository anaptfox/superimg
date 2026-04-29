//! Resolve hosts × scopes to deduplicated install targets.
//!
//! Several hosts share the project-level AGENTS.md file. This module produces
//! a list of unique target files (keyed by absolute path) so we don't write
//! the same file once per host. The `hosts` field on each target records all
//! hosts that benefit from the write.

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { FormatId, Host } from "./hosts.js";
import { HOSTS } from "./hosts.js";

export type Scope = "project" | "global";

export interface Target {
  format: FormatId;
  path: string;
  scope: Scope;
  /** All host IDs that consume this target. */
  hosts: string[];
}

export interface ResolveOptions {
  cwd: string;
  /** Hosts to install for. */
  hostIds: readonly string[];
  /** Scopes to materialize. */
  scopes: readonly Scope[];
}

export function resolveTargets(opts: ResolveOptions): Target[] {
  const byPath = new Map<string, Target>();

  for (const id of opts.hostIds) {
    const host = HOSTS.find((h) => h.id === id);
    if (!host) continue;

    for (const scope of opts.scopes) {
      const rel = host.paths[scope];
      if (!rel) continue;

      const abs = scope === "project" ? resolve(opts.cwd, rel) : rel;
      const existing = byPath.get(abs);
      if (existing) {
        if (!existing.hosts.includes(host.id)) existing.hosts.push(host.id);
        continue;
      }
      byPath.set(abs, {
        format: host.format,
        path: abs,
        scope,
        hosts: [host.id],
      });
    }
  }

  return [...byPath.values()];
}

/** Auto-detect hosts present in cwd or home. Falls back to all hosts when nothing is detected. */
export function detectHosts(cwd: string, scopes: readonly Scope[]): string[] {
  const detected = new Set<string>();
  for (const host of HOSTS) {
    const markers = host.detectMarkers ?? {};
    if (scopes.includes("project") && markers.project) {
      for (const m of markers.project) {
        if (existsSync(resolve(cwd, m))) {
          detected.add(host.id);
          break;
        }
      }
    }
    if (scopes.includes("global") && markers.global) {
      for (const m of markers.global) {
        if (existsSync(m)) {
          detected.add(host.id);
          break;
        }
      }
    }
  }
  return [...detected];
}

export function getHostLabel(id: string): string {
  return HOSTS.find((h) => h.id === id)?.label ?? id;
}

export type { Host };
