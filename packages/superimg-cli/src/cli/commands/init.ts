//! Init — copy a monorepo example into a new project (no generated starters).

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { execa } from "execa";
import * as p from "@clack/prompts";
import type { PackageManager } from "../utils/package-manager.js";
import {
  resolvePackageManager,
  getPackageManagerCommands,
} from "../utils/package-manager.js";
import { installCommand } from "./skill/install.js";
import { findProjectRoot } from "../utils/find-project-root.js";
import {
  scaffoldProject,
  listScaffoldExamples,
  findExamplesRoot,
  copyExampleIntoProject,
} from "../../scaffold-project.js";

async function runInDir(cwd: string, command: string, args: string[]): Promise<void> {
  await execa(command, args, { cwd, stdio: "inherit" });
}

function matchingCliVersion(superimgSpec: unknown): { version: string; needsNote: boolean } {
  if (typeof superimgSpec !== "string" || !superimgSpec) {
    return { version: SUPERIMG_VERSION, needsNote: false };
  }
  if (/^(?:\^|~|>=?|<=?|=)?\d/.test(superimgSpec) || superimgSpec === "latest") {
    return { version: superimgSpec, needsNote: false };
  }
  return { version: SUPERIMG_VERSION, needsNote: true };
}

declare const __SUPERIMG_VERSION__: string;

const SUPERIMG_VERSION: string = (() => {
  if (typeof __SUPERIMG_VERSION__ !== "string" || !__SUPERIMG_VERSION__) {
    throw new Error(
      "SUPERIMG_VERSION not injected at build time. Rebuild @foxworth/superimg-cli.",
    );
  }
  return __SUPERIMG_VERSION__;
})();

