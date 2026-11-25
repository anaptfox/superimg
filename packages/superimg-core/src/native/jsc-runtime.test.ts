import { describe, expect, it } from "vitest";
import { createNativeRuntime, decodeBase64, installNativeRuntime } from "./jsc-runtime.js";

const programCode = `var __template = { default: {
  kind: 'media', animated: true, medium: 'html', sample: { title: 'Sample' },
  config: { width: 100, height: 100, fps: 10, duration: 3 },
  editions: { square: { size: { width: 60, height: 60 }, render: ctx => node('Text', { id: 'edition' }, [ctx.data.title]) } },
  render: ctx => node('Frame', { width: ctx.width, height: ctx.height }, [
    node('Text', { id: 'title' }, [ctx.data.title]),
    node('Fill', { id: 'bar', width: 10 + ctx.timeline.seconds * 10, height: 10, color: '#ff0000' }, [])
  ])
} }; function node(type, props, children) { return { $$typeof: '@foxworth/superimg/element', type, props, children }; }`;
const payload = { programCode, media: {}, job: { width: 100, height: 100, fps: 10, durationSeconds: 3, totalFrames: 30, animated: true, medium: 'html', data: { title: 'Job' } } };

describe('native runtime', () => {
  it('loads, samples, switches editions and disposes', () => {
    const runtime = createNativeRuntime();
    const loaded = runtime.loadArtifact(payload);
    expect(loaded.defaultData).toEqual({ title: 'Job' });
    const early = runtime.sampleArtifact(loaded.id, { seconds: 0, data: { title: 'Override' } });
    const hold = runtime.sampleArtifact(loaded.id, { seconds: 1.5 });
    const exit = runtime.sampleArtifact(loaded.id, { seconds: 3 });
    expect(JSON.stringify(early)).toContain('Override');
    expect(JSON.stringify(hold)).toContain('Job');
    expect(early).not.toEqual(hold);
    expect(hold).not.toEqual(exit);
    expect(runtime.sampleArtifact(loaded.id, { edition: 'square' })).toMatchObject({ width: 60, height: 60 });
    runtime.disposeArtifact(loaded.id);
    expect(() => runtime.sampleArtifact(loaded.id)).toThrow('Unknown artifact');
  });
  it('decodes base64 without host APIs and installs on a target', () => {
    expect([...decodeBase64('AP+A/w==')]).toEqual([0, 255, 128, 255]);
    expect(() => decodeBase64('!')).toThrow();
    const target = {};
    expect(installNativeRuntime(target)).toBe((target as { __superimgNative: unknown }).__superimgNative);
  });
});
