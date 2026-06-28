import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TEMPLATES_DIR = join(dirname(fileURLToPath(import.meta.url)), "templates");

/** Load a template file from src/deploy/templates/ by filename. */
export function loadTemplate(filename: string): string {
  return readFileSync(join(TEMPLATES_DIR, filename), "utf-8");
}

/** Replace all {{KEY}} placeholders in a template string. Throws on unresolved placeholders. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key: string) => {
    if (!(key in vars)) throw new Error(`Unresolved template placeholder: {{${key}}}`);
    return vars[key] ?? match;
  });
}
