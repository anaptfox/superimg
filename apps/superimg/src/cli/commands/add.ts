//! Add command - installs superimg skill for AI coding assistants

import { spawn } from "node:child_process";

export async function addCommand(item: string) {
  if (item !== "skill") {
    console.error(`Unknown item: ${item}`);
    console.error("Available items: skill");
    process.exit(1);
  }

  console.log("Installing superimg skill for your AI coding assistant...\n");

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("npx", ["skills", "add", "anaptfox/superimg"], {
        stdio: "inherit",
        shell: true,
      });
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`npx skills exited with code ${code}`));
      });
      child.on("error", reject);
    });

    console.log("\nSkill installed! Your AI assistant can now help you create SuperImg templates.");
  } catch (err) {
    console.error("\nFailed to install skill.");
    console.error("Try running manually: npx skills add anaptfox/superimg");
    process.exit(1);
  }
}
