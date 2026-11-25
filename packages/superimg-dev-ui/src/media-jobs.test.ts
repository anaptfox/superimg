import { afterEach, describe, expect, it, vi } from "vitest";
import { createMediaJobClient } from "./media-jobs";

describe("media job transport", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("shares one pending bootstrap within a client and retries a failed bootstrap", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ token: "tok", capabilities: {} })));
    const client = createMediaJobClient();
    await Promise.all([client.session(), client.session()]);
    expect(fetchMock).toHaveBeenCalledOnce();
    const next = createMediaJobClient();
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(next.session()).rejects.toThrow("offline");
    await expect(next.session()).resolves.toMatchObject({ token: "tok" });
  });

  it("serializes cookie bootstrap across clients sharing the browser origin", async () => {
    let queue = Promise.resolve();
    const request = vi.fn((_name: string, run: () => Promise<unknown>) => {
      const result = queue.then(run);
      queue = result.then(() => {}, () => {});
      return result;
    });
    vi.stubGlobal("navigator", { locks: { request } });
    let browserCookie: string | undefined;
    let minted = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      // Like two tabs, both requests see the current cookie when they start;
      // their Set-Cookie responses arrive later and affect the shared jar.
      const token = browserCookie ?? `session-${++minted}`;
      await Promise.resolve();
      browserCookie = token;
      return new Response(JSON.stringify({ token, capabilities: {} }));
    });
    const [first, second] = await Promise.all([createMediaJobClient().session(), createMediaJobClient().session()]);
    expect(first.token).toBe(second.token);
    expect(first.token).toBe(browserCookie);
    expect(minted).toBe(1);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("establishes a session, sends the token on mutations, and uploads filenames encoded", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/session")) return new Response(JSON.stringify({ token: "tok", capabilities: {} }), { status: 200 });
      if (url.endsWith("/files")) {
        expect((init?.headers as Record<string, string>)["X-Superimg-Session"]).toBe("tok");
        expect((init?.headers as Record<string, string>)["X-Superimg-Filename"]).toBe("a%20b.mp4");
        return new Response(JSON.stringify({ id: "file-1", inspection: { tracks: [] } }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: "job-1", kind: "@foxworth/superimg/job", state: "queued" }), { status: 200 });
    });
    const client = createMediaJobClient("/api/media");
    const uploaded = await client.upload(new File(["bytes"], "a b.mp4", { type: "video/mp4" }));
    expect(uploaded.id).toBe("file-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("submits pause/resume/cancel and forwards the session token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/session")) return new Response(JSON.stringify({ token: "tok", capabilities: {} }));
      return new Response(null, { status: 204 });
    });
    const client = createMediaJobClient();
    await client.command("job/1", "pause");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "POST", headers: { "X-Superimg-Session": "tok" } });
  });

  it("looks up a server snapshot for session continuity", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "job-7", jobId: "job-7", kind: "@foxworth/superimg/job", state: "paused" })));
    const snapshot = await createMediaJobClient().get("job-7");
    expect(snapshot.id).toBe("job-7");
    expect(fetchMock).toHaveBeenCalledWith("/api/media/jobs/job-7");
  });

  it("handles named SSE progress/reset events and fetches terminal artifacts", async () => {
    let instance: { listeners: Map<string, (event: MessageEvent) => void>; close: () => void } | null = null;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "job-1", jobId: "job-1", kind: "@foxworth/superimg/job", state: "succeeded", artifacts: [{ index: 0, filename: "x.mp4" }] })));
    const close = vi.fn();
    vi.stubGlobal("EventSource", class {
      onmessage = (_event: MessageEvent) => {};
      onerror = () => {};
      listeners = new Map<string, (event: MessageEvent) => void>();
      constructor(readonly url: string) { instance = this; }
      addEventListener(type: string, listener: (event: MessageEvent) => void) { this.listeners.set(type, listener); }
      removeEventListener(type: string) { this.listeners.delete(type); }
      close() { close(); }
    });
    const client = createMediaJobClient();
    const events: unknown[] = [];
    const stop = client.watch("job-1", (event) => events.push(event));
    const source = instance as { listeners: Map<string, (event: MessageEvent) => void> } | null;
    if (!source) throw new Error("EventSource was not constructed");
    source.listeners.get("progress")?.(new MessageEvent("progress", { data: JSON.stringify({ jobId: "job-1", kind: "@foxworth/superimg/job", state: "running", completed: 1, total: 2 }) }));
    source.listeners.get("succeeded")?.(new MessageEvent("succeeded", { data: JSON.stringify({ jobId: "job-1", kind: "@foxworth/superimg/job", state: "succeeded" }) }));
    await vi.waitFor(() => expect(events).toHaveLength(2));
    expect(events[1]).toMatchObject({ id: "job-1", artifacts: [{ index: 0 }] });
    stop();
    expect(close).toHaveBeenCalledOnce();
  });
});
