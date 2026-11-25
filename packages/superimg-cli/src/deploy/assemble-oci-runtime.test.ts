import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, existsSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { findPackageJSON } from "node:module";
import { materializeDeployPlan, planDeploy } from "@superimg/adapters/providers";
import {
  assembleOciRuntime,
  collectLocalJsClosure,
  distByteSize,
} from "./assemble-oci-runtime.js";

const cliDist = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../dist",
);
const root = new URL("../../../../", import.meta.url);

describe("assembleOciRuntime", () => {
  it("collects container + worker closure from built dist", () => {
    if (!existsSync(join(cliDist, "container.js"))) {
      // package not built in isolation — skip
      return;
    }
    const files = collectLocalJsClosure(cliDist, [
      "container.js",
      "container-worker.js",
    ]);
    expect(files).toContain("container.js");
    expect(files.length).toBeGreaterThan(5);
  });

  it("copies the bundle and pins dependencies to the release versions", () => {
    const out = mkdtempSync(join(tmpdir(), "oci-asm-"));
    try {
      const fixture = join(out, "built");
      const context = join(out, "image");
      mkdirSync(fixture);
      writeFileSync(join(fixture, "container.js"), 'import "./server.js";\n');
      writeFileSync(join(fixture, "container-worker.js"), 'import "./worker.js";\n');
      writeFileSync(join(fixture, "server.js"), "export {};\n");
      writeFileSync(join(fixture, "worker.js"), `
        export const load = () => import(
          /* webpackIgnore: true */
          /* turbopackIgnore: true */
          "./encoder.js"
        );
      `);
      writeFileSync(join(fixture, "encoder.js"), "export {};\n");
      const result = assembleOciRuntime({
        outDir: context,
        cliDistDir: fixture,
      });
      const pkg = JSON.parse(readFileSync(result.packageJsonPath, "utf8"));
      for (const name of ["@hono/node-server", "@mediabunny/dts", "@mediabunny/server", "hono", "mediabunny", "playwright", "sharp", "three"]) {
        const installed = JSON.parse(readFileSync(findPackageJSON(name, import.meta.url)!, "utf8"));
        expect(pkg.dependencies[name]).toBe(installed.version);
      }
      for (const version of Object.values(pkg.dependencies)) {
        expect(version).toMatch(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/);
      }
      expect(result.playwrightVersion).toBe(pkg.dependencies.playwright);
      expect(result.nodeVersion).toBe(readFileSync(new URL(".node-version", root), "utf8").trim());
      const plan = planDeploy({
        imageName: "superimg-render",
        nodeVersion: result.nodeVersion,
        playwrightVersion: result.playwrightVersion,
      });
      const dockerfile = materializeDeployPlan(plan)["Dockerfile"];
      expect(dockerfile).toContain(`FROM node:${result.nodeVersion}-bookworm-slim`);
      expect(dockerfile).toContain(`FROM mcr.microsoft.com/playwright:v${pkg.dependencies.playwright}-jammy`);
      expect(pkg.dependencies["better-sqlite3"]).toBeUndefined();
      expect(pkg.main).toBe("dist/container.js");
      expect(result.files).toEqual(["container-worker.js", "container.js", "encoder.js", "server.js", "worker.js"]);
      expect(distByteSize(result.distDir)).toBeGreaterThan(0);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("keeps the standalone Docker and nvm pins aligned with CI", () => {
    const nodeVersion = readFileSync(new URL(".node-version", root), "utf8").trim();
    expect(readFileSync(new URL(".nvmrc", root), "utf8").trim()).toBe(nodeVersion);
    expect(readFileSync(new URL("Dockerfile", root), "utf8")).toContain(`ARG NODE_VERSION=${nodeVersion}\n`);
  });
});
