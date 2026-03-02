//! Setup command - installs Playwright and downloads required browsers

import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { detectPackageManager, getPackageManagerCommands, getAddPackagesCommand } from "../utils/package-manager.js";
import { findProjectRoot } from "../utils/find-project-root.js";

const isWindows = process.platform === "win32";

async function runInDir(cwd: string, command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit", shell: isWindows });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with exit code ${code}`));
    });
    child.on("error", reject);
  });
}

export async function setupCommand() {
  console.log("Installing Playwright browsers for SuperImg...\n");

  let projectRoot: string;
  try {
    projectRoot = findProjectRoot();
  } catch (err) {
    console.error("\nNo project found. Run 'superimg init' first to create a project.\n");
    process.exit(1);
  }

  const pm = detectPackageManager();
  const { run } = getPackageManagerCommands(pm);

  // Ensure playwright npm package is installed
  const pkgPath = join(projectRoot, "package.json");
  const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, "utf-8")) : {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const hasPlaywright = deps?.playwright != null;

  if (!hasPlaywright) {
    console.log("Installing Playwright...\n");
    try {
      const addCommand = getAddPackagesCommand(pm, ["playwright"]);
      const [cmd, ...args] = addCommand.split(/\s+/);
      await runInDir(projectRoot, cmd, args);
      console.log("✓ Playwright installed\n");
    } catch (err) {
      console.error("\nFailed to install Playwright.");
      console.error(`Try running manually: ${getAddPackagesCommand(pm, ["playwright"])}\n`);
      process.exit(1);
    }
  }

  // Download Chromium browser
  console.log("Downloading Chromium browser...\n");
  try {
    const execCmd = pm === "npm" ? "npx" : pm === "yarn" ? "yarn" : pm === "pnpm" ? "pnpm" : "bunx";
    const execArgs = pm === "yarn" ? ["exec", "playwright", "install", "chromium"] : ["playwright", "install", "chromium"];
    await runInDir(projectRoot, execCmd, execArgs);
    console.log("\nSetup complete! You can now use 'superimg render'.");
  } catch (err) {
    console.error("\nFailed to install Playwright browsers.");
    console.error(`Try running manually: ${run} superimg setup`);
    console.error(`Or: npx playwright install chromium\n`);
    process.exit(1);
  }
}
