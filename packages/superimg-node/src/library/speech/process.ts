import { spawn } from "node:child_process";

const MAX_PROCESS_OUTPUT_BYTES = 1024 * 1024;
const TERMINATION_GRACE_MS = 1_000;

export interface SpeechProcessRunner {
  run(
    command: string,
    args: readonly string[],
    options: Readonly<{ input?: string; signal?: AbortSignal | undefined }>,
  ): Promise<Readonly<{ stdout: Uint8Array; stderr: Uint8Array }>>;
}

/** Injectable boundary for native speech engines. Arguments are never shell-interpreted. */
export const nodeSpeechProcessRunner: SpeechProcessRunner = Object.freeze({
  async run(
    command: string,
    args: readonly string[],
    options: Readonly<{ input?: string; signal?: AbortSignal | undefined }>,
  ): Promise<Readonly<{ stdout: Uint8Array; stderr: Uint8Array }>> {
    if (options.signal?.aborted) throw abortError();
    return await new Promise((resolve, reject) => {
      const child = spawn(command, [...args], {
        stdio: ["pipe", "pipe", "pipe"],
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let outputBytes = 0;
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      let settled = false;
      const finish = (action: () => void) => {
        if (!settled) {
          settled = true;
          if (killTimer !== undefined) clearTimeout(killTimer);
          options.signal?.removeEventListener("abort", onAbort);
          action();
        }
      };
      const onAbort = () => {
        child.kill("SIGTERM");
        killTimer = setTimeout(
          () => child.kill("SIGKILL"),
          TERMINATION_GRACE_MS,
        );
      };
      options.signal?.addEventListener("abort", onAbort, { once: true });
      child.once("error", (error) => finish(() => reject(error)));
      const collect = (target: Buffer[]) => (chunk: Buffer) => {
        outputBytes += chunk.byteLength;
        if (outputBytes > MAX_PROCESS_OUTPUT_BYTES) {
          child.kill("SIGKILL");
          finish(() =>
            reject(new Error("Speech subprocess exceeded 1 MiB output limit"))
          );
          return;
        }
        target.push(Buffer.from(chunk));
      };
      child.stdout?.on("data", collect(stdout));
      child.stderr?.on("data", collect(stderr));
      child.once(
        "close",
        (code) =>
          finish(() =>
            options.signal?.aborted
              ? reject(abortError())
              : code === 0
              ? resolve({
                stdout: Buffer.concat(stdout),
                stderr: Buffer.concat(stderr),
              })
              : reject(
                new Error(
                  `${command} exited ${code ?? "without a status"}: ${
                    Buffer.concat(stderr).toString("utf8")
                  }`,
                ),
              )
          ),
      );
      child.stdin?.on("error", (error) => {
        if ((error as NodeJS.ErrnoException).code !== "EPIPE") {
          finish(() => reject(error));
        }
      });
      if (options.input !== undefined) child.stdin?.end(options.input);
      else child.stdin?.end();
    });
  },
});
function abortError(): DOMException {
  return new DOMException("Speech subprocess aborted", "AbortError");
}
