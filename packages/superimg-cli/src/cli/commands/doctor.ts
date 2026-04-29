//! Doctor command - check environment health and surface drift before render

import { execa } from "execa";
import { existsSync, readFileSync, readdirSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { findProjectRoot } from "../utils/find-project-root.js";
import { discoverVideos } from "../utils/discover-videos.js";

declare const __SUPERIMG_VERSION__: string;

type Status = "ok" | "warn" | "fail";
interface Check {
  status: Status;
  label: string;
  detail?: string;
  hint?: string;
}

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
};

const ICONS: Record<Status, string> = {
  ok: `${COLORS.green}✓${COLORS.reset}`,
  warn: `${COLORS.yellow}⚠${COLORS.reset}`,
  fail: `${COLORS.red}✗${COLORS.reset}`,
};

async function checkNode(): Promise<Check> {
  const v = process.versions.node;
  const major = Number(v.split(".")[0]);
  if (major >= 18) return { status: "ok", label: "Node ≥ 18", detail: `v${v}` };
  return {
    status: "fail",
    label: "Node ≥ 18",
    detail: `v${v}`,
    hint: "Upgrade Node to 18 or newer.",
  };
}

async function checkFfmpeg(): Promise<Check> {
  try {
    const { stdout } = await execa("ffmpeg", ["-version"]);
    const first = stdout.split("\n")[0];
    return { status: "ok", label: "ffmpeg", detail: first };
  } catch {
    return {
      status: "warn",
      label: "ffmpeg",
      detail: "not found on PATH",
      hint: "Required only for GIF output. Install via Homebrew: brew install ffmpeg",
    };
  }
}

function playwrightCacheDir(): string {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return process.env.PLAYWRIGHT_BROWSERS_PATH;
  const p = platform();
  if (p === "darwin") return join(homedir(), "Library", "Caches", "ms-playwright");
  if (p === "win32") return join(homedir(), "AppData", "Local", "ms-playwright");
  return join(homedir(), ".cache", "ms-playwright");
}

function checkChromium(): Check {
  const dir = playwrightCacheDir();
  if (!existsSync(dir)) {
    return {
      status: "fail",
      label: "Playwright Chromium",
      detail: `cache dir missing (${dir})`,
      hint: "Run: superimg setup",
    };
  }
  const entries = readdirSync(dir).filter((e) => e.startsWith("chromium"));
  if (entries.length === 0) {
    return {
      status: "fail",
      label: "Playwright Chromium",
      detail: "no chromium build in cache",
      hint: "Run: superimg setup",
    };
  }
  return { status: "ok", label: "Playwright Chromium", detail: entries.sort().reverse()[0] };
}

function checkSuperimgDrift(projectRoot: string): Check {
  const expected = __SUPERIMG_VERSION__;
  const installedPkg = join(projectRoot, "node_modules", "superimg", "package.json");
  if (!existsSync(installedPkg)) {
    return {
      status: "warn",
      label: "superimg installed",
      detail: "not yet installed",
      hint: "Run: npm install",
    };
  }
  let installed: string;
  try {
    installed = JSON.parse(readFileSync(installedPkg, "utf8")).version;
  } catch {
    return {
      status: "fail",
      label: "superimg installed",
      detail: "could not read installed package.json",
    };
  }
  if (installed === expected) {
    return { status: "ok", label: "superimg version", detail: `${installed} (matches CLI)` };
  }
  return {
    status: "fail",
    label: "superimg version",
    detail: `installed ${installed}, CLI expects ${expected}`,
    hint: `Run: npm install superimg@${expected}`,
  };
}

function checkVideos(projectRoot: string): Check {
  try {
    const videos = discoverVideos(projectRoot);
    if (videos.length === 0) {
      return {
        status: "warn",
        label: "video templates",
        detail: "none found",
        hint: "Run: superimg new",
      };
    }
    return { status: "ok", label: "video templates", detail: `${videos.length} discovered` };
  } catch (err) {
    return {
      status: "fail",
      label: "video templates",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

function checkOutputWritable(projectRoot: string): Check {
  const outputDir = join(projectRoot, "output");
  try {
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
    const probe = join(outputDir, ".doctor-probe");
    writeFileSync(probe, "ok");
    unlinkSync(probe);
    return { status: "ok", label: "output/ writable", detail: outputDir };
  } catch (err) {
    return {
      status: "fail",
      label: "output/ writable",
      detail: err instanceof Error ? err.message : String(err),
      hint: "Check filesystem permissions.",
    };
  }
}

function printRow(check: Check) {
  const detail = check.detail ? ` ${COLORS.dim}${check.detail}${COLORS.reset}` : "";
  console.log(`  ${ICONS[check.status]} ${check.label}${detail}`);
  if (check.hint && check.status !== "ok") {
    console.log(`      ${COLORS.dim}${check.hint}${COLORS.reset}`);
  }
}

export async function doctorCommand() {
  console.log("\nSuperImg doctor\n");

  let projectRoot: string;
  try {
    projectRoot = findProjectRoot();
  } catch {
    console.log(`  ${ICONS.fail} project root  ${COLORS.dim}no package.json found${COLORS.reset}`);
    console.log(`      ${COLORS.dim}Run from a project directory or 'superimg init' first.${COLORS.reset}\n`);
    process.exit(1);
  }

  const checks: Check[] = [
    await checkNode(),
    await checkFfmpeg(),
    checkChromium(),
    checkSuperimgDrift(projectRoot),
    checkVideos(projectRoot),
    checkOutputWritable(projectRoot),
  ];

  for (const c of checks) printRow(c);

  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;
  console.log("");
  if (fails > 0) {
    console.log(`  ${COLORS.red}${fails} blocker${fails === 1 ? "" : "s"}${COLORS.reset}, ${warns} warning${warns === 1 ? "" : "s"}\n`);
    process.exit(1);
  }
  if (warns > 0) {
    console.log(`  ${COLORS.yellow}${warns} warning${warns === 1 ? "" : "s"}${COLORS.reset}, no blockers\n`);
    return;
  }
  console.log(`  ${COLORS.green}all good${COLORS.reset}\n`);
}
