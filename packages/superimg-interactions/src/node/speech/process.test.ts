import { expect, it } from "vitest";
import { nodeSpeechProcessRunner } from "./process.js";

it(
  "reaps a child that ignores SIGTERM after bounded cancellation",
  async () => {
    const controller = new AbortController();
    const started = Date.now();
    const pending = nodeSpeechProcessRunner.run(process.execPath, [
      "-e",
      "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)",
    ], { signal: controller.signal });
    const timer = setTimeout(() => controller.abort(), 150);
    try {
      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
      expect(Date.now() - started).toBeLessThan(4000);
    } finally {
      clearTimeout(timer);
    }
  },
  5000,
);

it("handles a child closing stdin early without an unhandled EPIPE", async () => {
  await expect(
    nodeSpeechProcessRunner.run(process.execPath, [
      "-e",
      "process.stdin.destroy();process.exit(0)",
    ], { input: "x".repeat(1024 * 1024) }),
  ).resolves.toBeDefined();
});
