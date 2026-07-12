//! Validate command — render sample frames and report errors without full render.

import { readFileSync } from "node:fs";
import { validateAITemplate, formatValidationForAI } from "@superimg/core/validation";
import { resolveTemplatePath } from "../utils/resolve-template.js";
import { formatError } from "@superimg/core/errors";

export async function validateCommand(
  template: string,
  options: { frames: string; json?: boolean; craft?: boolean; craftStrict?: boolean },
) {
  let templatePath: string;
  try {
    templatePath = resolveTemplatePath(template);
  } catch (err) {
    const formatted = formatError(err);
    if (options.json) {
      console.log(JSON.stringify({ error: formatted.json }));
      process.exit(1);
    }
    console.error(`\n  Error: ${formatted.plain}\n`);
    process.exit(1);
  }

  const frameCount = Math.max(2, Math.min(20, parseInt(options.frames, 10) || 5));
  const sampleFrames = Array.from({ length: frameCount }, (_, i) =>
    frameCount === 1 ? 0.5 : i / (frameCount - 1)
  );

  let code: string;
  try {
    code = readFileSync(templatePath, "utf-8");
  } catch (err) {
    const formatted = formatError(err);
    if (options.json) {
      console.log(JSON.stringify({ error: formatted.json }));
      process.exit(1);
    }
    console.error(`\n  Error: cannot read template: ${formatted.plain}\n`);
    process.exit(1);
  }

  if (!options.json) {
    console.log(`\n  Validating ${template}...\n`);
  }

  let result: Awaited<ReturnType<typeof validateAITemplate>>;
  try {
    result = await validateAITemplate(code, {
      sampleFrames,
      craft: options.craft || options.craftStrict,
      craftStrict: options.craftStrict,
    });
  } catch (err) {
    const formatted = formatError(err);
    if (options.json) {
      console.log(JSON.stringify({ error: formatted.json }));
      process.exit(1);
    }
    console.error(`  ✗ Validation failed: ${formatted.plain}\n`);
    process.exit(1);
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    if (!result.valid) process.exit(1);
    return;
  }

  const craftIssues = result.issues.filter((i) => i.code.startsWith("CRAFT_"));
  const hardIssues = result.issues.filter((i) => !i.code.startsWith("CRAFT_"));

  if (result.valid) {
    const ms = result.validationTimeMs.toFixed(0);
    console.log(`  ✓ Template valid — ${result.samples?.length ?? 0} frames rendered in ${ms}ms`);
    if (craftIssues.length > 0) {
      console.log(`\n  Craft (${craftIssues.length}):`);
      for (const i of craftIssues) {
        const mark = i.severity === "error" ? "✗" : "⚠";
        console.log(`    ${mark} [${i.code}] ${i.message}`);
        if (i.suggestion) console.log(`      → ${i.suggestion}`);
      }
    }
    console.log("");
    return;
  }

  console.error(`  ✗ Validation failed:\n`);
  console.error(formatValidationForAI(result).replace(/^/gm, "  "));
  if (hardIssues.length === 0 && craftIssues.length > 0) {
    console.error("\n  (craft-strict mode treats craft warnings as errors)\n");
  }
  console.error("");
  process.exit(1);
}
