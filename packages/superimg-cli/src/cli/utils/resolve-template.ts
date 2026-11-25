// CLI owns presentation of resolution diagnostics; policy lives in the Node library.
import { resolveTemplatePath as resolvePath, resolveTemplatePathOrSole as resolvePathOrSole } from "@foxworth/superimg-node/project-tools";
export { resolveSoleProjectTemplate } from "@foxworth/superimg-node/project-tools";
const warn = (message: string) => console.warn(`Warning: ${message}`);
export function resolveTemplatePath(input: string, cwd = process.cwd()): string {
  return resolvePath(input, cwd, warn);
}
export function resolveTemplatePathOrSole(input: string | undefined, cwd = process.cwd()): string {
  return resolvePathOrSole(input, cwd, warn);
}
