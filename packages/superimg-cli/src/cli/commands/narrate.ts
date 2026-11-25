import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import type { Command } from "commander";
import {
  createElevenLabsProvider,
  createPiperProvider,
  type NodeNarrationOptions,
  parseNarrationRecipe,
  type SpeechProviderId,
} from "@foxworth/superimg-interactions";
import type { MediaJsonObject } from "@foxworth/superimg-interactions";
import { createCliMediaInteractionSession } from "../utils/media-interactions.js";

interface NarrateOptions {
  json?: boolean;
  preview?: boolean;
  refresh?: boolean;
  piperModel?: string;
  piperExecutable?: string;
}

async function providers(
  provider: SpeechProviderId,
  voice: string,
  model: string | undefined,
  options: NarrateOptions,
): Promise<NodeNarrationOptions> {
  if (provider === "macos-say") return {};
  if (provider === "piper") {
    const path = options.piperModel ?? process.env.SUPERIMG_PIPER_MODEL;
    if (!path) {
      throw new Error(
        "Piper needs --piper-model or SUPERIMG_PIPER_MODEL pointing to an installed .onnx model",
      );
    }
    const absolute = resolve(path);
    const [modelBytes, configBytes] = await Promise.all([
      readFile(absolute),
      readFile(`${absolute}.json`),
    ]);
    return {
      providers: {
        piper: createPiperProvider({
          executable: options.piperExecutable ??
            process.env.SUPERIMG_PIPER_EXECUTABLE ?? "piper",
          model: absolute,
          configPath: `${absolute}.json`,
          voiceId: voice,
          modelSha256: digest(modelBytes),
          configSha256: digest(configBytes),
        }),
      },
    };
  }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ElevenLabs needs ELEVENLABS_API_KEY in the host environment",
    );
  }
  return {
    providers: {
      elevenlabs: createElevenLabsProvider({
        apiKey,
        voiceId: voice,
        modelId: model ?? "eleven_multilingual_v2",
        output: { sampleRate: 24000, channels: 1, bitsPerSample: 16 },
        accountFingerprint: digest(Buffer.from(apiKey)),
      }),
    },
  };
}
function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function narrateCommand(
  file: string,
  options: NarrateOptions,
): Promise<void> {
  const absolute = resolve(file);
  const recipe = parseNarrationRecipe(
    JSON.parse(await readFile(absolute, "utf8")),
  );
  // Preview validates intent without credentials, downloads, discovery, or synthesis.
  const configuration = options.preview
    ? {}
    : await providers(recipe.provider, recipe.voice, recipe.model, options);
  const session = createCliMediaInteractionSession(process.cwd(), configuration);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once("SIGINT", cancel);
  try {
    const artifactId = `${basename(file).replace(/\.json$/i, "")}.narration`;
    const result = await session.mount.dispatch({
      interactionId: "media.narration.prepare",
      input: {
        recipe: recipe as unknown as MediaJsonObject,
        target: { targetId: "project-artifacts", artifactId },
        ...(options.preview ? { preview: true } : {}),
        ...(options.refresh ? { refresh: true } : {}),
      },
    }, { signal: controller.signal, timeoutMs: 10 * 60 * 1000 });
    if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
    else {process.stdout.write(
        options.preview
          ? `${JSON.stringify(result, null, 2)}\n`
          : `Narration prepared: output/${artifactId}/narration.json\n${
            result.ok === false
              ? "Timing overflow: inspect the findings before export.\n"
              : ""
          }`,
      );}
    if (result.ok === false) process.exitCode = 1;
  } finally {
    process.removeListener("SIGINT", cancel);
    await session.dispose();
  }
}

export async function speechVoicesCommand(
  provider: SpeechProviderId,
  options: NarrateOptions,
): Promise<void> {
  if (!["macos-say", "piper", "elevenlabs"].includes(provider)) {
    throw new Error("Choose macos-say, piper, or elevenlabs");
  }
  const session = createCliMediaInteractionSession(
    process.cwd(),
    await providers(provider, "catalog", undefined, options),
  );
  try {
    const result = await session.mount.dispatch({
      interactionId: "media.speech.voices",
      input: { provider },
    }, { timeoutMs: 30000 });
    process.stdout.write(
      `${JSON.stringify(result, null, options.json ? undefined : 2)}\n`,
    );
    if (result.available === false) process.exitCode = 1;
  } finally {
    await session.dispose();
  }
}

export function registerNarrationCommands(program: Command): void {
  const speech = program.command("speech").description(
    "Host speech providers and frozen audio",
  );
  speech.command("voices").description(
    "Discover an explicitly selected speech provider",
  )
    .requiredOption("--provider <provider>", "macos-say, piper, or elevenlabs")
    .option("--piper-model <path>", "Installed Piper .onnx model")
    .option("--piper-executable <path>", "Piper executable")
    .option("--json", "Machine-readable result")
    .action(async (options: NarrateOptions & { provider: SpeechProviderId }) =>
      speechVoicesCommand(options.provider, options)
    );
  program.command("narrate").description(
    "Prepare frozen speech and a measured timing plan",
  )
    .argument("<recipe>", "Narration JSON recipe")
    .option("--preview", "Validate and report intent without synthesis")
    .option(
      "--refresh",
      "Explicitly generate new speech instead of using cache",
    )
    .option("--piper-model <path>", "Installed Piper .onnx model")
    .option("--piper-executable <path>", "Piper executable")
    .option("--json", "Machine-readable result")
    .action(narrateCommand);
  program.command("narration-review").description(
    "Verify a prepared narration bundle and write its offline review viewer",
  )
    .argument("<artifact-id>", "Prepared bundle directory under output/")
    .option(
      "--encoded-artifact <id>",
      "Encoded file under output/ to verify and include",
    )
    .option("--json", "Machine-readable result")
    .action(
      async (
        artifactId: string,
        options: { json?: boolean; encodedArtifact?: string },
      ) => {
        const session = createCliMediaInteractionSession(process.cwd());
        try {
          const report = await session.mount.dispatch({
            interactionId: "media.narration.review",
            input: {
              target: { targetId: "project-artifacts", artifactId },
              ...(options.encodedArtifact === undefined
                ? {}
                : { encodedArtifactId: options.encodedArtifact }),
            },
          }, { timeoutMs: 30000 });
          process.stdout.write(
            options.json
              ? `${JSON.stringify(report)}\n`
              : `Review: output/${artifactId}/review.html\n`,
          );
          if (Array.isArray(report.findings) && report.findings.some((finding) =>
            finding !== null && typeof finding === "object" && !Array.isArray(finding) && finding.severity === "error"
          )) process.exitCode = 1;
        } finally {
          await session.dispose();
        }
      },
    );
}
