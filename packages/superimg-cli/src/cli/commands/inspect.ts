//! inspect — runtime-true multi-progress template debug report (JSON stdout).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  activePhaseAt,
  critiqueTemplate,
  probeDirectorPhases,
  renderHtmlAtFrame,
  resolveFrameIndex,
} from "@superimg/core/testing";
import type { CritiqueReport, NormalizedPhase } from "@superimg/core/testing";
import { formatError } from "@superimg/core/errors";
import { resolveTemplatePath } from "../utils/resolve-template.js";
import { loadRuntimeTemplate } from "../utils/load-runtime-template.js";
import { scrapeHtmlSemantics } from "../utils/html-semantics.js";
import { parseAtList, parseDiffPair, type AtSample } from "../utils/inspect-at.js";
import { diffSemantics } from "../utils/inspect-diff.js";
import { loadDataInput } from "../utils/data-loader.js";
import { readFileSync } from "node:fs";

export interface InspectOptions {
  at?: string;
  diff?: string;
  png?: boolean;
  output?: string;
  pretty?: boolean;
  data?: string;
  json?: boolean;
  critique?: boolean;
}

export interface InspectPhase {
  name: string;
  start: number;
  end: number;
  startSec: number;
  endSec: number;
  startFrame: number;
  endFrame: number;
}

export interface InspectSample {
  at: string;
  progress: number;
  frame: number;
  seconds: number;
  activePhase: string | null;
  phaseLocal: number | null;
  htmlBytes: number;
  text: string[];
  colors: string[];
  eqKeys: string[];
  waitLabels: string[];
  cameraScale: number | null;
  htmlPath?: string;
  pngPath?: string;
  error?: { message: string; code?: string };
}

export interface InspectReport {
  template: string;
  config: {
    width: number;
    height: number;
    fps: number;
    duration: number;
    totalFrames: number;
  };
  phases: InspectPhase[] | null;
  samples: InspectSample[];
  diff?: ReturnType<typeof diffSemantics>;
  critique?: CritiqueReport;
}

function toInspectPhases(
  phases: NormalizedPhase[],
  duration: number,
  fps: number,
): InspectPhase[] {
  return phases.map((p) => ({
    name: p.name,
    start: p.start,
    end: p.end,
    startSec: p.start * duration,
    endSec: p.end * duration,
    startFrame: Math.floor(p.start * duration * fps),
    endFrame: Math.max(0, Math.ceil(p.end * duration * fps) - 1),
  }));
}

function sampleProgress(
  sample: AtSample,
  fps: number,
  duration: number,
): { progress: number; frame: number } {
  if (sample.kind === "frame") {
    const frame = resolveFrameIndex({ frame: sample.frame, fps, durationSeconds: duration });
    const totalFrames = Math.max(1, Math.ceil(duration * fps));
    const progress = totalFrames <= 1 ? 0 : frame / (totalFrames - 1);
    return { progress, frame };
  }
  const frame = resolveFrameIndex({
    progress: sample.progress,
    fps,
    durationSeconds: duration,
  });
  return { progress: sample.progress, frame };
}

function printPretty(report: InspectReport): void {
  const { config, phases, samples, diff, critique } = report;
  console.error(`\n  Inspect: ${report.template}`);
  console.error(
    `  ${config.width}×${config.height} @ ${config.fps}fps · ${config.duration}s · ${config.totalFrames} frames\n`,
  );
  if (phases && phases.length > 0) {
    console.error("  Phases:");
    for (const p of phases) {
      console.error(
        `    ${p.name.padEnd(16)} ${p.startSec.toFixed(2)}s–${p.endSec.toFixed(2)}s  (${(p.start * 100).toFixed(0)}–${(p.end * 100).toFixed(0)}%)`,
      );
    }
    console.error("");
  } else {
    console.error("  Phases: (none — director not called with layout)\n");
  }
  console.error("  Samples:");
  for (const s of samples) {
    if (s.error) {
      console.error(`    @${s.at}  ERROR: ${s.error.message}`);
      continue;
    }
    const phase = s.activePhase ? `${s.activePhase}@${(s.phaseLocal ?? 0).toFixed(2)}` : "—";
    const colors = s.colors.slice(0, 4).join(",") || "—";
    const textPreview = s.text.slice(0, 6).join(" ");
    console.error(
      `    @${String(s.at).padEnd(6)} f${s.frame}  phase=${phase.padEnd(18)} colors=${colors}  ${textPreview}`,
    );
  }
  if (diff) {
    console.error("\n  Diff:");
    console.error(`    +text: ${diff.addedText.join(" ") || "—"}`);
    console.error(`    -text: ${diff.removedText.join(" ") || "—"}`);
    console.error(`    +colors: ${diff.addedColors.join(" ") || "—"}`);
    console.error(`    -colors: ${diff.removedColors.join(" ") || "—"}`);
  }
  if (critique) {
    console.error("\n  Critique:");
    const m = critique.metrics;
    console.error(
      `    hold=${m.holdSeconds?.toFixed(2) ?? "—"}s  enter=${m.enterSeconds?.toFixed(2) ?? "—"}s  exit=${m.exitSeconds?.toFixed(2) ?? "—"}s`,
    );
    if (critique.issues.length === 0) {
      console.error("    ✓ no craft issues");
    } else {
      for (const i of critique.issues) {
        const mark = i.severity === "error" ? "✗" : i.severity === "warning" ? "⚠" : "·";
        console.error(`    ${mark} ${i.code.padEnd(24)} ${i.message}`);
        if (i.suggestion) console.error(`      → ${i.suggestion}`);
      }
    }
  }
  console.error("");
}

