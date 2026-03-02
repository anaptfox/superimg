//! Add command - installs SuperImg skill for AI coding assistants

import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import { getSkillContent } from "../utils/skill-content.js";

const isWindows = process.platform === "win32";

const SKILLS_REPO = "anaptfox/superimg";

type Scope = "project" | "global" | "both";
type AgentsChoice = string[];

async function runSkillsAdd(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["skills", "add", SKILLS_REPO], {
      stdio: "inherit",
      shell: isWindows,
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npx skills exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

export async function addCommand(
  item: string,
  options: { yes?: boolean; project?: boolean; global?: boolean }
) {
  if (item !== "skill") {
    console.error(`Unknown item: ${item}`);
    console.error("Available items: skill");
    process.exit(1);
  }

  const cwd = process.cwd();
  const agentsPath = join(cwd, "AGENTS.md");

  let scope: Scope;
  let agentsConflict: "skip" | "overwrite" = "skip";
  let agents: AgentsChoice = ["cursor", "claude", "gemini", "opencode"];

  if (options.yes) {
    if (options.project && options.global) scope = "both";
    else if (options.project) scope = "project";
    else if (options.global) scope = "global";
    else scope = "both";
  } else {
    p.intro("SuperImg AI Skill");

    const scopeResult = await p.select({
      message: "Where do you want to install the skill?",
      options: [
        {
          value: "project",
          label: "Project",
          hint: "writes AGENTS.md in your current directory",
        },
        {
          value: "global",
          label: "Global",
          hint: "installs for your AI assistants system-wide via skills.sh",
        },
        {
          value: "both",
          label: "Both",
          hint: "project + global",
        },
      ],
      initialValue: "both",
    });
    if (p.isCancel(scopeResult)) {
      p.cancel("Setup cancelled.");
      process.exit(1);
    }
    scope = scopeResult as Scope;

    const doProject = scope === "project" || scope === "both";
    if (doProject && existsSync(agentsPath)) {
      const conflictResult = await p.select({
        message: "AGENTS.md already exists here. What should we do?",
        options: [
          { value: "skip", label: "Skip", hint: "keep existing" },
          { value: "overwrite", label: "Overwrite", hint: "replace with SuperImg skill" },
        ],
        initialValue: "skip",
      });
      if (p.isCancel(conflictResult)) {
        p.cancel("Setup cancelled.");
        process.exit(1);
      }
      agentsConflict = conflictResult as "skip" | "overwrite";
    }

    const doGlobal = scope === "global" || scope === "both";
    if (doGlobal) {
      const agentsResult = await p.multiselect({
        message: "Which AI assistants do you use?",
        options: [
          { value: "cursor", label: "Cursor" },
          { value: "claude", label: "Claude Code" },
          { value: "gemini", label: "Gemini" },
          { value: "opencode", label: "OpenCode" },
        ],
        initialValues: ["cursor", "claude", "gemini", "opencode"],
        required: false,
      });
      if (p.isCancel(agentsResult)) {
        p.cancel("Setup cancelled.");
        process.exit(1);
      }
      agents = agentsResult as AgentsChoice;
    }
  }

  const doProject = scope === "project" || scope === "both";
  const doGlobal = scope === "global" || scope === "both";
  const runGlobal = doGlobal && agents.length > 0;

  const steps: string[] = [];

  if (doProject) {
    const shouldWrite =
      !existsSync(agentsPath) || (existsSync(agentsPath) && agentsConflict === "overwrite");
    if (shouldWrite) {
      const s = p.spinner();
      s.start("Writing AGENTS.md");
      try {
        writeFileSync(agentsPath, getSkillContent());
        s.stop("AGENTS.md written");
        steps.push("AGENTS.md written to project root");
      } catch (err) {
        s.stop("Failed to write AGENTS.md");
        console.error(err);
        process.exit(1);
      }
    } else {
      p.log.message("AGENTS.md exists, skipped");
    }
  }

  if (runGlobal) {
    const s = p.spinner();
    s.start("Installing globally via skills.sh (Cursor, Claude Code, Gemini, OpenCode)");
    try {
      await runSkillsAdd();
      s.stop("Skill installed globally");
      steps.push(`Installed for: ${agents.join(", ")}`);
    } catch (err) {
      s.stop("Global install failed");
      console.error("\nTry running manually:");
      console.error(`  npx skills add ${SKILLS_REPO}\n`);
      process.exit(1);
    }
  } else if (doGlobal && agents.length === 0) {
    p.log.message("No assistants selected, skipping global install");
  }

  if (!options.yes) {
    p.outro("You're set up.");

    if (doProject && (steps.includes("AGENTS.md written to project root") || existsSync(agentsPath))) {
      console.log("\n  Project skill (for teammates + AI in this repo):");
      console.log("    git add AGENTS.md && git commit -m \"add superimg skill\"");
    }

    if (runGlobal) {
      console.log("\n  Global skill active in:");
      console.log("    ✓ Cursor        .cursor/rules/");
      console.log("    ✓ Claude Code   ~/.claude/");
      console.log("    ✓ Gemini        ~/.gemini/");
      console.log("    ✓ OpenCode      ~/.config/opencode/");
    }

    console.log("");
  } else {
    console.log("\nSuperImg skill installed.");
    if (doProject) console.log("  AGENTS.md written to project root");
    if (runGlobal) console.log("  Global install complete via skills.sh");
    console.log("");
  }
}
