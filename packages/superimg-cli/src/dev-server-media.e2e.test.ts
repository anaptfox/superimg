import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { AudioSample, AudioSampleSource, BufferTarget, Mp4OutputFormat, Output, Quality, VideoSample, VideoSampleSource } from "mediabunny";
import { registerMediabunnyServer } from "@mediabunny/server";
import { createDevMediaApi } from "./dev-server-media.js";

registerMediabunnyServer();

describe("dev media HTTP conversion", () => {
  const close: Array<() => Promise<void>> = [];
  afterEach(async () => { await Promise.all(close.splice(0).map((fn) => fn())); });

  it("scopes upload and conversion jobs to one session and serves completed artifacts", async () => {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("Expected TCP address");
    const origin = `http://127.0.0.1:${address.port}`;
    const api = createDevMediaApi({ origin, sources: new Map() });
    server.on("request", (req, res) => void api.handle(req, res, new URL(req.url ?? "/", origin).pathname));
    close.push(async () => { await api.dispose(); await new Promise<void>((resolve) => server.close(() => resolve())); });

    const session = await fetch(`${origin}/api/media/session`);
    const token = (await session.json() as { token: string }).token;
    const cookie = session.headers.get("set-cookie")!.split(";", 1)[0]!;
    const headers = { Cookie: cookie, Origin: origin, "X-Superimg-Session": token };
    const upload = await fetch(`${origin}/api/media/files`, { method: "POST", headers: { ...headers, "X-Superimg-Filename": encodeURIComponent("source.mp4"), "Content-Type": "video/mp4" }, body: await sourceBytes() });
    expect(upload.status).toBe(201);
    const file = await upload.json() as { id: string; inspection: { tracks: Array<{ id: string; kind: string }> } };
    const video = file.inspection.tracks.find((track) => track.kind === "video")!;
    const job = await fetch(`${origin}/api/media/jobs`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ kind: "conversion", request: { sources: [{ id: "source", fileId: file.id }], video: { sourceId: "source", trackId: video.id }, audio: [], format: "mkv" } }) });
    expect(job.status).toBe(202);
    const created = await job.json() as { id: string };
    let snapshot: { state: string; artifacts: Array<{ index: number; byteLength: number }> } | undefined;
    for (let i = 0; i < 50; i += 1) { snapshot = await (await fetch(`${origin}/api/media/jobs/${created.id}`, { headers: { Cookie: cookie } })).json(); if (snapshot?.state === "succeeded") break; await new Promise((resolve) => setTimeout(resolve, 20)); }
    expect(snapshot?.state).toBe("succeeded");
    expect(snapshot?.artifacts[0]?.byteLength).toBeGreaterThan(0);
    const artifact = await fetch(`${origin}/api/media/jobs/${created.id}/artifacts/0`, { headers: { Cookie: cookie } });
    expect(artifact.status).toBe(200); expect((await artifact.arrayBuffer()).byteLength).toBeGreaterThan(0);
    expect((await fetch(`${origin}/api/media/jobs/${created.id}`, { headers: { Cookie: "superimg_dev_session=other" } })).status).toBe(404);

    const secondSession = await fetch(`${origin}/api/media/session`);
    const secondToken = (await secondSession.json() as { token: string }).token;
    const secondCookie = secondSession.headers.get("set-cookie")!.split(";", 1)[0]!;
    const secondHeaders = { Cookie: secondCookie, Origin: origin, "X-Superimg-Session": secondToken };
    expect((await fetch(`${origin}/api/media/jobs/${created.id}`, { headers: { Cookie: secondCookie } })).status).toBe(404);
    expect((await fetch(`${origin}/api/media/jobs/${created.id}/artifacts/0`, { headers: { Cookie: secondCookie } })).status).toBe(404);
    expect((await fetch(`${origin}/api/media/jobs`, {
      method: "POST", headers: { ...secondHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "conversion", request: { sources: [{ id: "source", fileId: file.id }], video: { sourceId: "source", trackId: video.id }, audio: [], format: "mkv" } }),
    })).status).toBe(422);
    expect((await fetch(`${origin}/api/media/jobs`, {
      method: "POST", headers: { Cookie: cookie, Origin: origin, "X-Superimg-Session": "wrong-token", "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "conversion", request: { sources: [], video: {}, audio: [], format: "mkv" } }),
    })).status).toBe(403);
    expect((await fetch(`${origin}/api/media/jobs`, {
      method: "POST", headers: { Cookie: cookie, Origin: "http://attacker.invalid", "X-Superimg-Session": token, "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "conversion", request: { sources: [], video: {}, audio: [], format: "mkv" } }),
    })).status).toBe(403);

    const invalid = await fetch(`${origin}/api/media/jobs`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "conversion", request: {
        sources: [{ id: "source", fileId: file.id }], video: { sourceId: "source", trackId: video.id }, audio: [], format: "mp4",
        encoding: { video: { codec: "vp9", alpha: "keep" } },
      } }),
    });
    expect(invalid.status).toBe(202);
    const invalidJob = await invalid.json() as { id: string };
    const failed = await waitForSnapshot(origin, invalidJob.id, cookie);
    expect(failed).toMatchObject({ state: "failed", artifacts: [] });
  });
});

async function waitForSnapshot(origin: string, id: string, cookie: string): Promise<{ state: string; artifacts: unknown[] }> {
  for (let i = 0; i < 50; i += 1) {
    const snapshot = await (await fetch(`${origin}/api/media/jobs/${id}`, { headers: { Cookie: cookie } })).json() as { state: string; artifacts: unknown[] };
    if (snapshot.state === "failed" || snapshot.state === "succeeded" || snapshot.state === "cancelled") return snapshot;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for job completion");
}

async function sourceBytes() { const target = new BufferTarget(); const output = new Output({ format: new Mp4OutputFormat(), target }); const video = new VideoSampleSource({ codec: "avc", quality: new Quality("low") }); output.addVideoTrack(video); await output.start(); const frame = new VideoSample(new Uint8Array(16 * 16 * 4), { format: "RGBA", codedWidth: 16, codedHeight: 16, timestamp: 0, duration: 1 }); await video.add(frame); frame.close(); await output.finalize(); return target.buffer!; }
