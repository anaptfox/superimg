import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { release } from "node:os";
import { basename, join } from "node:path";
import type {
  SpeechProvider,
  SpeechProviderFingerprint,
  SpeechProviderResult,
  SpeechSynthesisRequest,
  SpeechVoice,
} from "./contracts.js";
import { SpeechProviderUnavailableError } from "./contracts.js";
import {
  nodeSpeechProcessRunner,
  type SpeechProcessRunner,
} from "./process.js";

export interface MacOSSayOptions {
  readonly executable?: string;
  readonly runner?: SpeechProcessRunner;
  readonly sampleRate?: number;
  readonly backendIdentity?: string;
}
export function createMacOSSayProvider(
  options: MacOSSayOptions = {},
): SpeechProvider & {
  probe(
    request?: SpeechSynthesisRequest,
    context?: { signal?: AbortSignal },
  ): Promise<void>;
} {
  const executable = options.executable ?? "/usr/bin/say";
  const runner = options.runner ?? nodeSpeechProcessRunner;
  const sampleRate = options.sampleRate ?? 48_000;
  const fingerprint = (
    request: SpeechSynthesisRequest,
  ): SpeechProviderFingerprint =>
    Object.freeze({
      backend: options.backendIdentity ??
        `macos-say:${process.platform}:${release()}`,
      details: {
        executable: basename(executable),
        sampleRate,
        osRelease: release(),
        requestedVoice: request.voice,
      },
    });
  return Object.freeze({
    id: "macos-say",
    version: "1",
    fingerprint,
    async voices(context: { signal?: AbortSignal | undefined } = {}) {
      const output = await runner.run(
        executable,
        ["-v", "?"],
        context.signal === undefined ? {} : { signal: context.signal },
      );
      return Object.freeze(
        new TextDecoder().decode(output.stdout).split("\n").flatMap((line) => {
          const match =
            /^\s*(.*?)\s+([a-z]{2,3}(?:[_-][A-Za-z0-9]+)+)\s+#\s*(.*)\s*$/.exec(
              line,
            );
          return match === null ? [] : [
            Object.freeze({
              id: match[1]!,
              name: match[1]!,
              locale: match[2]!,
              metadata: { sample: match[3]! },
            }),
          ];
        }),
      );
    },
    async synthesize(
      request: SpeechSynthesisRequest,
      context: { signal?: AbortSignal | undefined } = {},
    ) {
      const rateWpm = nativeRate(request);
      const wav = await sayWav(
        executable,
        runner,
        request,
        sampleRate,
        rateWpm,
        context.signal,
      );
      return Object.freeze({
        wav,
        provenance: {
          provider: "macos-say",
          adapterVersion: "1",
          backend: fingerprint(request),
          providerMetadata: {
            requestedVoice: request.voice,
            ...(rateWpm === undefined ? {} : { rateWpm }),
            output: "wav-pcm",
          },
        },
      });
    },
    async probe(
      request: SpeechSynthesisRequest = {
        text: "speech probe",
        voice: "Samantha",
      },
      context: { signal?: AbortSignal | undefined } = {},
    ) {
      await sayWav(
        executable,
        runner,
        request,
        sampleRate,
        nativeRate(request),
        context.signal,
      );
    },
  });
}
async function sayWav(
  executable: string,
  runner: SpeechProcessRunner,
  request: SpeechSynthesisRequest,
  sampleRate: number,
  rateWpm: number | undefined,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const directory = await mkdtemp(join(tmpdir(), "superimg-say-"));
  const output = join(directory, "speech.wav");
  try {
    await runner.run(executable, [
      "-v",
      request.voice,
      ...(rateWpm === undefined ? [] : ["-r", String(rateWpm)]),
      "-f",
      "-",
      "-o",
      output,
      "--file-format=WAVE",
      `--data-format=LEI16@${sampleRate}`,
    ], { input: `${request.text}\n`, signal });
    return await readFile(output);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new SpeechProviderUnavailableError(
        `macOS say executable is unavailable at ${executable}`,
        { cause: error },
      );
    }
    throw error;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export interface PiperOptions {
  readonly executable: string;
  readonly model: string;
  readonly configPath: string;
  readonly voiceId: string;
  readonly modelSha256: string;
  readonly configSha256: string;
  readonly runner?: SpeechProcessRunner;
  readonly backendIdentity?: string;
}
export function createPiperProvider(options: PiperOptions): SpeechProvider {
  const runner = options.runner ?? nodeSpeechProcessRunner;
  const fingerprint = (
    request: SpeechSynthesisRequest,
  ): SpeechProviderFingerprint =>
    Object.freeze({
      backend: options.backendIdentity ?? "piper",
      details: {
        executable: basename(options.executable),
        model: basename(options.model),
        voiceId: options.voiceId,
        modelSha256: options.modelSha256,
        configSha256: options.configSha256,
        requestedVoice: request.voice,
      },
    });
  return Object.freeze({
    id: "piper",
    version: "1",
    fingerprint,
    async voices() {
      return Object.freeze([{
        id: options.voiceId,
        name: options.voiceId,
        metadata: {
          modelSha256: options.modelSha256,
          configSha256: options.configSha256,
        },
      }]);
    },
    async synthesize(
      request: SpeechSynthesisRequest,
      context: { signal?: AbortSignal | undefined } = {},
    ) {
      const signal = context.signal;
      if (request.model !== undefined || request.pronunciation !== undefined) {
        throw new TypeError("Piper uses its host-configured model and does not support pronunciation overrides");
      }
      if (request.voice !== options.voiceId) {
        throw new SpeechProviderUnavailableError(
          `Piper is configured for voice ${options.voiceId}, not ${request.voice}`,
        );
      }
      if (
        request.settings !== undefined &&
        Object.keys(request.settings).length > 0
      ) throw new Error("Piper adapter does not support synthesis settings");
      await verifyHash(options.model, options.modelSha256, "Piper model");
      await verifyHash(
        options.configPath,
        options.configSha256,
        "Piper config",
      );
      const directory = await mkdtemp(join(tmpdir(), "superimg-piper-"));
      const output = join(directory, "speech.wav");
      try {
        await runner.run(
          options.executable,
          [
            "--model",
            options.model,
            "--config",
            options.configPath,
            "--output_file",
            output,
          ],
          signal === undefined
            ? { input: `${request.text}\n` }
            : { input: `${request.text}\n`, signal },
        );
        const wav = await readFile(output);
        return Object.freeze({
          wav,
          provenance: {
            provider: "piper",
            adapterVersion: "1",
            backend: fingerprint(request),
            providerMetadata: {
              model: basename(options.model),
              modelSha256: options.modelSha256,
              configSha256: options.configSha256,
            },
          },
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          throw new SpeechProviderUnavailableError(
            `Piper executable is unavailable at ${options.executable}`,
            { cause: error },
          );
        }
        throw error;
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  });
}
function nativeRate(request: SpeechSynthesisRequest): number | undefined {
  if (request.model !== undefined || request.pronunciation !== undefined) {
    throw new TypeError("macOS say does not support model or pronunciation overrides");
  }
  const settings = request.settings;
  if (settings === undefined) return undefined;
  for (const key of Object.keys(settings)) {
    if (key !== "rateWpm") {
      throw new Error(`macOS say does not support setting ${key}`);
    }
  }
  const rate = settings.rateWpm;
  if (rate === undefined) return undefined;
  if (
    typeof rate !== "number" || !Number.isInteger(rate) || rate < 1 ||
    rate > 10_000
  ) throw new Error("rateWpm must be an integer from 1 to 10000");
  return rate;
}
async function verifyHash(
  path: string,
  expected: string,
  name: string,
): Promise<void> {
  const actual = createHash("sha256").update(await readFile(path)).digest(
    "hex",
  );
  if (actual !== expected) {
    throw new SpeechProviderUnavailableError(
      `${name} hash does not match configured fingerprint`,
    );
  }
}
