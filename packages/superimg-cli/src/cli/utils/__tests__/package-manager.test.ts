import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPackageManagerCommands, resolvePackageManager } from "../package-manager.js";

describe("resolvePackageManager", () => {
  let root = "";
  afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); root = ""; vi.unstubAllEnvs(); });
  function project(label: string) {
    root = join(tmpdir(), `superimg-pm-${label}-${Date.now()}`);
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "package.json"), "{}");
    return root;
  }

  it("uses explicit override, then package pin, then lockfile, before user agent", () => {
    const cwd = project("priority");
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ packageManager: "pnpm@9.1.0" }));
    writeFileSync(join(cwd, "pnpm-lock.yaml"), "lockfileVersion: '9.0'");
    vi.stubEnv("npm_config_user_agent", "npm/10.0.0");
    expect(resolvePackageManager(undefined, cwd)).toBe("pnpm");
    expect(resolvePackageManager("bun", cwd)).toBe("bun");

    writeFileSync(join(cwd, "package.json"), "{}");
    expect(resolvePackageManager(undefined, cwd)).toBe("pnpm");
  });

  it("uses the workspace pin and rejects conflicting lockfiles with a repair hint", () => {
    const cwd = project("workspace");
    const member = join(cwd, "packages", "media");
    mkdirSync(member, { recursive: true });
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ workspaces: ["packages/*"], packageManager: "yarn@4.0.0" }));
    writeFileSync(join(member, "package.json"), "{}");
    expect(resolvePackageManager(undefined, member)).toBe("yarn");

    writeFileSync(join(cwd, "pnpm-lock.yaml"), "lockfileVersion: '9.0'");
    expect(() => resolvePackageManager(undefined, member)).toThrow(/Align them or pass --pm explicitly/);
  });

  it("uses the user agent for a fresh target with no package or workspace owner", () => {
    const cwd = join(tmpdir(), `superimg-pm-fresh-${Date.now()}`, "new-project");
    vi.stubEnv("npm_config_user_agent", "bun/1.2.0");
    expect(resolvePackageManager(undefined, cwd)).toBe("bun");
  });
});

describe("package install commands", () => {
  it("use the published scoped SuperImg package name", () => {
    expect(getPackageManagerCommands("npm").add).toBe("npm install @foxworth/superimg");
    expect(getPackageManagerCommands("yarn").add).toBe("yarn add @foxworth/superimg");
    expect(getPackageManagerCommands("pnpm").add).toBe("pnpm add @foxworth/superimg");
    expect(getPackageManagerCommands("bun").add).toBe("bun add @foxworth/superimg");
  });
});
