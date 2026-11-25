//! Doctor command - check environment health and surface drift before render

import { execa } from "execa";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { chromiumHealth, getRuntimeStatus } from "@superimg/node";
import { findProjectRoot } from "../utils/find-project-root.js";
import { discoverVideos } from "../utils/discover-videos.js";

declare const __SUPERIMG_VERSION__: string;

type Status = "ok" | "warn" | "fail";
/** Machine-readable doctor codes for agents. */
export type DoctorCode =
  | "NODE_VERSION"
  | "FFMPEG"
  | "CHROMIUM_MISSING"
  | "CHROMIUM_LAUNCH_DENIED"
  | "CHROMIUM_PATH_IGNORED"
  | "CHROMIUM_OK"
  | "SUPERIMG_VERSION"
  | "SUPERIMG_NOT_INSTALLED"
  | "TEMPLATES"
  | "OUTPUT_WRITABLE"
  | "FONTS"
  | "NO_PROJECT_ROOT";

interface Check {
  status: Status;
  label: string;
  code: DoctorCode;
  detail?: string;
  hint?: string;
}

const ICONS: Record<Status, string> = {
  ok: pc.green("✓"),
  warn: pc.yellow("⚠"),
  fail: pc.red("✗"),
};

/** Kept in sync with the published CLI manifest by doctor-runtime-version.test.ts. */
export const MIN_NODE_VERSION = "24.21.0";
const [MIN_NODE_MAJOR, MIN_NODE_MINOR, MIN_NODE_PATCH] = MIN_NODE_VERSION.split(".").map(Number) as [number, number, number];

function parseNodeVersion(v: string): { major: number; minor: number; patch: number } {
  const [maj, min, pat] = v.split(".").map((x) => Number(x));
  return {
    major: Number.isFinite(maj) ? maj! : 0,
    minor: Number.isFinite(min) ? min! : 0,
    patch: Number.isFinite(pat) ? pat! : 0,
  };
}

export function nodeMeetsEngines(v: string): boolean {
  const { major, minor, patch } = parseNodeVersion(v);
  if (major > MIN_NODE_MAJOR) return true;
  if (major < MIN_NODE_MAJOR) return false;
  if (minor > MIN_NODE_MINOR) return true;
  if (minor < MIN_NODE_MINOR) return false;
  return patch >= MIN_NODE_PATCH;
}

export function checkNode(v = process.versions.node): Check {
  if (nodeMeetsEngines(v)) {
    return {
      status: "ok",
      code: "NODE_VERSION",
      label: `Node ≥ ${MIN_NODE_VERSION}`,
      detail: `v${v}`,
    };
  }
  return {
    status: "fail",
    code: "NODE_VERSION",
    label: `Node ≥ ${MIN_NODE_VERSION}`,
    detail: `v${v}`,
    hint: `Upgrade Node to ${MIN_NODE_VERSION} or newer (package engines).`,
  };
}

async function checkFfmpeg(): Promise<Check> {
  try {
    const { stdout } = await execa("ffmpeg", ["-version"]);
    const first = stdout.split("\n")[0];
    return {
      status: "ok",
      code: "FFMPEG",
      label: "ffmpeg",
      ...(first !== undefined ? { detail: first } : {}),
    };
  } catch {
    return {
      status: "warn",
      code: "FFMPEG",
      label: "ffmpeg",
      detail: "not found on PATH",
      hint: "Required only for GIF, local/direct embedded clips, media probe workflows, or explicit ffmpeg encoders.",
    };
  }
}

function chromiumPathDetail(status: Awaited<ReturnType<typeof getRuntimeStatus>>): string {
  const source = status.browsersPathSource;
  return `${status.browsersPath} (${source})`;
}

