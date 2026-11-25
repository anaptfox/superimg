import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElevenLabsProvider } from "./elevenlabs.js";
import { createSpeechHost } from "./host.js";
import { createPiperProvider, createMacOSSayProvider } from "./native.js";
import { createWavPcm, validateWavPcm } from "./wav.js";
import type { SpeechProvider } from "./contracts.js";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(
    cleanup.splice(0).map((path) =>
      import("node:fs/promises").then(({ rm }) =>
        rm(path, { recursive: true, force: true })
      )
    ),
  );
});
async function cache(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "speech-test-"));
  cleanup.push(path);
  return path;
}
const wav = () =>
  createWavPcm(new Uint8Array([0, 0, 1, 0]), {
    sampleRate: 8_000,
    channels: 1,
    bitsPerSample: 16,
  });

describe("speech host", () => {
  it("rejects unsupported native model and pronunciation controls before running", async () => {
    const run = vi.fn(async () => ({ stdout: new Uint8Array(), stderr: new Uint8Array() }));
    await expect(createMacOSSayProvider({ runner: { run } }).synthesize({ text: "hi", voice: "Samantha", model: "ignored" }, {})).rejects.toThrow(/does not support/);
    const piper = createPiperProvider({ executable: "piper", model: "model.onnx", configPath: "model.onnx.json", voiceId: "test", modelSha256: "a".repeat(64), configSha256: "b".repeat(64), runner: { run } });
    await expect(piper.synthesize({ text: "hi", voice: "test", pronunciation: {} }, {})).rejects.toThrow(/does not support/);
    expect(run).not.toHaveBeenCalled();
  });
  it("deduplicates identical synthesis and reuses verified immutable cache bytes", async () => {
    const synthesize = vi.fn(async () => ({
      wav: wav(),
      provenance: {
        provider: "fake",
        adapterVersion: "1",
        backend: { backend: "fake", details: {} },
      },
    }));
    const provider: SpeechProvider = {
      id: "fake",
      version: "1",
      fingerprint: () => ({ backend: "fake", details: {} }),
      voices: async () => [],
      synthesize,
    };
    const host = createSpeechHost({ cacheDirectory: await cache(), provider });
    const [first, second] = await Promise.all([
      host.synthesize({ text: "hello", voice: "one" }),
      host.synthesize({ text: "hello", voice: "one" }),
    ]);
    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(first.path).toBe(second.path);
    expect((await readFile(first.path)).byteLength).toBe(wav().byteLength);
    await host.synthesize({ text: "hello", voice: "one" });
    expect(synthesize).toHaveBeenCalledTimes(1);
  });
  it("does not publish a record when cancelled after synthesis", async () => {
    const controller = new AbortController();
    const provider: SpeechProvider = {
      id: "fake",
      version: "1",
      fingerprint: () => ({ backend: "fake", details: {} }),
      voices: async () => [],
      synthesize: async () => {
        controller.abort();
        return {
          wav: wav(),
          provenance: {
            provider: "fake",
            adapterVersion: "1",
            backend: { backend: "fake", details: {} },
          },
        };
      },
    };
    await expect(
      createSpeechHost({ cacheDirectory: await cache(), provider }).synthesize({
        text: "hello",
        voice: "one",
      }, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
  it("does not cancel shared synthesis when only a waiting subscriber aborts", async () => {
    let complete: (() => void) | undefined;
    const provider: SpeechProvider = {
      id: "slow",
      version: "1",
      fingerprint: () => ({ backend: "slow", details: {} }),
      voices: async () => [],
      synthesize: async () =>
        await new Promise((resolve) => {
          complete = () =>
            resolve({
              wav: wav(),
              provenance: {
                provider: "slow",
                adapterVersion: "1",
                backend: { backend: "slow", details: {} },
              },
            });
        }),
    };
    const host = createSpeechHost({ cacheDirectory: await cache(), provider });
    const first = host.synthesize({ text: "hello", voice: "one" });
    await vi.waitFor(() => expect(complete).toBeTypeOf("function"));
    const waiting = new AbortController();
    const second = host.synthesize({ text: "hello", voice: "one" }, {
      signal: waiting.signal,
    });
    waiting.abort();
    await expect(second).rejects.toMatchObject({ name: "AbortError" });
    complete?.();
    await expect(first).resolves.toMatchObject({
      metadata: { sampleFrames: 2 },
    });
  });
  it("rejects corrupt cached output and regenerates it", async () => {
    const directory = await cache();
    const synthesize = vi.fn(async () => ({
      wav: wav(),
      provenance: {
        provider: "fake",
        adapterVersion: "1",
        backend: { backend: "fake", details: {} },
      },
    }));
    const provider: SpeechProvider = {
      id: "fake",
      version: "1",
      fingerprint: () => ({ backend: "fake", details: {} }),
      voices: async () => [],
      synthesize,
    };
    const host = createSpeechHost({ cacheDirectory: directory, provider });
    const first = await host.synthesize({ text: "hello", voice: "one" });
    await writeFile(first.path, "bad");
    await host.synthesize({ text: "hello", voice: "one" });
    expect(synthesize).toHaveBeenCalledTimes(2);
  });
});

describe("adapters", () => {
  it("waits for a cancelled macOS subprocess before returning and passes stdin mode", async () => {
    let abortSeen = false;
    const runner = {
      run: vi.fn(
        async (
          _command: string,
          _args: readonly string[],
          options: { signal?: AbortSignal },
        ) =>
          await new Promise<{ stdout: Uint8Array; stderr: Uint8Array }>(
            (_resolve, reject) => {
              options.signal?.addEventListener(
                "abort",
                () => {
                  abortSeen = true;
                  reject(new DOMException("aborted", "AbortError"));
                },
                { once: true },
              );
            },
          ),
      ),
    };
    const say = (await import("./native.js")).createMacOSSayProvider({
      runner,
    });
    const controller = new AbortController();
    const work = createSpeechHost({
      cacheDirectory: await cache(),
      provider: say,
    }).synthesize(
      { text: "hello", voice: "voice" },
      { signal: controller.signal },
    );
    await vi.waitFor(() => expect(runner.run).toHaveBeenCalledTimes(1));
    controller.abort();
    await expect(work).rejects.toMatchObject({ name: "AbortError" });
    expect(abortSeen).toBe(true);
    expect(runner.run.mock.calls[0]?.[1]).toContain("-f");
    expect(runner.run.mock.calls[0]?.[1]).toContain("-");
  });
  it("runs configured Piper with argument arrays and stdin, then reads its WAV", async () => {
    const directory = await cache();
    const model = join(directory, "a.onnx");
    const config = join(directory, "a.onnx.json");
    await writeFile(model, "model");
    await writeFile(config, "config");
    const runner = {
      run: vi.fn(
        async (
          _command: string,
          args: readonly string[],
          options: { input?: string },
        ) => {
          const output = args[args.indexOf("--output_file") + 1]!;
          await writeFile(output, wav());
          expect(options.input).toBe("hello\n");
          return { stdout: new Uint8Array(), stderr: new Uint8Array() };
        },
      ),
    };
    const provider = createPiperProvider({
      executable: "/configured/piper",
      model,
      configPath: config,
      voiceId: "piper-a",
      modelSha256: createHash("sha256").update("model").digest("hex"),
      configSha256: createHash("sha256").update("config").digest("hex"),
      runner,
    });
    const result = await provider.synthesize({
      text: "hello",
      voice: "piper-a",
    }, {});
    expect(runner.run).toHaveBeenCalledWith("/configured/piper", [
      "--model",
      model,
      "--config",
      config,
      "--output_file",
      expect.any(String),
    ], expect.any(Object));
    expect([...result.wav]).toEqual([...wav()]);
  });
  it("wraps ElevenLabs PCM and keeps returned alignment provenance", async () => {
    let authorization = "";
    const fetcher = vi.fn(
      async (_url: string, init: { headers: Record<string, string> }) => {
        authorization = init.headers["xi-api-key"]!;
        return new Response(
          JSON.stringify({
            audio_base64: Buffer.from([0, 0, 1, 0]).toString("base64"),
            alignment: { characters: ["h"] },
          }),
          { status: 200, headers: { "request-id": "req-7" } },
        );
      },
    );
    const provider = createElevenLabsProvider({
      apiKey: "secret",
      voiceId: "voice",
      modelId: "model",
      fetch: fetcher,
      output: { sampleRate: 8_000, channels: 1, bitsPerSample: 16 },
      accountFingerprint: "account-config",
    });
    const result = await provider.synthesize(
      { text: "hello", voice: "voice" },
      {},
    );
    expect([...result.wav.subarray(0, 4)]).toEqual([...Buffer.from("RIFF")]);
    expect(result.provenance.providerMetadata).toMatchObject({
      providerRequestId: "req-7",
      alignment: { characters: ["h"] },
    });
    expect(authorization).toBe("secret");
  });
  it("discovers ElevenLabs voices only through its explicit catalog interaction", async () => {
    let requestedUrl = "";
    const fetcher = vi.fn(async (url: string) => {
      requestedUrl = url;
      return new Response(
        JSON.stringify({ voices: [{ voice_id: "voice", name: "Narrator" }] }),
        { status: 200 },
      );
    });
    const provider = createElevenLabsProvider({
      apiKey: "secret",
      voiceId: "voice",
      modelId: "model",
      fetch: fetcher,
      output: { sampleRate: 8_000, channels: 1, bitsPerSample: 16 },
      accountFingerprint: "account-config",
    });
    await expect(provider.voices({})).resolves.toMatchObject([{
      id: "voice",
      name: "Narrator",
    }]);
    expect(requestedUrl).toContain("/v1/voices");
  });
  it("rejects malformed ElevenLabs base64 and unsupported rate settings before audio publication", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ audio_base64: "%%%" }), { status: 200 })
    );
    const eleven = createElevenLabsProvider({
      apiKey: "secret",
      voiceId: "voice",
      modelId: "model",
      fetch: fetcher,
      output: { sampleRate: 8_000, channels: 1, bitsPerSample: 16 },
      accountFingerprint: "account",
    });
    await expect(eleven.synthesize({ text: "hello", voice: "voice" }, {}))
      .rejects.toMatchObject({ code: "SPEECH_DISPATCH_UNCERTAIN" });
    const say = (await import("./native.js")).createMacOSSayProvider({
      runner: { run: vi.fn() },
    });
    await expect(
      say.synthesize(
        { text: "hello", voice: "voice", settings: { pitch: 4 } },
        {},
      ),
    ).rejects.toThrow("does not support setting pitch");
  });
  it("rejects empty PCM and malformed WAV chunk boundaries", () => {
    expect(() =>
      createWavPcm(new Uint8Array(), {
        sampleRate: 8_000,
        channels: 1,
        bitsPerSample: 16,
      })
    ).toThrow("invalid PCM");
    const broken = wav().slice();
    new DataView(broken.buffer).setUint32(40, 100, true);
    expect(() => validateWavPcm(broken)).toThrow("truncated");
  });
  it("rejects missing and hash-changed Piper model files before spawning", async () => {
    const directory = await cache();
    const model = join(directory, "missing.onnx");
    const config = join(directory, "missing.json");
    const runner = { run: vi.fn() };
    const provider = createPiperProvider({
      executable: "piper",
      model,
      configPath: config,
      voiceId: "voice",
      modelSha256: "x",
      configSha256: "x",
      runner,
    });
    await expect(provider.synthesize({ text: "hello", voice: "voice" }, {}))
      .rejects.toThrow();
    expect(runner.run).not.toHaveBeenCalled();
  });
});
