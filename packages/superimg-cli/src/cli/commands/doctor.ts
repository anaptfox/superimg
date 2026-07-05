//! Doctor command - check environment health and surface drift before render

import { execa } from "execa";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { getRuntimeStatus } from "@superimg/node";
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

const ICONS: Record<Status, string> = {
  ok: pc.green("✓"),
  warn: pc.yellow("⚠"),
  fail: pc.red("✗"),
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
    return { status: "ok", label: "ffmpeg", ...(first !== undefined ? { detail: first } : {}) };
  } catch {
    return {
      status: "warn",
      label: "ffmpeg",
      detail: "not found on PATH",
      hint: "Required only for GIF, local/direct embedded clips, media probe workflows, or explicit ffmpeg encoders.",
    };
  }
}

async function checkChromium(): Promise<Check> {
  const status = await getRuntimeStatus();
  if (!status.installed) {
    return {
      status: "fail",
      label: "SuperImg Chromium runtime",
      detail: "launch probe failed",
      hint: "Run: superimg setup",
    };
  }
  return {
    status: "ok",
    label: "SuperImg Chromium runtime",
    ...(status.executablePath !== null ? { detail: status.executablePath } : {}),
  };
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
  const detail = check.detail ? ` ${pc.dim(check.detail)}` : "";
  console.log(`  ${ICONS[check.status]} ${check.label}${detail}`);
  if (check.hint && check.status !== "ok") {
    console.log(`      ${pc.dim(check.hint)}`);
  }
}

export async function doctorCommand(options: { json?: boolean } = {}) {
  if (!options.json) {
    console.log("\nSuperImg doctor\n");
  }

  let projectRoot: string;
  try {
    projectRoot = findProjectRoot();
  } catch {
    if (options.json) {
      console.log(JSON.stringify({ error: { message: "no package.json found", code: "NO_PROJECT_ROOT" } }));
      process.exit(1);
    }
    console.log(`  ${ICONS.fail} project root  ${pc.dim("no package.json found")}`);
    console.log(`      ${pc.dim("Run from a project directory or 'superimg init' first.")}\n`);
    process.exit(1);
  }

  const checks: Check[] = [
    await checkNode(),
    await checkFfmpeg(),
    await checkChromium(),
    checkSuperimgDrift(projectRoot),
    checkVideos(projectRoot),
    checkOutputWritable(projectRoot),
  ];

  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;

  if (options.json) {
    console.log(JSON.stringify({ checks, summary: { fails, warns } }, null, 2));
    if (fails > 0) process.exit(1);
    return;
  }

  for (const c of checks) printRow(c);

  console.log("");
  if (fails > 0) {
    console.log(`  ${pc.red(`${fails} blocker${fails === 1 ? "" : "s"}`)}, ${warns} warning${warns === 1 ? "" : "s"}\n`);
    process.exit(1);
  }
  if (warns > 0) {
    console.log(`  ${pc.yellow(`${warns} warning${warns === 1 ? "" : "s"}`)}, no blockers\n`);
    return;
  }
  console.log(`  ${pc.green("all good")}\n`);
}
