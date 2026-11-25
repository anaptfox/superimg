import { video, RenderExecutionError } from '@superimg/types';
import { Frame, Fill, Text } from '@superimg/stdlib/tree';
import { createExportBundle, createRuntime, exportMedia } from '@superimg/core/runtime';
import { createPausableJob } from '@superimg/core/runtime/job';
import { createBrowserRuntimeAdapter } from '@superimg/browser-export/runtime';

const coordinates = { variantId: 'default', editionId: 'default' };
const history: any[] = [];
const assert = (value: unknown, message: string) => { if (!value) throw Error(message); };
const scope = window as any;
let fonts: { family: string; weight: number; src: Uint8Array }[] = [];
const loadFonts = Promise.all([400, 500, 700].map(async weight => ({
  family: 'Fixture', weight, src: new Uint8Array(await (await fetch(`/font/${weight}`)).arrayBuffer()),
}))).then(value => { fonts = value; });
function media(frames: number, withText: boolean) {
  return video({
    size: { width: 160, height: 80 }, duration: `${frames}f`, fps: 30, fonts,
    render: ctx => Frame({ width: 'fill', height: 'fill' }, Fill({ color: '#ffffff' }),
      ...(withText ? [Text({ color: '#111827', fontFamily: 'Fixture', size: 22 }, `Frame ${ctx.timeline.frame}`)] : [])),
  });
}

scope.fontProbe = async (frames: number, withText: boolean) => {
  const definition = media(frames, withText);
  const adapter = createBrowserRuntimeAdapter({ defaultFonts: false });
  const selection = { media: definition, data: {}, coordinates };
  const request = { operation: 'render' as const, programDigest: 'a'.repeat(64), media: definition, selection, options: { as: 'html' as const } };
  const start = performance.now();
  const preflight = await adapter.preflight(request);
  assert(!preflight.findings.some(x => x.severity === 'error'), 'font preflight');
  const preparationMs = performance.now() - start;
  const samples: number[] = [];
  const widths: (string | null)[] = [];
  let htmlBytes = 0;
  // This is the actual adapter's exact-frame seam with one frozen resource set;
  // HTML encoding is included. It is not raster capture or video encoding.
  try {
    for (let frame = 0; frame < frames; frame++) {
      const t = performance.now();
      const result = await adapter.render({ ...request, preflight, options: { as: 'html', at: `${frame}f` } });
      samples.push(performance.now() - t);
      htmlBytes += result.bytes.byteLength;
      const html = new TextDecoder().decode(result.bytes);
      if (withText) {
        assert(html.includes(`Frame ${frame}`), `accepted font frame ${frame}`);
        const width = html.match(/<p\b[^>]*data-si-primitive="Text"[^>]*>/)?.[0].match(/width:([\d.]+)px/)?.[1];
        assert(width !== undefined && Number.isFinite(Number(width)) && Number(width) > 0, 'measured text width');
        widths.push(width!);
      }
    }
    return { frames, withText, preparationMs, firstMs: samples[0], samples, htmlBytes, widths };
  } finally { await preflight.dispose?.(); await adapter.dispose(); }
};

scope.fontExport = async (frames: number, withText: boolean) => {
  const runtime = createRuntime(createBrowserRuntimeAdapter({ defaultFonts: false }));
  const start = performance.now();
  try {
    const bundle = await exportMedia(runtime, media(frames, withText), {
      for: [{ id: 'font-film', format: 'webm', width: 160, height: 80 }],
    });
    const exportMs = performance.now() - start;
    try {
      const artifact = bundle.artifacts[0]!;
      const bytes = await artifact.bytes();
      assert(bytes.length > 100, 'encoded output');
      const url = URL.createObjectURL(new Blob([bytes], { type: artifact.mimeType }));
      const element = document.createElement('video');
      element.muted = true; element.src = url;
      document.body.append(element);
      try {
        await new Promise<void>((resolve, reject) => { element.onloadeddata = () => resolve(); element.onerror = () => reject(Error('decode failed')); });
        assert(element.videoWidth === 160 && element.videoHeight === 80, 'decoded dimensions');
        assert(Number.isFinite(element.duration) && Math.abs(element.duration - frames / 30) < 0.01, 'decoded duration');
        const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 80;
        const ctx = canvas.getContext('2d')!;
        const observations: any[] = [];
        for (const at of [0, Math.floor(frames / 2) / 30, (frames - 1) / 30]) {
          // loadeddata can precede the first compositor frame. Observe the
          // decoded frame presentation after an explicit seek, including zero.
          const presentedAt = await new Promise<number>((resolve, reject) => {
            let sought = false;
            let observed: number | undefined;
            let callback = 0;
            const cleanup = () => { clearTimeout(timeout); element.cancelVideoFrameCallback(callback); element.removeEventListener('seeked', onSeek); };
            const accept = () => { if (sought && observed !== undefined) { cleanup(); resolve(observed); } };
            const onSeek = () => { sought = true; accept(); };
            const observe = (_now: number, metadata: VideoFrameCallbackMetadata) => {
              if (Number.isFinite(metadata.mediaTime) && Math.abs(metadata.mediaTime - at) <= 0.002) {
                observed = metadata.mediaTime; accept();
              } else callback = element.requestVideoFrameCallback(observe);
            };
            const timeout = setTimeout(() => { cleanup(); reject(Error(`decoded frame ${at} not presented`)); }, 10_000);
            element.addEventListener('seeked', onSeek, { once: true });
            callback = element.requestVideoFrameCallback(observe);
            // Seek after WebM's millisecond rounding boundary, inside this frame.
            element.currentTime = at + 0.002;
          });
          ctx.drawImage(element, 0, 0);
          const pixels = ctx.getImageData(0, 0, 160, 80).data;
          const inkPixels = Array.from({ length: pixels.length / 4 }, (_, i) => pixels[i * 4]! < 128).filter(Boolean).length;
          if (withText) assert(inkPixels > 20 && inkPixels < 160 * 80 / 2, 'visible ink on a painted frame');
          const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', pixels))).map(x => x.toString(16).padStart(2, '0')).join('');
          observations.push({ at, seekTime: at + 0.002, presentedAt, sha256, inkPixels, png: canvas.toDataURL() });
        }
        if (withText) assert(new Set(observations.map(value => value.sha256)).size === observations.length, 'distinct visible frames');
        let binary = '';
        for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
        return { frames, withText, exportMs, byteLength: bytes.length, duration: element.duration, observations, encoded: btoa(binary) };
      } finally { element.remove(); URL.revokeObjectURL(url); }
    } finally { await bundle.dispose(); }
  } finally { await runtime.dispose(); }
};

