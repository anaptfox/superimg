//! Setup command - downloads required Playwright browsers

import { fork } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { detectPackageManager, getPackageManagerCommands } from "../utils/package-manager.js";

const require = createRequire(import.meta.url);

export async function setupCommand() {
  console.log("Installing Playwright browsers for SuperImg...\n");

  try {
    const cliPath = join(require.resolve("playwright/package.json"), "..", "cli.js");

    await new Promise<void>((resolve, reject) => {
      const child = fork(cliPath, ["install", "chromium"], { stdio: "inherit" });
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Playwright install exited with code ${code}`));
      });
      child.on("error", reject);
    });

    console.log("\nSetup complete! You can now use 'superimg render'.");
  } catch (err) {
    const { exec } = getPackageManagerCommands(detectPackageManager());
    console.error("\nFailed to install Playwright browsers.");
    console.error(`Try running manually: ${exec} playwright install chromium`);
    process.exit(1);
  }
}
