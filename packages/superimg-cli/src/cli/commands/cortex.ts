//! Write stills from a Cortex bundle. Value-first startExport, not media.export.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  cortexArtifactRecord,
  planCortexRender,
  startCortexExport,
} from "@superimg/core/cortex";
import { createRuntime, readByteStream } from "@superimg/core/runtime";
import { createNodeRuntimeAdapter } from "@superimg/node";
import { parseCortexBundle } from "@superimg/types";

export interface CortexCommandOptions {
  for: string[];
  at?: string;
  output?: string;
  view?: string;
  json?: boolean;
}

function stillAtSeconds(value: string | undefined): number {
  const seconds = Number(value ?? 0);
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error("cortex --at must be a non-negative number of seconds");
  }
  return seconds;
}

export async function cortexCommand(
  bundlePath: string,
  options: CortexCommandOptions,
): Promise<void> {
  if (!options.for?.length) {
    throw new Error("cortex requires at least one --for destination");
  }
  const raw = JSON.parse(await readFile(resolve(bundlePath), "utf8")) as unknown;
  const bundle = parseCortexBundle(raw);

  const plan = planCortexRender(bundle, options.view ? { viewId: options.view } : {});
  const record = cortexArtifactRecord(plan);
  const runtime = createRuntime(createNodeRuntimeAdapter());
  const outDir = resolve(options.output ?? join("output", "cortex.export"));
  try {
    const job = startCortexExport(runtime, bundle, {
      for: options.for,
      at: stillAtSeconds(options.at),
      ...(options.view === undefined ? {} : { viewId: options.view }),
    });
    const exported = await job.result;
    await mkdir(outDir, { recursive: true });
    const written: { path: string; sha256: string; byteLength: number }[] = [];
    try {
      for (const artifact of exported.artifacts) {
        const bytes = await readByteStream(artifact.stream());
        const dest = join(outDir, artifact.path);
        await mkdir(dirname(dest), { recursive: true });
        await writeFile(dest, bytes);
        written.push({
          path: artifact.path,
          sha256: artifact.sha256,
          byteLength: artifact.byteLength,
        });
      }
    } finally {
      await exported.dispose();
    }
    const report = {
      viewId: record.viewId,
      reason: record.reason,
      output: outDir,
      artifacts: written,
    };
    if (options.json) process.stdout.write(`${JSON.stringify(report)}\n`);
    else {
      process.stdout.write(`cortex ${record.viewId}  ${outDir}\n`);
      for (const item of written) {
        process.stdout.write(
          `  ${item.path}  ${item.sha256.slice(0, 12)}…  ${item.byteLength}b\n`,
        );
      }
    }
  } finally {
    await runtime.dispose();
  }
}
