/**
 * Build-only / structural portability fixtures for Next, TanStack Start,
 * React Router, Astro + shared Vite substrate.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SUPERIMG_SERVER_ONLY_IMPORTS } from "@superimg/adapters";
import {
  buildServerPageModel,
  NEXT_CLIENT_FORBIDDEN,
} from "./next/server-page.js";
import { CLIENT_ENTRY_IMPORTS } from "./next/client-player.js";
import {
  clientIslandHtml,
  serverLoader as tanstackLoader,
  viteConfig as tanstackVite,
} from "./tanstack-start/entry.js";
import {
  routeLoader,
  ssrPosterFromLoader,
  viteConfig as rrVite,
} from "./react-router/entry.js";
import { astroServerPoster } from "./astro/entry.js";

const here = dirname(fileURLToPath(import.meta.url));

function readAllSources(dir: string): string {
  let out = "";
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) out += readAllSources(p);
    else if (/\.(ts|tsx|js|mjs)$/.test(name.name)) {
      out += readFileSync(p, "utf8");
    }
  }
  return out;
}

describe("framework portability fixtures", () => {
  it("Next: server payload + poster SSR without server render engines in fixture sources", () => {
    const model = buildServerPageModel();
    expect(model.posterHtml).toContain("data-superimg-poster");
    expect(model.clientProps.sourceId).toBe("fixture-demo");
    expect(model.clientProps.schemaVersion).toBe(0);
    // Serializable round-trip
    expect(JSON.parse(JSON.stringify(model.clientProps)).poster.width).toBe(800);

    const src = readAllSources(join(here, "next"));
    for (const bad of NEXT_CLIENT_FORBIDDEN) {
      expect(src.includes(`from "${bad}"`) || src.includes(`from '${bad}'`)).toBe(
        false,
      );
    }
    expect(NEXT_CLIENT_FORBIDDEN).toEqual(
      expect.arrayContaining(["@foxworth/superimg-cli"]),
    );
    expect(CLIENT_ENTRY_IMPORTS).toContain("@superimg/next/client");
  });

  it("TanStack Start: passive loader payload + Vite substrate", () => {
    expect(clientIslandHtml()).toContain("800");
    expect(tanstackLoader().sourceId).toBe("fixture-demo");
    const optimize = (tanstackVite as { optimizeDeps?: { exclude?: string[] } })
      .optimizeDeps?.exclude;
    for (const bad of SUPERIMG_SERVER_ONLY_IMPORTS) {
      expect(optimize).toContain(bad);
    }
  });

  it("React Router: passive loader poster + base path Vite config", () => {
    expect(ssrPosterFromLoader()).toContain("data-superimg-poster");
    expect(routeLoader().sourceId).toBe("fixture-demo");
    expect((rrVite as { base?: string }).base).toBe("/app/");
  });

  it("Astro: passive shell poster and source identity", () => {
    const { shellHtml, payload } = astroServerPoster();
    expect(shellHtml).toContain("superimg-shell");
    expect(payload.sourceId).toBe("fixture-demo");
    expect(payload.poster.height).toBe(450);
  });

  it("all fixture sources avoid direct @foxworth/superimg-cli imports", () => {
    const src = readAllSources(here);
    expect(src).not.toMatch(/from ["']@superimg\/cli(?:\/[^"']*)?["']/);
    expect(src).not.toMatch(/from ["']@superimg\/playwright["']/);
    expect(src).not.toMatch(/from ["']playwright["']/);
    expect(src).not.toContain(["job", "client"].join("-"));
    expect(src).not.toContain(["package", "Hash"].join(""));
    expect(src).not.toContain(["template", "Id"].join(""));
  });
});
