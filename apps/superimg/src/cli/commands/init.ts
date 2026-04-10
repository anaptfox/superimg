//! Init command - scaffold a new SuperImg template project

import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import * as p from "@clack/prompts";
import type { PackageManager } from "../utils/package-manager.js";
import {
  resolvePackageManager,
  detectPackageManager,
  getPackageManagerCommands,
  getAddPackagesCommand,
} from "../utils/package-manager.js";
import { getSkillContent } from "../utils/skill-content.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

function getSuperimgVersion(): string {
  const candidatePaths = [
    join(__dirname, "..", "package.json"), // dist -> apps/superimg/package.json
    join(__dirname, "..", "..", "..", "package.json"), // src/cli/commands -> apps/superimg/package.json
  ];

  for (const pkgPath of candidatePaths) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (pkg?.name === "superimg" && pkg?.private !== true && typeof pkg?.version === "string") {
        return pkg.version;
      }
    } catch {
      // Try next location
    }
  }

  return "latest";
}

const CONFIG_TS = `import { defineConfig } from "superimg";

export default defineConfig({
  width: 1920,
  height: 1080,
  fps: 30,
  duration: 5,
});
`;

const TEMPLATE_TS = `import { defineScene } from "superimg";

export default defineScene({
  data: {
    message: "Hello, SuperImg!",
  },

  config: {
    duration: 3,
    inlineCss: [\`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #0f0f23; font-family: system-ui, sans-serif; }
      .message { color: white; font-size: 64px; font-weight: 700; }
    \`],
  },

  render(ctx) {
    const { std, sceneTimeSeconds: time, width, height, data } = ctx;
    const progress = std.math.clamp(time / 1.0, 0, 1);
    const opacity = std.tween(0, 1, progress, "easeOutCubic");
    const y = std.tween(30, 0, progress, "easeOutCubic");

    return \`
      <div style="\${std.css({ width, height }, std.css.center())}">
        <div class="message" style="\${std.css({ opacity, transform: "translateY(" + y + "px)" })}">
          \${data.message}
        </div>
      </div>
    \`;
  },
});
`;

const TEMPLATE_JS = `import { defineScene } from "superimg";

export default defineScene({
  data: {
    message: "Hello, SuperImg!",
  },

  config: {
    duration: 3,
    inlineCss: [\`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #0f0f23; font-family: system-ui, sans-serif; }
      .message { color: white; font-size: 64px; font-weight: 700; }
    \`],
  },

  render(ctx) {
    const { std, sceneTimeSeconds: time, width, height, data } = ctx;
    const progress = std.math.clamp(time / 1.0, 0, 1);
    const opacity = std.tween(0, 1, progress, "easeOutCubic");
    const y = std.tween(30, 0, progress, "easeOutCubic");

    return \`
      <div style="\${std.css({ width, height }, std.css.center())}">
        <div class="message" style="\${std.css({ opacity, transform: "translateY(" + y + "px)" })}">
          \${data.message}
        </div>
      </div>
    \`;
  },
});
`;

const TSCONFIG = `{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["*.ts"]
}
`;