scope.fontCancel = async () => {
  const adapter = createBrowserRuntimeAdapter({ defaultFonts: false });
  const controller = new AbortController();
  const definition = media(60, true);
  const request = {
    operation: 'export' as const, programDigest: 'a'.repeat(64), media: definition,
    options: { for: [{ id: 'cancel-film', format: 'webm' as const, width: 160, height: 80 }], signal: controller.signal },
  };
  const before = document.body.innerHTML;
  const preflight = await adapter.preflight(request);
  const checkpoints: number[] = [];
  const reason = new RenderExecutionError('aborted', 'resource benchmark cancellation');
  let rejected = false;
  try {
    await adapter.exportMedia({ ...request, preflight, lifecycle: {
      async checkpoint(completed = 0) {
        checkpoints.push(completed);
        // Deliver host cancellation after the encoder has installed its race
        // observers, as an external signal event rather than a throwing hook.
        if (completed >= 3) queueMicrotask(() => controller.abort(reason));
      },
      finalizing() { throw Error('cancelled export finalized'); },
    } });
  } catch (error) { assert(error === reason, 'cancellation reason preserved'); rejected = true; }
  finally { await preflight.dispose?.(); await adapter.dispose(); }
  assert(rejected && checkpoints.includes(3), 'cancel after real frame capture');
  assert(document.body.innerHTML === before, 'renderer DOM cleaned after cancellation');
  return { checkpoints, rejected, cleaned: true };
};

scope.memoryAllocate = async (count: number, bytesPerArtifact: number, retainRead = false) => {
  assert(history.length === 0, 'history must be empty');
  const job = createPausableJob('memory-diagnostic', async () => {
    const artifacts = Array.from({ length: count }, (_, i) => ({
      path: `frame-${i}.bin`, mimeType: 'application/octet-stream', coordinates: { ...coordinates, renditionId: `frame-${i}` },
      bytes: new Uint8Array(bytesPerArtifact).fill(i + 1),
    }));
    return createExportBundle({ programDigest: 'a'.repeat(64), assets: [], fonts: [], output: { coordinates: [coordinates], artifacts } });
  });
  const bundle = await job.result;
  history.push(job, bundle, ...bundle.artifacts);
  if (retainRead) history.push(await bundle.artifacts[0]!.bytes());
  return { count, bytesPerArtifact, historyItems: history.length };
};
scope.memoryDispose = async () => {
  const job = history[0];
  await job.dispose();
  const bundle = await job.result;
  assert(bundle === history[1], 'completed job retains result');
  let rejected = false;
  try { await bundle.artifacts[0].bytes(); } catch { rejected = true; }
  assert(rejected, 'reads reject after disposal');
  const callerRead = history.at(-1);
  if (callerRead instanceof Uint8Array) {
    assert(callerRead.byteLength === bundle.artifacts[0].byteLength && callerRead[0] === 1 && callerRead.at(-1) === 1, 'caller-owned read survives disposal');
  }
  return { historyItems: history.length, readable: false };
};
scope.memoryClear = () => { history.length = 0; };
void loadFonts.then(() => { scope.resourcesReady = true; });