export async function inspectCommand(
  templateArg: string,
  options: InspectOptions = {},
): Promise<void> {
  let resolvedPath: string;
  try {
    resolvedPath = resolveTemplatePath(templateArg);
  } catch (err) {
    const formatted = formatError(err);
    console.log(JSON.stringify({ error: formatted.json }));
    process.exit(1);
  }

  let atList: AtSample[];
  try {
    atList = parseAtList(options.at);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  let dataOverride: Record<string, unknown> | undefined;
  if (options.data) {
    try {
      const loaded = await loadDataInput(options.data, dirname(resolvedPath));
      if (loaded && typeof loaded === "object" && !Array.isArray(loaded)) {
        dataOverride = loaded as Record<string, unknown>;
      } else {
        console.error("Error: --data for inspect must be a single object (not an array)");
        process.exit(1);
      }
    } catch (err) {
      const formatted = formatError(err);
      console.error(`Error loading --data: ${formatted.plain}`);
      process.exit(1);
    }
  }

  let loaded: Awaited<ReturnType<typeof loadRuntimeTemplate>>;
  try {
    loaded = await loadRuntimeTemplate(resolvedPath, {
      ...(dataOverride !== undefined ? { data: dataOverride } : {}),
    });
  } catch (err) {
    const formatted = formatError(err);
    console.log(JSON.stringify({ error: formatted.json }));
    process.exit(1);
  }

  const { template, config, data } = loaded;
  const { fps, duration, width, height, totalFrames } = config;

  const rawPhases = probeDirectorPhases(template, {
    fps,
    durationSeconds: duration,
    width,
    height,
    data,
  });
  const phases = rawPhases ? toInspectPhases(rawPhases, duration, fps) : null;

  const outDir =
    options.output ??
    join(dirname(resolvedPath), "output", ".superimg", "inspect");

  if (options.png || options.output) {
    mkdirSync(outDir, { recursive: true });
  }

  const samples: InspectSample[] = [];
  let hadError = false;

  for (const at of atList) {
    const { progress, frame } = sampleProgress(at, fps, duration);
    const seconds = progress * duration;
    const active = rawPhases ? activePhaseAt(rawPhases, progress) : null;

    try {
      const html = renderHtmlAtFrame(template, {
        frame,
        fps,
        durationSeconds: duration,
        width,
        height,
        data,
        composite: false,
      });
      const semantics = scrapeHtmlSemantics(html);
      const sample: InspectSample = {
        at: at.label,
        progress,
        frame,
        seconds,
        activePhase: active?.phase.name ?? null,
        phaseLocal: active?.phaseLocal ?? null,
        htmlBytes: Buffer.byteLength(html, "utf8"),
        ...semantics,
      };

      if (options.output || options.png) {
        const htmlPath = join(outDir, `p${progress}.html`);
        writeFileSync(htmlPath, html);
        sample.htmlPath = htmlPath;
      }

      if (options.png) {
        // Lazy import still path — Playwright only when requested
        const { renderVideo } = await import("../../render-video.js");
        const pngPath = join(outDir, `p${progress}.png`);
        const bytes = await renderVideo(resolvedPath, {
          frame,
          width,
          height,
          fps,
          duration,
          ...(dataOverride !== undefined ? { data: dataOverride } : {}),
          encoding: { format: "png" },
        });
        writeFileSync(pngPath, bytes);
        sample.pngPath = pngPath;
      }

      samples.push(sample);
    } catch (err) {
      hadError = true;
      const message = err instanceof Error ? err.message : String(err);
      samples.push({
        at: at.label,
        progress,
        frame,
        seconds,
        activePhase: active?.phase.name ?? null,
        phaseLocal: active?.phaseLocal ?? null,
        htmlBytes: 0,
        text: [],
        colors: [],
        eqKeys: [],
        waitLabels: [],
        cameraScale: null,
        error: { message },
      });
    }
  }

  const report: InspectReport = {
    template: resolvedPath,
    config: { width, height, fps, duration, totalFrames },
    phases,
    samples,
  };

  if (options.critique) {
    let source: string | undefined;
    try {
      source = readFileSync(resolvedPath, "utf-8");
    } catch {
      // best-effort static scan
    }
    report.critique = critiqueTemplate(template, {
      data: data as Record<string, unknown>,
      source,
    });
  }

  if (options.diff) {
    try {
      const pair = parseDiffPair(options.diff);
      const findNear = (p: number) =>
        samples.find((s) => !s.error && Math.abs(s.progress - p) < 1e-9) ??
        samples
          .filter((s) => !s.error)
          .sort((a, b) => Math.abs(a.progress - p) - Math.abs(b.progress - p))[0];

      // Ensure both ends are sampled
      for (const p of [pair.from, pair.to]) {
        if (!samples.some((s) => !s.error && Math.abs(s.progress - p) < 1e-9)) {
          const frame = resolveFrameIndex({ progress: p, fps, durationSeconds: duration });
          const html = renderHtmlAtFrame(template, {
            frame,
            fps,
            durationSeconds: duration,
            width,
            height,
            data,
            composite: false,
          });
          const semantics = scrapeHtmlSemantics(html);
          const active = rawPhases ? activePhaseAt(rawPhases, p) : null;
          samples.push({
            at: String(p),
            progress: p,
            frame,
            seconds: p * duration,
            activePhase: active?.phase.name ?? null,
            phaseLocal: active?.phaseLocal ?? null,
            htmlBytes: Buffer.byteLength(html, "utf8"),
            ...semantics,
          });
        }
      }

      const a = findNear(pair.from);
      const b = findNear(pair.to);
      if (a && b) {
        report.diff = diffSemantics(pair.from, pair.to, a, b);
      }
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  }

  if (options.output || options.png) {
    writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  }

  if (options.pretty) {
    printPretty(report);
  }

  console.log(JSON.stringify(report, null, 2));
  if (hadError) process.exit(1);
}
