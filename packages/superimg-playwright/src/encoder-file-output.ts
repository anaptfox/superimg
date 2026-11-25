import { open, rm, stat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import type { EncodedFileResult, VideoEncoderConfig } from "@superimg/types";

/** The host owns the directory and successful file. The encoder cleans up its partial file. */
export class EncoderFileOutput {
  path: string | undefined;
  private complete = false;

  async reserve(output: VideoEncoderConfig["output"]): Promise<void> {
    if (!output) return;
    if (output.kind !== "file" || !isAbsolute(output.path)) {
      throw new TypeError("Encoder output must name an absolute, host-owned file path");
    }
    // Never truncate a pre-existing host file, including when initialization fails.
    const file = await open(output.path, "wx");
    this.path = output.path;
    await file.close();
  }

  async result(): Promise<EncodedFileResult> {
    if (!this.path) throw new Error("Encoder was not initialized with file output");
    const info = await stat(this.path);
    if (!info.isFile() || !Number.isSafeInteger(info.size) || info.size === 0) {
      throw new Error("Encoder output did not produce a nonempty file");
    }
    this.complete = true;
    return { path: this.path, byteLength: info.size };
  }

  async dispose(): Promise<void> {
    if (this.path && !this.complete) await rm(this.path, { force: true });
  }
}
