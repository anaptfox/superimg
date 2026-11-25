//! `superimg new` — copy a monorepo example into the current project's media library.

import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import * as p from "@clack/prompts";
import { findProjectRoot } from "../utils/find-project-root.js";
import {
  copyExampleIntoProject,
  findExamplesRoot,
  listScaffoldExamples,
} from "../../scaffold-project.js";

export async function newCommand(
  name: string | undefined,
  options: { yes?: boolean; example?: string; dir?: string },
) {
  const examplesRoot = findExamplesRoot();
  if (!examplesRoot) {
    console.error(
      "\n`superimg new` only copies monorepo examples (no generated starters).\n" +
        "Could not find examples/. Run from a SuperImg checkout or set SUPERIMG_EXAMPLES_ROOT.\n",
    );
    process.exit(1);
  }

  let projectRoot: string;
  try {
    projectRoot = findProjectRoot();
  } catch {
    console.error("\nNot inside a SuperImg project (no package.json walk found).\n");
    process.exit(1);
  }

  if (!existsSync(join(projectRoot, "package.json"))) {
    console.error("\nNo package.json in project root. Use `superimg init` first.\n");
    process.exit(1);
  }

  let example = options.example;
  let destName = name;

  if (!options.yes) {
    p.intro("Copy a monorepo example into the media library");
    if (!example) {
      const picked = await p.select({
        message: "Which example?",
        options: [
          { value: "hello-world", label: "hello-world" },
          { value: "request-journey", label: "request-journey (interactive)" },
          { value: "og-card", label: "og-card" },
        ],
        initialValue: "hello-world",
      });
      if (p.isCancel(picked)) {
        p.cancel("Cancelled.");
        process.exit(1);
      }
      example = picked as string;
    }
    if (!destName) {
      const t = await p.text({
        message: "Output name? Leave empty to keep example name.",
        placeholder: example,
      });
      if (p.isCancel(t)) {
        p.cancel("Cancelled.");
        process.exit(1);
      }
      destName = (t as string).trim() || undefined;
    }
  }

  example = example ?? "hello-world";

  try {
    const { templatePath, exampleKey, filesWritten } = copyExampleIntoProject(
      projectRoot,
      example,
      destName,
      options.dir === undefined ? {} : { contentDir: options.dir },
    );
    if (!options.yes) {
      p.outro(`${filesWritten.length > 0 ? "Copied" : "Already present"} \`${exampleKey}\` → ${templatePath}`);
    } else {
      console.log(`${filesWritten.length > 0 ? "Copied" : "Already present"} ${exampleKey} → ${templatePath}`);
    }
    const sourcePath = relative(projectRoot, templatePath).split(/[/\\]/).join("/");
    console.log(`  superimg dev ${sourcePath}`);
    console.log(`  superimg check ${sourcePath}\n`);
  } catch (err) {
    console.error(`\n${err instanceof Error ? err.message : String(err)}\n`);
    console.error("Aliases:");
    for (const line of listScaffoldExamples()) console.error(`  ${line}`);
    process.exit(1);
  }
}
