import type { JobEvent, PausableJob } from "@superimg/types";

/** Attach terminal pause/cancel controls and always restore stdin listeners. */
export function attachMediaJobControls(job: PausableJob<unknown>): () => void {
  const wasPaused = process.stdin.isPaused();
  const onData = (chunk: Buffer) => {
    const key = chunk.toString();
    if (key === "q" || key === "\u0003") void job.cancel(key === "q" ? "terminal_cancelled" : "sigint").catch(() => undefined);
    if (key === " ") void (job.state === "paused" || job.state === "pausing" ? job.resume() : job.pause()).catch(() => undefined);
  };
  const onSigint = () => { void job.cancel("sigint").catch(() => undefined); };
  const onEvent = (event: JobEvent) => { if (!process.stderr.isTTY) process.stderr.write(`${JSON.stringify(event)}\n`); };
  const unsubscribe = job.subscribe(onEvent);
  process.once("SIGINT", onSigint);
  const wasRaw = process.stdin.isTTY && process.stdin.isRaw === true;
  if (process.stdin.isTTY) { process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.on("data", onData); }
  return () => {
    unsubscribe();
    process.removeListener("SIGINT", onSigint);
    if (process.stdin.isTTY) { process.stdin.removeListener("data", onData); process.stdin.setRawMode(wasRaw); if (wasPaused) process.stdin.pause(); }
  };
}
