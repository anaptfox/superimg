//! TanStack Start-style entry (unpublished fixture).

import {
  loaderPayload,
  posterHtml,
} from "@superimg/tanstack-start";
import { superimgViteConfig } from "@superimg/adapters/vite";
import { fixtureMediaIR } from "../shared/sample-ir.js";

/** Vite substrate config (same as superimgTanstackStart → adapters core). */
export const viteConfig = superimgViteConfig({ base: "/" });

export function serverLoader() {
  return loaderPayload(fixtureMediaIR, {
    data: { title: "tanstack fixture" },
  });
}

export function clientIslandHtml() {
  return posterHtml(serverLoader());
}
