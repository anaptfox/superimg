import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
function sources(directory) {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? sources(path) : /\.tsx?$/.test(path) && !/\.test\./.test(path) ? [path] : [];
  });
}
test('shared library operations never import CLI surfaces or tool dispatch', () => {
  const files = [
    ...sources('packages/superimg-node/src/library'),
    'packages/superimg-core/src/ir/pure/comparison.ts',
    'packages/superimg-core/src/ir/pure/change-selectors.ts',
    'packages/superimg-core/src/ir/pure/semantic-diff.ts',
  ];
  for (const path of files) {
    const source = readFileSync(join(root, path), 'utf8');
    const imports = [...source.matchAll(/(?:from\s*|import\s*\(\s*)["']([^"']+)["']/g)].map(match => match[1]);
    for (const specifier of imports) {
      assert.ok(!/superimg-cli|\/cli\/|\/commands\/|@superimg\/interactions|@foxworth\/superimg-interactions/.test(specifier), `${path} imports surface ${specifier}`);
    }
    assert.ok(!/process\.exit(?:Code|\s*\()|console\.(?:log|error)\s*\(/.test(source), `${path} controls terminal output or exit`);
  }
});


test('CLI consumes public operation packages where supported', () => {
  const supported = new Set([
    '@superimg/interactions', '@superimg/node/source', '@superimg/node/source-evaluate',
    '@superimg/node/source-inspect', '@superimg/node/project-tools',
    '@superimg/node/review', '@superimg/node/review/advanced',
    '@superimg/node/arrangement', '@superimg/node/baseline', '@superimg/node/plate',
  ]);
  for (const path of sources('packages/superimg-cli/src')) {
    const source = readFileSync(join(root, path), 'utf8');
    const imports = [...source.matchAll(/(?:from\s*|import\s*\(\s*)["']([^"']+)["']/g)].map(match => match[1]);
    for (const specifier of imports) {
      assert.ok(!supported.has(specifier), `${path} bypasses public operation package: ${specifier}`);
    }
  }
});
