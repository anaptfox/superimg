//! Find files shipped in `@foxworth/superimg/dist/assets` when the running module was
//! bundled into an app (Next/Turbopack puts it under `.next/server`, so walking
//! up from `import.meta.url` never reaches the package). Resolution happens at
//! runtime from the app's working directory; bundlers cannot see it.

interface NodeModuleBuiltin {
  createRequire(filename: string): { resolve(specifier: string): string };
}

function nodeModuleBuiltin(): NodeModuleBuiltin | undefined {
  const proc = (globalThis as {
    process?: { cwd?: () => string; getBuiltinModule?: (id: string) => unknown };
  }).process;
  try {
    return proc?.getBuiltinModule?.("node:module") as NodeModuleBuiltin | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Absolute paths of `dist/assets/<relative>` in installed packages that ship
 * SuperImg assets, resolved from the process working directory. Empty outside
 * Node or when no package is installed there.
 */
export function installedAssetPaths(relative: string): string[] {
  const builtin = nodeModuleBuiltin();
  const proc = (globalThis as { process?: { cwd?: () => string } }).process;
  const cwd = proc?.cwd?.();
  if (!builtin || !cwd) return [];
  const require = builtin.createRequire(`${cwd.replace(/[\\/]$/, "")}/noop.js`);
  const paths: string[] = [];
  for (const name of ["@foxworth/superimg", "@foxworth/superimg-cli"]) {
    try {
      const manifest = require.resolve(`${name}/package.json`);
      const root = manifest.slice(0, manifest.length - "package.json".length);
      paths.push(`${root}dist/assets/${relative}`);
    } catch {
      // Not installed from this working directory.
    }
  }
  return paths;
}
