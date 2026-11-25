import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { materialSourceDigest, materialSourceHashes } from '../tools/source-hashes.mjs';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'material-source-hash-test-'));
  const put = async (path: string, content = path) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), content); };
  for (const path of ['examples/showcase/sandglass/model.ts', 'examples/showcase/_material/resources.ts',
    'examples/apps/material-studies/src/main.ts', 'examples/apps/material-studies/tools/benchmark-browser.mjs',
    'examples/apps/material-studies/tools/source-hashes.mjs', 'examples/apps/material-studies/vite.config.ts']) await put(path);
  for (const name of ['superimg', 'superimg-media', 'superimg-core', 'superimg-player', 'superimg-interactive', 'superimg-stdlib', 'superimg-types']) {
    await put(`packages/${name}/dist/index.js`); await put(`packages/${name}/package.json`, '{}');
  }
  return { root, put, digest: async () => materialSourceDigest(await materialSourceHashes(root, 'sandglass')) };
}

describe('benchmark source oracle', () => {
  it('does not invalidate itself when measurement and qualification results are published', async () => {
    const f = await fixture();
    try {
      const before = await f.digest();
      await f.put('output/material-studies/benchmarks/sandglass-full.json', '{"measured":true}');
      await f.put('examples/apps/material-studies/public/portfolio/qualification.json', '{"kind":"result"}');
      await f.put('examples/showcase/sandglass/output/review/report.json', '{"status":"pass"}');
      expect(await f.digest()).toBe(before);
    } finally { await rm(f.root, { recursive: true, force: true }); }
  });
  it('invalidates changed artwork, host and executable browser runtime bytes', async () => {
    const f = await fixture();
    try {
      for (const path of ['examples/showcase/sandglass/model.ts', 'examples/apps/material-studies/src/main.ts', 'packages/superimg/dist/index.js']) {
        const before = await f.digest(); const previous = await readFile(join(f.root, path), 'utf8');
        await f.put(path, `${previous}\nchanged`);
        expect(await f.digest()).not.toBe(before);
      }
    } finally { await rm(f.root, { recursive: true, force: true }); }
  });
});
