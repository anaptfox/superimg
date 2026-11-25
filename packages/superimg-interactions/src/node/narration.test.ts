import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  createNodeNarrationService,
  parseNarrationRecipe,
} from "./narration.js";
import { createWavPcm, SpeechDispatchUncertainError, type SpeechProvider } from "./speech/index.js";
import { createNodeMediaInteractionMount } from "./mount.js";
import type { Runtime } from "@superimg/types";
import { MediaInteractionUncertainError } from "../mount.js";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "narration-test-"));
  dirs.push(root);
  let calls = 0;
  const provider: SpeechProvider = {
    id: "piper",
    version: "fixture",
    fingerprint: () => ({ backend: "fixture", details: {} }),
    voices: async () => [{ id: "test", name: "Test" }],
    synthesize: async () => {
      calls++;
      return {
        wav: createWavPcm(new Uint8Array(96000), {
          sampleRate: 48000,
          channels: 1,
          bitsPerSample: 16,
        }),
        provenance: {
          provider: "piper",
          adapterVersion: "fixture",
          backend: { backend: "fixture", details: {} },
        },
      };
    },
  };
  const service = createNodeNarrationService({
    cacheDirectory: join(root, "cache"),
    providers: { piper: provider },
  });
  return { root, service, provider, calls: () => calls };
}
const recipe = {
  schemaVersion: 1,
  provider: "piper",
  voice: "test",
  mode: "natural",
  fps: 30,
  segments: [{ id: "hook", text: "Predict the answer.", afterSeconds: 1 }, {
    id: "reveal",
    text: "Here it is.",
  }],
};

