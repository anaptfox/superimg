//! Init command - scaffold a new SuperImg template project

import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePackageManager, getPackageManagerCommands } from "../utils/package-manager.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const TEMPLATE_TS = `import { defineTemplate } from "superimg";

export default defineTemplate({
  defaults: {
    message: "Hello, SuperImg!",
  },

  config: {
    fps: 30,
    durationSeconds: 3,
    width: 1920,
    height: 1080,
  },

  render(ctx) {
    const { std, sceneTimeSeconds: time, width, height, data } = ctx;
    const progress = std.math.clamp(time / 1.0, 0, 1);
    const eased = std.easing.easeOutCubic(progress);
    const opacity = std.math.lerp(0, 1, eased);
    const y = std.math.lerp(30, 0, eased);

    return \`
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          width: \${width}px;
          height: \${height}px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0f0f23;
          font-family: system-ui, sans-serif;
        }
        .message {
          color: white;
          font-size: 64px;
          font-weight: 700;
          opacity: \${opacity};
          transform: translateY(\${y}px);
        }
      </style>
      <div class="message">\${data.message}</div>
    \`;
  },
});
`;

const TEMPLATE_JS = `import { defineTemplate } from "superimg";

export default defineTemplate({
  defaults: {
    message: "Hello, SuperImg!",
  },

  config: {
    fps: 30,
    durationSeconds: 3,
    width: 1920,
    height: 1080,
  },

  render(ctx) {
    const { std, sceneTimeSeconds: time, width, height, data } = ctx;
    const progress = std.math.clamp(time / 1.0, 0, 1);
    const eased = std.easing.easeOutCubic(progress);
    const opacity = std.math.lerp(0, 1, eased);
    const y = std.math.lerp(30, 0, eased);

    return \`
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          width: \${width}px;
          height: \${height}px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0f0f23;
          font-family: system-ui, sans-serif;
        }
        .message {
          color: white;
          font-size: 64px;
          font-weight: 700;
          opacity: \${opacity};
          transform: translateY(\${y}px);
        }
      </style>
      <div class="message">\${data.message}</div>
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

export async function initCommand(name: string, options: { js?: boolean; pm?: string }) {
  const targetDir = join(process.cwd(), name === "." ? "" : name);
  const dirExists = existsSync(targetDir);
  const pkgJsonPath = join(targetDir, "package.json");
  const existingProject = dirExists && existsSync(pkgJsonPath);

  // Non-empty dir with no package.json — not a JS/TS project, bail
  if (dirExists && !existingProject) {
    const entries = readdirSync(targetDir).filter((e) => !e.startsWith("."));
    if (entries.length > 0) {
      console.error(`\n  Error: "${name === "." ? "Current directory" : name}" is not empty and has no package.json.`);
      console.error("  Run superimg init inside a JS/TS project, or provide a new directory name.\n");
      process.exit(1);
    }
  }

  // Auto-detect TS: in existing projects, check for tsconfig.json; for new projects default to TS
  const hasTs = existingProject && existsSync(join(targetDir, "tsconfig.json"));
  const useJs = options.js ?? (existingProject ? !hasTs : false);
  const templateFile = useJs ? "intro.js" : "intro.ts";
  const videosDir = join(targetDir, "videos");
  const templatePath = join(videosDir, templateFile);

  if (existsSync(templatePath)) {
    console.error(`\n  Error: videos/${templateFile} already exists.`);
    console.error("  Remove it first or pick a different directory.\n");
    process.exit(1);
  }

  const pm = resolvePackageManager(options.pm);
  const { install, add: addCmd, run } = getPackageManagerCommands(pm);

  if (existingProject) {
    // ── Add to existing project ──
    mkdirSync(videosDir, { recursive: true });
    writeFileSync(templatePath, useJs ? TEMPLATE_JS : TEMPLATE_TS);

    // Inject superimg:* scripts into the existing package.json
    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
    pkg.scripts = pkg.scripts ?? {};
    pkg.scripts["superimg:dev"] = `superimg dev videos/${templateFile}`;
    pkg.scripts["superimg:render"] = `superimg render videos/${templateFile} -o output.mp4`;
    pkg.scripts["superimg:setup"] = "superimg setup";
    writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + "\n");

    console.log("\n  Existing project detected\n");
    console.log("  Created:");
    console.log(`    videos/${templateFile}   Example template with fade-in animation\n`);
    console.log("  Added scripts to package.json:");
    console.log(`    superimg:dev             Preview in browser`);
    console.log(`    superimg:render          Render to MP4`);
    console.log(`    superimg:setup           Install browser (one-time)\n`);
    console.log("  Get started:\n");
    console.log(`    ${addCmd}`);
    console.log(`    ${run} superimg:dev\n`);
    console.log("  Render to video:\n");
    console.log(`    ${run} superimg:setup`);
    console.log(`    ${run} superimg:render\n`);
  } else {
    // ── New project ──
    if (!dirExists) mkdirSync(targetDir, { recursive: true });
    mkdirSync(videosDir, { recursive: true });

    const projectName = name === "." ? "my-superimg-project" : name;
    const version = getSuperimgVersion();
    const versionRange = version === "latest" ? "latest" : `^${version}`;

    const packageJson = {
      name: projectName,
      version: "0.1.0",
      private: true,
      type: "module",
      scripts: {
        setup: "superimg setup",
        dev: `superimg dev videos/${templateFile}`,
        render: `superimg render videos/${templateFile} -o output.mp4`,
      },
      dependencies: {
        superimg: versionRange,
      },
    };

    writeFileSync(join(targetDir, "package.json"), JSON.stringify(packageJson, null, 2) + "\n");
    writeFileSync(templatePath, useJs ? TEMPLATE_JS : TEMPLATE_TS);

    if (!useJs) {
      writeFileSync(join(targetDir, "tsconfig.json"), TSCONFIG);
    }

    console.log("\n  SuperImg project created!\n");
    console.log("  Next steps:\n");
    if (name !== ".") {
      console.log(`    cd ${name}`);
    }
    console.log(`    ${install}`);
    console.log(`    ${run} dev\n`);
    console.log("  Render to video:\n");
    console.log(`    ${run} setup`);
    console.log(`    ${run} render\n`);
  }
}
