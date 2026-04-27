import { parseNpmPackage, fetchNpmDownloads } from "./fetch";

/**
 * Optional live loader: set NPM_PACKAGE to fetch real npm stats.
 * Without the env var, the template renders with its built-in preview data.
 */
export default async function loadNpmStatsData() {
  const input = process.env.NPM_PACKAGE;
  if (!input) return undefined;

  const packageName = parseNpmPackage(input);
  if (!packageName) throw new Error(`Invalid npm package name: ${input}`);

  const data = await fetchNpmDownloads(packageName);
  return {
    downloads: data.downloads,
    package: data.package,
    description: data.description,
    totalDownloads: data.totalDownloads,
  };
}
