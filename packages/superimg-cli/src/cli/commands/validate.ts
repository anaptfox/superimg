//! Validate command — render sample frames and report errors without full render.

import { readFileSync } from "node:fs";
import { validateAITemplate, formatValidationForAI } from "@superimg/core/validation";
import { resolveTemplatePath } from "../utils/resolve-template.js";
import { formatError } from "@superimg/core/errors";

export async function validateCommand(template: string, options: { frames: string }) {
  let templatePath: string;
  try {
    templatePath = resolveTemplatePath(template);
  } catch (err) {
    console.error(`\n  Error: ${formatError(err).plain}\n`);
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
    console.error(`\n  Error: cannot read template: ${formatError(err).plain}\n`);
    process.exit(1);
  }

  console.log(`\n  Validating ${template}...\n`);

  let result: Awaited<ReturnType<typeof validateAITemplate>>;
  try {
    result = await validateAITemplate(code, { sampleFrames });
  } catch (err) {
    console.error(`  ✗ Validation failed: ${formatError(err).plain}\n`);
    process.exit(1);
  }

  if (result.valid) {
    const ms = result.validationTimeMs.toFixed(0);
    console.log(`  ✓ Template valid — ${result.samples?.length ?? 0} frames rendered in ${ms}ms\n`);
    return;
  }

  console.error(`  ✗ Validation failed:\n`);
  console.error(formatValidationForAI(result).replace(/^/gm, "  "));
  console.error("");
  process.exit(1);
}