describe("narration preparation", () => {
  it("dispatches preparation and review through the interaction boundary without private paths", async () => {
    const { root, provider } = await fixture();
    const mount = createNodeMediaInteractionMount({
      projectRoot: root,
      runtime: {} as Runtime,
      narration: {
        cacheDirectory: join(root, "cache"),
        providers: { piper: provider },
      },
    });
    const target = {
      targetId: "project-artifacts",
      artifactId: "test.narration",
    };
    const prepared = await mount.dispatch({
      interactionId: "media.narration.prepare",
      input: { recipe, target },
    }, {});
    expect(prepared.ok).toBe(true);
    expect(JSON.stringify(prepared)).not.toContain(root);
    const review = await mount.dispatch({
      interactionId: "media.narration.review",
      input: { target },
    }, {});
    expect(JSON.stringify(review)).not.toContain(root);
    expect(
      await readFile(
        join(root, "output", "test.narration", "review.html"),
        "utf8",
      ),
    ).toContain("<audio");
    await expect(
      mount.dispatch({
        interactionId: "media.narration.prepare",
        input: { recipe, target: { ...target, artifactId: "../escape" } },
      }, {}),
    ).rejects.toThrow();
  });
  it("preserves uncertain provider effects at the interaction boundary", async () => {
    const { root, provider } = await fixture();
    const uncertain: SpeechProvider = { ...provider, synthesize: async () => { throw new SpeechDispatchUncertainError("provider outcome unknown"); } };
    const mount = createNodeMediaInteractionMount({ projectRoot: root, runtime: {} as Runtime, narration: { cacheDirectory: join(root, "uncertain-cache"), providers: { piper: uncertain } } });
    await expect(mount.dispatch({ interactionId: "media.narration.prepare", input: { recipe, target: { targetId: "project-artifacts", artifactId: "uncertain" } } }, {})).rejects.toBeInstanceOf(MediaInteractionUncertainError);
  });
  it("publishes portable bytes and reuses independent clips after one sentence changes", async () => {
    const { root, service, calls } = await fixture();
    const path = join(root, "prepared");
    await service.prepare(recipe, path);
    expect(calls()).toBe(2);
    const manifest = JSON.parse(
      await readFile(join(path, "narration.json"), "utf8"),
    );
    expect(manifest.plan.durationSeconds).toBe(3);
    expect(JSON.stringify(manifest)).not.toContain(root);
    await rm(join(root, "prepared"), { recursive: true });
    await service.prepare({
      ...recipe,
      segments: [recipe.segments[0], {
        ...recipe.segments[1],
        text: "A different answer.",
      }],
    }, path);
    expect(calls()).toBe(3);
    await rm(join(root, "cache"), { recursive: true });
    expect((await readFile(join(path, manifest.assets[0].src))).byteLength)
      .toBeGreaterThan(44);
  });
  it("preview does not call a provider or create output", async () => {
    const { root, service, calls } = await fixture();
    const result = await service.prepare(recipe, join(root, "prepared"), {
      preview: true,
    });
    expect(result.kind).toBe("narration-preview");
    expect(calls()).toBe(0);
    await expect(readFile(join(root, "prepared", "narration.json"))).rejects
      .toMatchObject({ code: "ENOENT" });
  });
  it("rejects all recipe errors before generating any segment", async () => {
    const { root, service, calls } = await fixture();
    await expect(
      service.prepare({
        ...recipe,
        segments: [recipe.segments[0], {
          id: "bad",
          text: "",
          afterSeconds: -1,
        }],
      }, join(root, "out")),
    ).rejects.toThrow();
    expect(calls()).toBe(0);
    expect(() => parseNarrationRecipe({ ...recipe, implicitSpeedup: true }))
      .toThrow(/Unknown/);
  });
  it("publishes overflow evidence without shortening audio", async () => {
    const { root, service } = await fixture();
    const result = await service.prepare({
      ...recipe,
      mode: "fixed",
      segments: [{ id: "hook", text: "Too long", budgetSeconds: 0.5 }],
    }, join(root, "out"));
    expect(result.ok).toBe(false);
    const manifest = JSON.parse(
      await readFile(join(root, "out", "narration.json"), "utf8"),
    );
    expect(manifest.plan.audio.clips[0].duration).toBe("1s");
    expect(manifest.plan.findings[0].code).toBe("NARRATION_OVERFLOW");
  });
  it("cancellation publishes no prepared manifest", async () => {
    const { root, service, calls } = await fixture();
    await expect(
      service.prepare(recipe, join(root, "out"), {
        signal: AbortSignal.abort(),
      }),
    ).rejects.toThrow();
    expect(calls()).toBe(0);
    await expect(readFile(join(root, "out", "narration.json"))).rejects
      .toMatchObject({ code: "ENOENT" });
  });

  it("fits only overflowing macOS segments with bounded rate retries", async () => {
    const { root } = await fixture();
    let calls = 0;
    const provider: SpeechProvider = {
      id: "macos-say",
      version: "fixture",
      fingerprint: () => ({ backend: "fixture", details: {} }),
      voices: async () => [{ id: "test", name: "Test" }],
      synthesize: async (request) => {
        calls++;
        const rate = Number(request.settings?.rateWpm ?? 100);
        const frames = rate >= 200 ? 4_800 : 8_000;
        return {
          wav: createWavPcm(new Uint8Array(frames * 2), { sampleRate: 8_000, channels: 1, bitsPerSample: 16 }),
          provenance: { provider: "macos-say", adapterVersion: "fixture", backend: { backend: "fixture", details: {} } },
        };
      },
    };
    const service = createNodeNarrationService({ cacheDirectory: join(root, "cache"), providers: { "macos-say": provider } });
    const result = await service.prepare({
      schemaVersion: 1,
      provider: "macos-say",
      voice: "test",
      mode: "fixed",
      fps: 30,
      settings: { rateWpm: 100 },
      rateAdjustment: { maxAttempts: 1, maxRateWpm: 200 },
      segments: [{ id: "short", text: "short", budgetSeconds: 1 }, { id: "tight", text: "tight", budgetSeconds: 0.6 }],
    }, join(root, "prepared"));
    const manifest = JSON.parse(JSON.stringify(result));
    expect(calls).toBe(3);
    expect(manifest.ok).toBe(true);
    expect(manifest.assets[0].provenance.effectiveRequest.settings.rateWpm).toBe(100);
    expect(manifest.assets[1].provenance.effectiveRequest.settings.rateWpm).toBe(200);
  });

  it("rejects bounded rate adjustment before provider effects unless explicitly supported", async () => {
    const { root, service, calls } = await fixture();
    await expect(service.prepare({
      ...recipe,
      rateAdjustment: { maxAttempts: 1, maxRateWpm: 200 },
    }, join(root, "out"))).rejects.toThrow(/only for macos-say fixed-mode/);
    expect(calls()).toBe(0);
    await expect(service.prepare({
      schemaVersion: 1,
      provider: "macos-say",
      voice: "test",
      mode: "fixed",
      fps: 30,
      rateAdjustment: { maxAttempts: 1, maxRateWpm: 200 },
      segments: [{ id: "one", text: "one", budgetSeconds: 1 }],
    }, join(root, "missing-rate"))).rejects.toThrow(/explicit integer settings.rateWpm/);
  });

  it("exhausts bounded retries without trimming audio", async () => {
    const { root } = await fixture();
    const service = createNodeNarrationService({
      cacheDirectory: join(root, "cache"),
      providers: {
        "macos-say": {
          id: "macos-say", version: "fixture", fingerprint: () => ({ backend: "fixture", details: {} }),
          voices: async () => [],
          synthesize: async (request) => ({
            wav: createWavPcm(new Uint8Array(16_000), { sampleRate: 8_000, channels: 1, bitsPerSample: 16 }),
            provenance: { provider: "macos-say", adapterVersion: "fixture", backend: { backend: "fixture", details: { rate: request.settings?.rateWpm ?? null } } },
          }),
        },
      },
    });
    const result = await service.prepare({
      schemaVersion: 1, provider: "macos-say", voice: "test", mode: "fixed", fps: 30,
      settings: { rateWpm: 100 }, rateAdjustment: { maxAttempts: 2, maxRateWpm: 200 },
      segments: [{ id: "long", text: "long", budgetSeconds: 0.5 }],
    }, join(root, "out"));
    const manifest = JSON.parse(JSON.stringify(result));
    expect(manifest.ok).toBe(false);
    expect(manifest.plan.findings[0].code).toBe("NARRATION_OVERFLOW");
    expect(manifest.plan.audio.clips[0].duration).toBe("1s");
  });
});
