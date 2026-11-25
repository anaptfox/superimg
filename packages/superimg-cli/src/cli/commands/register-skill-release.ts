//! Skill, package, and deploy command registration (lazy-loaded actions).

import type { Command } from "commander";

export function registerSkillReleaseCommands(program: Command): void {
  const skill = program
    .command("skill")
    .description("Manage the SuperImg AI skill across coding agents (Claude, Codex, Cursor, Gemini, OpenCode, Pi, …)");

  skill
    .command("install")
    .description("Install the SuperImg skill into one or more host targets")
    .option("--host <ids>", "Comma-separated host IDs (e.g. claude,codex,cursor) or 'all'")
    .option("--all-hosts", "Install for every supported host")
    .option("--global", "Also install into global host paths (where supported)")
    .option("--global-only", "Install only into global host paths")
    .option("-y, --yes", "Skip prompts; use defaults / auto-detection")
    .action(async (options) => {
      const { installCommand } = await import("./skill/install.js");
      await installCommand(options);
    });

  skill
    .command("update")
    .description("Refresh existing skill installs to the bundled version")
    .option("--host <ids>", "Comma-separated host IDs or 'all'")
    .option("--all-hosts", "Update every supported host (default)")
    .option("--global", "Include global host paths (default: both project and global)")
    .option("--global-only", "Update only global host paths")
    .option("--check", "Print status without writing")
    .action(async (options) => {
      const { updateCommand } = await import("./skill/update.js");
      await updateCommand(options);
    });

  skill
    .command("list")
    .description("Show what's installed where, and at what version")
    .option("--global", "Show only global paths")
    .action(async (options) => {
      const { listCommand } = await import("./skill/list.js");
      await listCommand(options);
    });

  skill
    .command("remove")
    .description("Strip the SuperImg skill from installed targets")
    .option("--host <ids>", "Comma-separated host IDs or 'all'")
    .option("--all-hosts", "Remove from every supported host")
    .option("--global", "Also remove from global host paths")
    .option("--global-only", "Remove only from global host paths")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (options) => {
      const { removeCommand } = await import("./skill/remove.js");
      await removeCommand(options);
    });

  program
    .command("package")
    .argument("[template]", "Optional template name filter")
    .description(
      "Compile content-addressed TemplatePackages under .superimg/packages/<id>/<hash>/",
    )
    .option("--out <dir>", "Output root (default .superimg/packages)")
    .action(async (template, options) => {
      const { packageCommand } = await import("./package.js");
      await packageCommand(template, { out: options.out });
    });

  program
    .command("deploy")
    .argument("[template]", "Reserved for future parity checks")
    .description(
      "Provider-neutral OCI deploy: package templates, generate build context, docker build, optional --push",
    )
    .option("--image <ref>", "Image name:tag (default superimg-render:<profile>)")
    .option("--profile <name>", "Runtime profile: node|node-media|edge", "node")
    .option("--with-ffmpeg", "Include FFmpeg layer (node-media)")
    .option("--dry-run", "Write build context only (no docker build)")
    .option("--push", "docker push after build")
    .action(async (template, options) => {
      const { deployCommand } = await import("./deploy.js");
      await deployCommand(template, {
        image: options.image,
        dryRun: options.dryRun,
        push: options.push,
        profile: options.profile,
        withFfmpeg: options.withFfmpeg,
      });
    });
}
