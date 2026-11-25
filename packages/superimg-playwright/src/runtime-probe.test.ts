import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findHeadlessShellPresence,
  findHeadlessShellRevisionDir,
} from "./runtime-probe.js";

function fakeRegistry(name: string): string {
  const root = join(
    tmpdir(),
    `superimg-probe-${name}-${process.pid}-${Date.now()}`,
  );
  mkdirSync(root, { recursive: true });
  return root;
}

describe("findHeadlessShellPresence", () => {
  it("returns empty when the registry is missing", () => {
    expect(findHeadlessShellPresence(join(tmpdir(), "no-such-registry"))).toEqual({
      markerPresent: false,
      revisionDir: null,
      executablePath: null,
    });
  });

  it("requires INSTALLATION_COMPLETE in a chromium_headless_shell dir", () => {
    const registry = fakeRegistry("no-marker");
    mkdirSync(join(registry, "chromium_headless_shell-1234"), { recursive: true });
    expect(findHeadlessShellRevisionDir(registry)).toBeNull();
    expect(findHeadlessShellPresence(registry).markerPresent).toBe(false);
  });

  it("finds the marker and the headless-shell binary", () => {
    const registry = fakeRegistry("hit");
    const revision = join(registry, "chromium_headless_shell-1234");
    const binDir = join(revision, "chrome-headless-shell-mac-arm64");
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(revision, "INSTALLATION_COMPLETE"), "");
    const binary = join(binDir, "chrome-headless-shell");
    writeFileSync(binary, "");

    expect(findHeadlessShellPresence(registry)).toEqual({
      markerPresent: true,
      revisionDir: revision,
      executablePath: binary,
    });
  });
});
