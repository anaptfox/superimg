import { beforeEach, describe, expect, it, vi } from "vitest";

const encoderMocks = vi.hoisted(() => ({
  setResolvedAudio: vi.fn(async () => {}),
  addFrame: vi.fn(async () => {}),
  finalize: vi.fn(async () => new Blob()),
  cancel: vi.fn(async () => {}),
}));

vi.mock("./encoder.js", () => ({
  BrowserEncoder: class {
    setResolvedAudio = encoderMocks.setResolvedAudio;
    addFrame = encoderMocks.addFrame;
    finalize = encoderMocks.finalize;
    cancel = encoderMocks.cancel;
  },
}));

import { exportImageDataToVideo } from "./export.js";

describe("browser export cancellation", () => {
  beforeEach(() => {
    for (const mock of Object.values(encoderMocks)) mock.mockClear();
  });

  it("rejects before capturing a frame when already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    const capture = vi.fn(async () => new ImageData(4, 3));

    await expect(
      exportImageDataToVideo(
        { fps: 30, width: 4, height: 3, duration: 1 },
        capture,
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ code: "aborted" });
    expect(capture).not.toHaveBeenCalled();
    expect(encoderMocks.cancel).not.toHaveBeenCalled();
  });

  it("cancels encoder resources when capture is interrupted", async () => {
    const controller = new AbortController();
    let captureStarted!: () => void;
    const started = new Promise<void>((resolve) => { captureStarted = resolve; });
    const capture = vi.fn(async () => {
      captureStarted();
      return await new Promise<ImageData>(() => {});
    });

    const exporting = exportImageDataToVideo(
      { fps: 30, width: 4, height: 3, duration: 1 },
      capture,
      { signal: controller.signal },
    );
    await started;
    controller.abort();

    await expect(exporting).rejects.toMatchObject({ code: "aborted" });
    expect(encoderMocks.addFrame).not.toHaveBeenCalled();
    expect(encoderMocks.finalize).not.toHaveBeenCalled();
    expect(encoderMocks.cancel).toHaveBeenCalledOnce();
  });

  it("enforces a deadline during an in-flight capture", async () => {
    const capture = vi.fn(async () => await new Promise<ImageData>(() => {}));
    const exporting = exportImageDataToVideo(
      { fps: 30, width: 4, height: 3, duration: 1 },
      capture,
      { deadlineMs: Date.now() + 5 },
    );

    await expect(exporting).rejects.toMatchObject({ code: "deadline_exceeded" });
    expect(encoderMocks.cancel).toHaveBeenCalledOnce();
  });

  it("captures the next frame while the previous frame is encoding", async () => {
    let releaseFirstEncode!: () => void;
    const firstEncodeGate = new Promise<void>((resolve) => { releaseFirstEncode = resolve; });
    let firstEncodeStarted!: () => void;
    const firstEncode = new Promise<void>((resolve) => { firstEncodeStarted = resolve; });
    encoderMocks.addFrame.mockImplementationOnce(async () => {
      firstEncodeStarted();
      await firstEncodeGate;
    });

    let secondCaptureStarted!: () => void;
    const secondCapture = new Promise<void>((resolve) => { secondCaptureStarted = resolve; });
    const capture = vi.fn(async (frame: number) => {
      if (frame === 1) secondCaptureStarted();
      return new ImageData(4, 3);
    });

    const exporting = exportImageDataToVideo(
      { fps: 10, width: 4, height: 3, duration: 0.2 },
      capture,
      { yieldEveryFrames: 100 },
    );

    await firstEncode;
    await expect(
      Promise.race([
        secondCapture.then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 100)),
      ]),
    ).resolves.toBe(true);
    releaseFirstEncode();
    await exporting;

    expect(capture).toHaveBeenCalledTimes(2);
    expect(encoderMocks.addFrame).toHaveBeenCalledTimes(2);
  });
});