export async function initCommand(
  name: string,
  options: { yes?: boolean; js?: boolean; pm?: string; skipInstall?: boolean; skipBrowser?: boolean }
) {
  let targetDir = join(process.cwd(), name === "." ? "" : name);
  const dirExists = existsSync(targetDir);
  const pkgJsonPath = join(targetDir, "package.json");
  let existingProject = dirExists && existsSync(pkgJsonPath);

  // Non-empty dir with no package.json — not a JS/TS project, bail
  if (dirExists && !existingProject) {
    const entries = readdirSync(targetDir).filter((e) => !e.startsWith("."));
    if (entries.length > 0) {
      const dirLabel = name === "." ? "Current directory" : name;
      console.error(`\n"${dirLabel}" already has files but no package.json.`);
      console.error("Run superimg init inside an existing JS/TS project, or choose a new directory name.\n");
      process.exit(1);
    }
  }

  const videosDir = join(targetDir, "videos");
  const templateTsPath = join(videosDir, "intro.video.ts");
  const templateJsPath = join(videosDir, "intro.video.js");

  if (existsSync(templateTsPath) || existsSync(templateJsPath)) {
    const existing = existsSync(templateTsPath) ? "intro.video.ts" : "intro.video.js";
    console.error(`\nvideos/${existing} already exists.`);
    console.error("Delete it first, or run superimg init in a different directory.\n");
    process.exit(1);
  }

  let useJs: boolean;
  let pm: PackageManager;
  let skipInstall: boolean;
  let skipBrowser: boolean;
  let projectName: string;

  if (options.yes) {
    // Use defaults: TS, auto-detect pm, install + browser
    if (!existingProject && (name === "." || !name?.trim())) {
      projectName = "my-video";
      targetDir = join(process.cwd(), "my-video");
    } else {
      projectName = name === "." ? "my-superimg-project" : name;
    }
    const hasTs = existingProject && existsSync(join(targetDir, "tsconfig.json"));
    useJs = options.js ?? (existingProject ? !hasTs : false);
    pm = resolvePackageManager(options.pm);
    skipInstall = options.skipInstall ?? false;
    skipBrowser = options.skipBrowser ?? false;
  } else {
    // Interactive mode
    p.intro("SuperImg  —  HTML/CSS → MP4");
    projectName = name === "." ? "my-superimg-project" : name;

    if (!existingProject && (name === "." || !name?.trim())) {
      const dirName = await p.text({
        message: "Where should we create your project?",
        placeholder: "my-superimg-project",
        initialValue: "my-superimg-project",
      });
      if (p.isCancel(dirName)) {
        p.cancel("Setup cancelled. Run superimg init whenever you're ready.");
        process.exit(1);
      }
      projectName = (dirName as string).trim() || "my-superimg-project";
      targetDir = join(process.cwd(), projectName);
    }

    const detectedPm = detectPackageManager();
    const pmResult = await p.select({
      message: "Which package manager do you use?",
      options: [
        { value: "npm", label: "npm" },
        { value: "pnpm", label: "pnpm" },
        { value: "yarn", label: "yarn" },
        { value: "bun", label: "bun" },
      ],
      initialValue: detectedPm,
    });
    if (p.isCancel(pmResult)) {
      p.cancel("Setup cancelled. Run superimg init whenever you're ready.");
      process.exit(1);
    }
    pm = pmResult as PackageManager;

    if (!existingProject) {
      const langResult = await p.select({
        message: "TypeScript or JavaScript?",
        options: [
          { value: "ts", label: "TypeScript" },
          { value: "js", label: "JavaScript" },
        ],
        initialValue: "ts",
      });
      if (p.isCancel(langResult)) {
        p.cancel("Setup cancelled. Run superimg init whenever you're ready.");
        process.exit(1);
      }
      useJs = langResult === "js";
    } else {
      const hasTs = existsSync(join(targetDir, "tsconfig.json"));
      useJs = !hasTs;
    }

    const installResult = await p.confirm({
      message: "Install dependencies now?",
      initialValue: true,
    });
    if (p.isCancel(installResult)) {
      p.cancel("Setup cancelled. Run superimg init whenever you're ready.");
      process.exit(1);
    }
    skipInstall = !installResult;

    const browserResult = await p.confirm({
      message: "Download Chromium for rendering? (~170MB, one-time)",
      initialValue: true,
    });
    if (p.isCancel(browserResult)) {
      p.cancel("Setup cancelled. Run superimg init whenever you're ready.");
      process.exit(1);
    }
    skipBrowser = !browserResult;
  }

  const templateFileName = useJs ? "intro.video.js" : "intro.video.ts";
  const configFile = "_config.ts";
  const finalTemplatePath = join(targetDir, "videos", templateFileName);
  const configPath = join(targetDir, "videos", configFile);
  const finalVideosDir = join(targetDir, "videos");

  const { install, run } = getPackageManagerCommands(pm);

  if (existingProject) {
    // ── Add to existing project ──
    mkdirSync(finalVideosDir, { recursive: true });
    writeFileSync(finalTemplatePath, useJs ? TEMPLATE_JS : TEMPLATE_TS);
    if (!useJs) {
      writeFileSync(configPath, CONFIG_TS);
    }

    const agentsPath = join(targetDir, "AGENTS.md");
    const wroteAgents = !existsSync(agentsPath);
    if (wroteAgents) {
      writeFileSync(agentsPath, getSkillContent());
    }

    const version = getSuperimgVersion();
    const versionRange = version === "latest" ? "latest" : `^${version}`;

    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
    pkg.scripts = pkg.scripts ?? {};
    pkg.scripts["superimg:dev"] = "superimg dev";
    pkg.scripts["superimg:render"] = "superimg render intro";
    pkg.scripts["superimg:setup"] = "superimg setup";
    pkg.dependencies = pkg.dependencies ?? {};
    if (!pkg.dependencies.superimg) pkg.dependencies.superimg = versionRange;
    if (!pkg.dependencies.playwright) pkg.dependencies.playwright = "^1.57.0";
    writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + "\n");

    if (!options.yes) {
      p.log.step("SuperImg added to your project");
      p.log.message(`videos/${templateFileName}   starter template with a fade-in animation`);
      if (!useJs) {
        p.log.message(`videos/${configFile}       set your canvas size, fps, and duration`);
      }
      if (wroteAgents) {
        p.log.message(`AGENTS.md         AI assistant skill (SuperImg context)`);
      }
      p.log.message(`superimg:dev      live preview in your browser`);
      p.log.message(`superimg:render   export to MP4`);
      p.log.message(`superimg:setup    download Chromium (run once)`);
    }

    if (!skipInstall) {
      const addCommand = getAddPackagesCommand(pm, ["superimg", "playwright"]);
      const s = p.spinner();
      s.start("Installing dependencies");
      try {
        const [cmd, ...args] = addCommand.split(/\s+/);
        await runInDir(targetDir, cmd, args);
        s.stop("Dependencies installed");
      } catch (err) {
        s.stop("Dependency install failed");
        console.error("\nRun this yourself:");
        console.error(`  ${addCommand}\n`);
        process.exit(1);
      }

      if (!skipBrowser) {
        const execCmd = pm === "npm" ? "npx" : pm === "yarn" ? "yarn" : pm === "pnpm" ? "pnpm" : "bunx";
        const execArgs = pm === "yarn" ? ["exec", "playwright", "install", "chromium"] : ["playwright", "install", "chromium"];
        const s2 = p.spinner();
        s2.start("Downloading Chromium (this takes a minute)");
        try {
          await runInDir(targetDir, execCmd, execArgs);
          s2.stop("Chromium ready");
        } catch (err) {
          s2.stop("Chromium download failed");
          console.error("\nRun this to try again:");
          console.error(`  ${run} superimg:setup\n`);
          process.exit(1);
        }
      }
    }

    if (!options.yes) {
      p.outro("You're ready. Start here:");
      console.log(`\n  ${run} superimg:dev      open the live preview`);
      console.log(`  ${run} superimg:render   export your first video\n`);
    } else {
      console.log("\nSuperImg added to your project.");
      console.log(`  ${run} superimg:dev      open the live preview`);
      console.log(`  ${run} superimg:render   export your first video\n`);
    }
  } else {
    // ── New project ──
    if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
    mkdirSync(finalVideosDir, { recursive: true });

    const version = getSuperimgVersion();
    const versionRange = version === "latest" ? "latest" : `^${version}`;

    const packageJson = {
      name: projectName,
      version: "0.1.0",
      private: true,
      type: "module",
      scripts: {
        setup: "superimg setup",
        dev: "superimg dev",
        render: "superimg render intro",
      },
      dependencies: {
        superimg: versionRange,
        playwright: "^1.57.0",
      },
    };

    writeFileSync(join(targetDir, "package.json"), JSON.stringify(packageJson, null, 2) + "\n");
    writeFileSync(finalTemplatePath, useJs ? TEMPLATE_JS : TEMPLATE_TS);
    if (!useJs) {
      writeFileSync(configPath, CONFIG_TS);
      writeFileSync(join(targetDir, "tsconfig.json"), TSCONFIG);
    }
    writeFileSync(join(targetDir, "AGENTS.md"), getSkillContent());

    if (!skipInstall) {
      const s = p.spinner();
      s.start("Installing dependencies");
      try {
        const [cmd, ...args] = install.split(/\s+/);
        await runInDir(targetDir, cmd, args);
        s.stop("Dependencies installed");
      } catch (err) {
        s.stop("Dependency install failed");
        console.error("\nRun this yourself:");
        if (projectName !== ".") console.error(`  cd ${projectName}\n`);
        console.error(`  ${install}\n`);
        process.exit(1);
      }

      if (!skipBrowser) {
        const execCmd = pm === "npm" ? "npx" : pm === "yarn" ? "yarn" : pm === "pnpm" ? "pnpm" : "bunx";
        const execArgs = pm === "yarn" ? ["exec", "playwright", "install", "chromium"] : ["playwright", "install", "chromium"];
        const s2 = p.spinner();
        s2.start("Downloading Chromium (this takes a minute)");
        try {
          await runInDir(targetDir, execCmd, execArgs);
          s2.stop("Chromium ready");
        } catch (err) {
          s2.stop("Chromium download failed");
          console.error("\nRun this to try again:");
          console.error(`  ${run} setup\n`);
          process.exit(1);
        }
      }
    }

    if (!options.yes) {
      p.outro("You're ready. Start here:");
    }
    if (projectName !== ".") {
      console.log(`\n  cd ${projectName}`);
    }
    console.log(`  ${run} dev      open the live preview`);
    console.log(`  ${run} render   export your first video\n`);
  }
}
