import { describe, expect, it, vi } from "vitest";
import {
  createContainerApp,
  type ContainerManifest,
  type ContainerRenderQueue,
} from "./app.js";
import type { RenderExecutionOptions } from "@superimg/types";
import type { RenderSupervisorRequest } from "./render-supervisor.js";

function appWith(
  run: ContainerRenderQueue["run"],
  getFfmpegVersion: () => Promise<string | null>,
) {
  return createContainerApp({
    manifest: { demo: {} as ContainerManifest[string] },
    supervisor: { activeCount: 0, queuedCount: 0, run },
    renderTimeoutMs: 1_000,
    cancellationGraceMs: 20,
    maxRequestBytes: 1_024,
    maxOutputBytes: 4_096,
    renderLimits: { maxFrames: 100 },
    getFfmpegVersion,
  });
}

function byteRun() {
  return vi.fn(async (
    _request: RenderSupervisorRequest,
    _options?: RenderExecutionOptions,
  ) => new Uint8Array());
}

describe("container FFmpeg-optional capabilities", () => {
  it("healthz reports ok when ffmpeg is absent (capability, not hard failure)", async () => {
    const app = appWith(byteRun(), async () => null);
    const response = await app.request("/healthz");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: boolean;
      ffmpeg: string | null;
      profile: string;
      capabilities: {
        encoders: string[];
        versions: { ffmpeg: string | null };
      };
    };
    expect(body.ok).toBe(true);
    expect(body.ffmpeg).toBeNull();
    expect(body.profile).toBe("node");
    expect(body.capabilities.encoders).toEqual(["mediabunny-node"]);
    expect(body.capabilities.encoders).not.toContain("ffmpeg");
    expect(body.capabilities.versions.ffmpeg).toBeNull();
    expect(
      (body.capabilities as { profile?: string }).profile ?? body.profile,
    ).toBe("node");
  });

  it("healthz includes ffmpeg encoder when present (node-media profile)", async () => {
    const app = appWith(
      byteRun(),
      async () => "6.1.1",
    );
    const body = (await (await app.request("/healthz")).json()) as {
      profile: string;
      capabilities: { encoders: string[]; profile?: string };
    };
    expect(body.profile).toBe("node-media");
    expect(body.capabilities.profile ?? body.profile).toBe("node-media");
    expect(body.capabilities.encoders).toContain("ffmpeg");
    expect(body.capabilities.encoders).toContain("mediabunny-node");
  });
});
