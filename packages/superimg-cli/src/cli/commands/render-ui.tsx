//! Ink progress UI for single-template TTY `superimg render` runs.
//! Loaded lazily so CI/non-TTY paths never pull in React or Ink.

import { render, Box, Text } from "ink";
import { useState, useEffect } from "react";
import type { RenderProgress } from "@superimg/types";
import { formatError } from "@superimg/core/errors";
import type { RenderOptions, ResolvedTargets } from "./render-targets.js";
import { executeRenderTargets } from "./render-execute.js";

function RenderUI({ resolved, options }: { resolved: ResolvedTargets; options: RenderOptions }) {
  const { targets, resolvedConfig } = resolved;
  const [progress, setProgress] = useState<RenderProgress>({
    frame: 0,
    totalFrames: 1,
    fps: resolvedConfig.fps,
  });
  const [currentTarget, setCurrentTarget] = useState(0);
  const [status, setStatus] = useState("Initializing Playwright...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const timeoutSeconds = Number(options.timeout);

    (async () => {
      try {
        setStatus(targets.length > 1 ? "Rendering..." : "Bundling template...");
        await executeRenderTargets({
          resolved,
          options,
          signal: controller.signal,
          ...(Number.isFinite(timeoutSeconds) && timeoutSeconds > 0
            ? { deadlineMs: Date.now() + timeoutSeconds * 1_000 }
            : {}),
          isCancelled: () => !mounted,
          onTargetStart: (_target, index, total) => {
            if (!mounted) return;
            setCurrentTarget(index);
            setStatus(total > 1
              ? `Rendering "${_target.name}" (${index + 1}/${total})...`
              : "Rendering...");
          },
          onProgress: (_target, p) => {
            if (mounted) setProgress(p);
          },
        });

        if (!mounted) return;
        if (targets.length > 1) {
          const paths = targets.map((t) => t.outputPath).join("\n  ");
          setStatus(`Complete! Saved:\n  ${paths}`);
        } else {
          setStatus(`Complete! Saved to ${targets[0]?.outputPath ?? ""}`);
        }
        setTimeout(() => process.exit(0), 1000);
      } catch (err) {
        if (!mounted) return;
        setError(formatError(err).plain);
        setStatus("Error");
        setTimeout(() => process.exit(1), 2000);
      }
    })();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  const pct = Math.round((progress.frame / progress.totalFrames) * 100);
  const target = targets[currentTarget] ?? targets[0];

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        SuperImg Render
      </Text>
      <Box marginTop={1}>
        <Text>{status}</Text>
      </Box>
      {error ? (
        <Box marginTop={1} flexDirection="column">
          <Text color="red">{error}</Text>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text>
            Frame: <Text color="cyan">{progress.frame}/{progress.totalFrames}</Text>
            {" "}(<Text color="yellow">{pct}%</Text>)
            {" "}<Text dimColor>{target?.width}x{target?.height}</Text>
          </Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>Output: {target?.outputPath}</Text>
      </Box>
      {options.debugHtml ? (
        <Box marginTop={1}>
          <Text dimColor>Debug HTML: {target?.debugHtmlDir}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

export function renderWithInkUI(resolved: ResolvedTargets, options: RenderOptions): void {
  render(<RenderUI resolved={resolved} options={options} />);
}
