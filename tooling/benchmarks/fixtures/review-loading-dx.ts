import { image } from '@superimg/types';
import { createMediaRenderResult } from '@superimg/core/runtime';
import { prepareRuntimeResources } from '../../../packages/superimg-browser-export/src/runtime/resources.js';

const assert = (condition: unknown, message: string) => { if (!condition) throw Error(message); };
(globalThis as any).reviewLoadingDx = async (sizes: number[]) => {
  const results = [];
  for (const byteLength of sizes) {
    const input = new Uint8Array(byteLength).fill(73);
    const media = image({ assets: { payload: { bytes: input, mimeType: 'application/octet-stream' } }, render: () => { throw Error('not rendering'); } });
    const samples = [];
    for (let index = -1; index < 5; index++) {
      const start = performance.now();
      const resources = await prepareRuntimeResources(media, fetch, undefined, false);
      const freezeOnlyMs = performance.now() - start;
      // Force the same complete projection for both eager and lazy resource
      // implementations. Metadata consumers stop at freezeOnlyMs instead.
      const urls = resources.assetUrls;
      const fontCss = resources.fontCss;
      const preparationMs = performance.now() - start;
      const materializationMs = preparationMs - freezeOnlyMs;
      assert(fontCss.length === 0, 'font-free workload');
      assert(resources.findings.length === 0 && resources.assets[0]?.byteLength === byteLength, 'frozen asset');
      const encoded = urls.payload!.split(',')[1]!;
      assert(encoded.length === Math.ceil(byteLength / 3) * 4, 'base64 length');
      const decoded = atob(encoded);
      assert(decoded.length === byteLength, 'decoded byte length');
      for (let byte = 0; byte < decoded.length; byte++) assert(decoded.charCodeAt(byte) === 73, 'complete base64 content');
      const ownershipStart = performance.now();
      const result = createMediaRenderResult({ as: 'png', mimeType: 'image/png', coordinates: { variantId: 'default', editionId: 'default' }, bytes: input });
      const ownershipMs = performance.now() - ownershipStart;
      const readStart = performance.now();
      const read = await result.bytes();
      const readMs = performance.now() - readStart;
      assert(read.byteLength === byteLength && read.every(value => value === 73), 'complete read content');
      input[0] = 11;
      assert((await result.bytes())[0] === 73, 'constructor owns input bytes');
      input[0] = 73;
      read[0] = 0;
      assert((await result.bytes())[0] === 73, 'caller mutations isolated');
      if (index >= 0) samples.push({ freezeOnlyMs, materializationMs, preparationMs, ownershipMs, readMs });
    }
    results.push({ byteLength, samples });
  }
  return results;
};