export async function initCommand(
  name: string,
  options: {
    yes?: boolean;
    pm?: string;
    skipInstall?: boolean;
    skipBrowser?: boolean;
    skipSkill?: boolean;
    /** Example name or path under examples/ (e.g. hello-world, request-journey, basics/hello-world). */
    example?: string;
    /** Authored content directory relative to the selected package root. */
    dir?: string;
  },
) {
  const examplesRoot = findExamplesRoot();
  if (!examplesRoot) {
    console.error(
      "\nScaffolding only copies packaged examples (no generated starters).\n" +
        "Could not find scaffold-examples/ or monorepo examples/.\n" +
        "Rebuild the CLI package, set SUPERIMG_EXAMPLES_ROOT, or copy examples manually.\n",
    );
    process.exit(1);
  }

  let targetDir = join(process.cwd(), name === "." ? "" : name);
  let usingAncestorOwner = false;
  if (name === "." && !existsSync(join(targetDir, "package.json"))) {
    try {
      const owner = findProjectRoot(process.cwd());
      if (resolve(owner) !== resolve(targetDir)) {
        targetDir = owner;
        usingAncestorOwner = true;
      }
    } catch {
      // With no owning package, `init .` retains standalone-project behavior.
    }
  }
  const dirExists = existsSync(targetDir);
  const pkgJsonPath = join(targetDir, "package.json");
  const existingProject = dirExists && existsSync(pkgJsonPath);

  if (dirExists && !existingProject) {
    const entries = readdirSync(targetDir).filter((e) => !e.startsWith("."));
    if (entries.length > 0 && name !== ".") {
      // scaffoldProject will also refuse non-empty; fail early with a clear message
    }
  }

  let pm: PackageManager;
  let skipInstall: boolean;
  let skipBrowser: boolean;
  let projectName: string;
  const preservedScriptConflicts: string[] = [];
  let example = options.example ?? "hello-world";

  if (options.yes) {
    if (!existingProject && (name === "." || !name?.trim())) {
      projectName = example === "request-journey" ? "request-journey" : "my-superimg-project";
      targetDir = join(process.cwd(), projectName);
    } else {
      projectName = name === "." ? "my-superimg-project" : name;
    }
    pm = resolvePackageManager(options.pm, targetDir);
    skipInstall = options.skipInstall ?? false;
    skipBrowser = options.skipBrowser ?? true;
  } else {
    p.intro("SuperImg  —  copy a monorepo example");
    projectName = name === "." ? "my-superimg-project" : name;

    if (!existingProject && (name === "." || !name?.trim())) {
      const dirName = await p.text({
        message: "Project directory name?",
        placeholder: "my-superimg-project",
        initialValue: "my-superimg-project",
      });
      if (p.isCancel(dirName)) {
        p.cancel("Cancelled.");
        process.exit(1);
      }
      projectName = (dirName as string).trim() || "my-superimg-project";
      targetDir = join(process.cwd(), projectName);
    }

    const exampleResult = await p.select({
      message: "Which example to copy?",
      options: [
        { value: "hello-world", label: "hello-world (basics)" },
        { value: "request-journey", label: "request-journey (interactive)" },
        { value: "og-card", label: "og-card (still image)" },
      ],
      initialValue: "hello-world",
    });
    if (p.isCancel(exampleResult)) {
      p.cancel("Cancelled.");
      process.exit(1);
    }
    example = exampleResult as string;

    const detectedPm = resolvePackageManager(undefined, targetDir);
    if (options.pm) {
      pm = resolvePackageManager(options.pm, targetDir);
    } else {
      const pmResult = await p.select({
        message: "Package manager?",
        options: [
          { value: "npm", label: "npm" },
          { value: "pnpm", label: "pnpm" },
          { value: "yarn", label: "yarn" },
          { value: "bun", label: "bun" },
        ],
        initialValue: detectedPm,
      });
      if (p.isCancel(pmResult)) {
        p.cancel("Cancelled.");
        process.exit(1);
      }
      pm = pmResult as PackageManager;
    }

    const installResult = await p.confirm({
      message: "Install dependencies now?",
      initialValue: true,
    });
    if (p.isCancel(installResult)) {
      p.cancel("Cancelled.");
      process.exit(1);
    }
    skipInstall = !installResult;

    const browserResult = await p.confirm({
      message: "Download Chromium for export now?",
      initialValue: false,
    });
    if (p.isCancel(browserResult)) {
      p.cancel("Cancelled.");
      process.exit(1);
    }
    skipBrowser = !browserResult;
  }

  let result;
  try {
    if (existingProject) {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
      const contentDir = options.dir ?? "media";
      const copied = copyExampleIntoProject(targetDir, example, undefined, { contentDir });
      pkg.scripts = pkg.scripts ?? {};
      if (Object.hasOwn(pkg.scripts, "media:dev") && pkg.scripts["media:dev"] !== "superimg dev") {
        preservedScriptConflicts.push("media:dev");
      }
      if (Object.hasOwn(pkg.scripts, "media:list") && pkg.scripts["media:list"] !== "superimg list") {
        preservedScriptConflicts.push("media:list");
      }
      if (!Object.hasOwn(pkg.scripts, "media:dev")) pkg.scripts["media:dev"] = "superimg dev";
      if (!Object.hasOwn(pkg.scripts, "media:list")) pkg.scripts["media:list"] = "superimg list";
      pkg.dependencies = pkg.dependencies ?? {};
      pkg.devDependencies = pkg.devDependencies ?? {};
      const dependencySections = [pkg.dependencies, pkg.devDependencies, pkg.optionalDependencies, pkg.peerDependencies]
        .filter((section) => section && typeof section === "object");
      const existingSuperimgSpec = dependencySections.find((section) => Object.hasOwn(section, "@foxworth/superimg"))?.["@foxworth/superimg"];
      const existingCliSpec = dependencySections.find((section) => Object.hasOwn(section, "@foxworth/superimg-cli"))?.["@foxworth/superimg-cli"];
      const hadSuperimgDependency = dependencySections.some((section) => Object.hasOwn(section, "@foxworth/superimg"));
      const hadCliDependency = dependencySections.some((section) => Object.hasOwn(section, "@foxworth/superimg-cli"));
      const matchingVersion = matchingCliVersion(existingSuperimgSpec ?? existingCliSpec);
      if (!hadSuperimgDependency) pkg.dependencies["@foxworth/superimg"] = matchingVersion.version;
      if (!hadCliDependency) {
        pkg.devDependencies["@foxworth/superimg-cli"] = matchingVersion.version;
      }
      const updatedManifest = JSON.stringify(pkg, null, 2) + "\n";
      const filesWritten = [...copied.filesWritten];
      if (readFileSync(pkgJsonPath, "utf-8") !== updatedManifest) {
        writeFileSync(pkgJsonPath, updatedManifest);
        filesWritten.push("package.json");
      }
      if (matchingVersion.needsNote && (!hadCliDependency || !hadSuperimgDependency)) {
        const addedDependency = hadCliDependency
          ? `@foxworth/superimg@${matchingVersion.version}`
          : `@foxworth/superimg-cli@${matchingVersion.version}`;
        console.warn(
          `Added ${addedDependency} alongside a custom dependency spec. ` +
            "That custom/workspace dependency spec cannot be matched automatically; verify the versions are compatible.",
        );
      }
      result = {
        projectRoot: targetDir,
        name: projectName,
        templatePath: copied.templatePath,
        exampleKey: copied.exampleKey,
        filesWritten,
      };
    } else {
      result = scaffoldProject({
        projectRoot: targetDir,
        name: projectName,
        example,
        superimgVersion: SUPERIMG_VERSION,
        ...(options.dir === undefined ? {} : { contentDir: options.dir }),
      });
    }
  } catch (err) {
    console.error(`\n${err instanceof Error ? err.message : String(err)}\n`);
    if (!options.yes) {
      console.error("Aliases:");
      for (const line of listScaffoldExamples()) console.error(`  ${line}`);
      console.error("");
    }
    process.exit(1);
  }

  const { install } = getPackageManagerCommands(pm);

  if (!options.yes) {
    p.log.step(`${result.filesWritten.length > 0 ? "Copied" : "Already present"} example \`${result.exampleKey}\``);
    p.log.message(`  ${result.templatePath}`);
  }

  if (!skipInstall) {
    const s = p.spinner();
    s.start("Installing dependencies");
    try {
      const [cmd, ...args] = install.split(/\s+/);
      if (!cmd) throw new Error("Invalid install command");
      await runInDir(targetDir, cmd, args);
      s.stop("Dependencies installed");
    } catch {
      s.stop("Dependency install failed");
      console.error("\nInstall deps yourself, then continue.\n");
      process.exit(1);
    }

    if (!skipBrowser) {
      const { exec } = getPackageManagerCommands(pm);
      const [execCmd, ...execPrefix] = exec.split(/\s+/);
      if (execCmd) {
        const s2 = p.spinner();
        s2.start("Installing Chromium for export");
        try {
          await runInDir(targetDir, execCmd, [...execPrefix, "superimg", "setup"]);
          s2.stop("Chromium ready");
        } catch {
          s2.stop("Chromium install failed — run setup later");
        }
      }
    }
  }

  await maybeInstallSkill(targetDir, options);

  if (!options.yes) {
    p.outro(result.filesWritten.length > 0 ? "Example ready. Next:" : "Example already present. Next:");
  }
  if (projectName !== "." && !existingProject) {
    console.log(`\n  cd ${projectName}`);
  }
  if (usingAncestorOwner) console.log(`\n  Using owning package ${targetDir}`);
  const relativeTemplate = relative(targetDir, result.templatePath).split(/[/\\]/).join("/");
  const { exec } = getPackageManagerCommands(pm);
  const [execCommand, ...execPrefix] = exec.split(/\s+/);
  const superimg = [execCommand, ...execPrefix, "superimg"].filter(Boolean).join(" ");
  if (preservedScriptConflicts.length > 0) {
    console.log(`\n  Preserved existing script(s): ${preservedScriptConflicts.join(", ")}`);
  }
  console.log(`  ${superimg} dev ${relativeTemplate}    live preview (no Chromium)`);
  console.log(`  ${superimg} list    list authored media`);
  console.log(`  ${superimg} check ${relativeTemplate}    pass/fail gate`);
  console.log(`  ${superimg} export --help    choose an export destination\n`);
}

async function maybeInstallSkill(
  targetDir: string,
  options: { yes?: boolean; skipSkill?: boolean },
): Promise<void> {
  if (options.skipSkill) return;

  let install = options.yes;
  if (!options.yes) {
    const result = await p.confirm({
      message: "Install the SuperImg AI skill for coding agents?",
      initialValue: true,
    });
    if (p.isCancel(result)) return;
    install = result;
  }
  if (!install) return;

  try {
    await installCommand({ yes: true });
  } catch {
    // Skill is optional
  }
}
