import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export const MATERIAL_STUDY_IDS = ['sandglass', 'cleft', 'returning-shore', 'borrowed-shapes', 'aster-basin'];

/** Result files are deliberately excluded: publishing measurements cannot change their oracle. */
export async function materialSourceHashes(root, id) {
  if (!MATERIAL_STUDY_IDS.includes(id)) throw new Error(`Unknown material study: ${id}`);
  const files = [];
  const walk = async (relative, extension = /\.(ts|css)$/) => {
    for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
      const path = `${relative}/${entry.name}`;
      if (entry.isDirectory() && !['output', 'assets', 'node_modules'].includes(entry.name)) await walk(path, extension);
      else if (entry.isFile() && extension.test(entry.name)) files.push(path);
    }
  };
  await walk(`examples/showcase/${id}`);
  await walk('examples/showcase/_material');
  await walk('examples/apps/material-studies/src');
  // Public browser imports use built packages. Pin executable bytes as well as artwork.
  for (const name of ['superimg', 'superimg-media', 'superimg-core', 'superimg-player', 'superimg-interactive', 'superimg-stdlib', 'superimg-types']) {
    await walk(`packages/${name}/dist`, /\.js$/);
    files.push(`packages/${name}/package.json`);
  }
  files.push('examples/apps/material-studies/tools/benchmark-browser.mjs',
    'examples/apps/material-studies/tools/source-hashes.mjs',
    'examples/apps/material-studies/vite.config.ts');
  files.sort();
  return Promise.all(files.map(async path => ({ path, sha256: createHash('sha256').update(await readFile(join(root, path))).digest('hex') })));
}

export function materialSourceDigest(files) {
  return createHash('sha256').update(JSON.stringify(files)).digest('hex');
}

export async function materialSourceDigests(root) {
  return Object.fromEntries(await Promise.all(MATERIAL_STUDY_IDS.map(async id => [id, materialSourceDigest(await materialSourceHashes(root, id))])));
}
