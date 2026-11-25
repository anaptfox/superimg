import { defineConfig } from 'vitest/config';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { materialSourceDigests } from './tools/source-hashes.mjs';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const ids = ['sandglass', 'cleft', 'returning-shore', 'borrowed-shapes', 'aster-basin'];

export default defineConfig({
  define: { __MATERIAL_SOURCE_ROOT__: JSON.stringify(root) },
  plugins: [{ name: 'material-study-source-digests',
    resolveId(id) { if (id === 'virtual:material-study-source-digests') return '\0material-study-source-digests'; },
    async load(id) {
      if (id !== '\0material-study-source-digests') return;
      const current = await materialSourceDigests(root);
      const unavailable = Object.fromEntries(ids.map(study => [study, 'unavailable']));
      return `const built = ${JSON.stringify(current)}, unavailable = ${JSON.stringify(unavailable)}; export async function currentSourceDigests() { if (!import.meta.env.DEV) return built; try { const response = await fetch('/api/material-studies/source-digests', { cache: 'no-store' }); if (!response.ok) return unavailable; const value = await response.json(); return Object.keys(built).every(id => typeof value[id] === 'string' && /^[0-9a-f]{64}$/.test(value[id])) ? value : unavailable; } catch { return unavailable; } }`;
    },
    configureServer(server) {
      server.middlewares.use('/api/material-studies/source-digests', async (_req, res) => {
        try {
          res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(await materialSourceDigests(root)));
        } catch (error) { res.statusCode = 500; res.end(JSON.stringify({ error: String(error) })); }
      });
    },
  }, { name: 'material-study-availability', configureServer(server) {
    server.middlewares.use('/api/material-studies', (_req, res) => {
      res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({ available: ids.filter(id => existsSync(join(root, 'examples/showcase', id, `${id}.media.ts`))) }));
    });
  } }],
  server: { host: '127.0.0.1', port: 4193, strictPort: true, fs: { allow: ['../../..'] } },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
