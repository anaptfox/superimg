import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const root = await import('@foxworth/superimg');
assert.equal(typeof root.video, 'function');
const runtimeUrl = import.meta.resolve('@foxworth/superimg/runtime');
const require = createRequire(runtimeUrl);
for (const name of ['mediabunny', '@mediabunny/server', '@mediabunny/dts']) {
  assert.throws(() => require.resolve(name), { code: 'MODULE_NOT_FOUND' }, `${name} unexpectedly available`);
}
const runtime = await import(runtimeUrl);
try {
  await assert.rejects(runtime.inspectFile({ kind: 'bytes', bytes: new Uint8Array([0]) }), error => {
    assert.match(String(error), /mediabunny/i);
    return true;
  });
} finally { await runtime.shutdown(); }
console.log('root-only missing optional codec peers: expected failure');
