//! `superimg package` — content-addressed TemplatePackage under .superimg/packages/

import { join } from "node:path";
import { discoverVideos } from "../utils/discover-videos.js";
import { packageTemplates } from "../../package/package-templates.js";

export interface PackageCommandOptions {
  out?: string;
  all?: boolean;
}

export async function packageCommand(
  templateArg: string | undefined,
  options: PackageCommandOptions,
): Promise<void> {
  const cwd = process.cwd();
  const outRoot = join(cwd, options.out ?? ".superimg/packages");

  const discovered = discoverVideos(cwd);
  if (discovered.length === 0) {
    process.stderr.write("error: no *.media.ts templates found\n");
    process.exit(1);
  }

  let entries = discovered.map((d) => ({
    name: d.name,
    entrypoint: d.entrypoint,
  }));

  if (templateArg) {
    entries = entries.filter(
      (e) =>
        e.name === templateArg ||
        e.entrypoint.includes(templateArg) ||
        e.name.includes(templateArg),
    );
    if (entries.length === 0) {
      process.stderr.write(`error: no template matching "${templateArg}"\n`);
      process.exit(1);
    }
  }

  process.stdout.write(`Packaging ${entries.length} template(s) → ${outRoot}\n`);
  const packaged = await packageTemplates({ cwd, outRoot, entries });

  for (const p of packaged) {
    process.stdout.write(
      `  ${p.sourceId}  ${p.packageHash.slice(0, 12)}…  →  ${p.relativePath}\n`,
    );
  }
  process.stdout.write(`Done. ${packaged.length} package(s).\n`);
}