async function checkChromium(): Promise<Check[]> {
  const status = await getRuntimeStatus();
  const chromium = chromiumHealth(status);
  const checks: Check[] = [];
  if (status.ignoredPlaywrightPath) {
    checks.push({
      status: "warn",
      code: "CHROMIUM_PATH_IGNORED",
      label: "Playwright browsers path",
      detail: `ignored ${status.ignoredPlaywrightPath}; using ${chromiumPathDetail(status)}`,
      hint: "PLAYWRIGHT_BROWSERS_PATH was 0, relative, or under the process temp dir. SuperImg uses a durable cache instead. Set SUPERIMG_BROWSERS_PATH to an absolute directory to override.",
    });
  }
  if (chromium.status === "ok") {
    checks.push({
      status: "ok",
      code: "CHROMIUM_OK",
      label: "SuperImg Chromium runtime",
      detail: chromium.executablePath
        ? `${chromiumPathDetail(status)} → ${chromium.executablePath}`
        : chromiumPathDetail(status),
    });
    return checks;
  }
  if (chromium.status === "launch-denied") {
    checks.push({
      status: "fail",
      code: "CHROMIUM_LAUNCH_DENIED",
      label: "SuperImg Chromium runtime",
      detail: chromiumPathDetail(status),
      hint: "Chromium is installed but could not launch. Check that the cache directory is writable, set SUPERIMG_BROWSERS_PATH if home is read-only, and on Linux run playwright install-deps. An OS agent sandbox can also block the binary — do not re-run setup.",
    });
    return checks;
  }
  checks.push({
    status: "fail",
    code: "CHROMIUM_MISSING",
    label: "SuperImg Chromium runtime",
    detail: chromiumPathDetail(status),
    hint: [
      "Run: npx superimg setup",
      "Offline? retry with network; CI: cache the account Playwright dir or set SUPERIMG_BROWSERS_PATH.",
    ].join(" "),
  });
  return checks;
}

function checkSuperimgDrift(projectRoot: string): Check {
  const expected = __SUPERIMG_VERSION__;
  const installedPkg = join(projectRoot, "node_modules", "@foxworth", "superimg", "package.json");
  if (!existsSync(installedPkg)) {
    return {
      status: "warn",
      code: "SUPERIMG_NOT_INSTALLED",
      label: "superimg installed",
      detail: "not yet installed",
      hint: "Run: npm install @foxworth/superimg",
    };
  }
  let installed: string;
  try {
    installed = JSON.parse(readFileSync(installedPkg, "utf8")).version;
  } catch {
    return {
      status: "fail",
      code: "SUPERIMG_VERSION",
      label: "superimg installed",
      detail: "could not read installed package.json",
    };
  }
  if (installed === expected) {
    return {
      status: "ok",
      code: "SUPERIMG_VERSION",
      label: "superimg version",
      detail: `${installed} (matches CLI)`,
    };
  }
  return {
    status: "fail",
    code: "SUPERIMG_VERSION",
    label: "superimg version",
    detail: `installed ${installed}, CLI expects ${expected}`,
    hint: `Run: npm install @foxworth/superimg@${expected}`,
  };
}

function checkVideos(projectRoot: string): Check {
  try {
    const videos = discoverVideos(projectRoot);
    if (videos.length === 0) {
      return {
        status: "warn",
        code: "TEMPLATES",
        label: "video templates",
        detail: "none found",
        hint: "Add a *.media.ts template under your project (see docs/examples).",
      };
    }
    return {
      status: "ok",
      code: "TEMPLATES",
      label: "video templates",
      detail: `${videos.length} discovered`,
    };
  } catch (err) {
    return {
      status: "fail",
      code: "TEMPLATES",
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
    return {
      status: "ok",
      code: "OUTPUT_WRITABLE",
      label: "output/ writable",
      detail: outputDir,
    };
  } catch (err) {
    return {
      status: "fail",
      code: "OUTPUT_WRITABLE",
      label: "output/ writable",
      detail: err instanceof Error ? err.message : String(err),
      hint: "Check filesystem permissions.",
    };
  }
}

/** Soft hint: prefer embedding fonts via config.fonts for export parity. */
function checkFontsHint(): Check {
  return {
    status: "ok",
    code: "FONTS",
    label: "fonts",
    detail: "use config.fonts for export parity",
    hint: "System fonts differ across machines; declare fonts in template config for deterministic export.",
  };
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

  let projectRoot: string | undefined;
  try {
    projectRoot = findProjectRoot();
  } catch {
    // Standalone arrangements need no package.json. Project-specific
    // discovery and installed-version checks are meaningful only in a project.
  }

  const checks: Check[] = [
    await checkNode(),
    await checkFfmpeg(),
    ...(await checkChromium()),
    ...(projectRoot === undefined ? [] : [checkSuperimgDrift(projectRoot), checkVideos(projectRoot)]),
    checkOutputWritable(projectRoot ?? process.cwd()),
    checkFontsHint(),
  ];

  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          schemaVersion: 0,
          checks,
          summary: { fails, warns },
          node: process.versions.node,
          engines: { node: `>=${MIN_NODE_VERSION}` },
        },
        null,
        2,
      ),
    );
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
