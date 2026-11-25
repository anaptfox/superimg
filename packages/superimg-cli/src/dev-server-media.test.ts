import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createDevMediaApi } from "./dev-server-media.js";

describe("dev media API session boundary", () => {
  const apis: ReturnType<typeof createDevMediaApi>[] = [];

  afterEach(async () => {
    await Promise.all(apis.splice(0).map((api) => api.dispose()));
  });

  it("mints an HttpOnly session, scopes reads, and rejects mutations without its token", async () => {
    const origin = "http://localhost:4747";
    const api = createDevMediaApi({ origin, sources: new Map() });
    apis.push(api);

    const noSession = response();
    await api.handle(request("GET"), noSession.res, "/api/media/jobs");
    expect(noSession.status).toBe(403);

    const session = response();
    await api.handle(request("GET"), session.res, "/api/media/session");
    expect(session.status).toBe(200);
    const payload = JSON.parse(session.body) as { token: string };
    const cookie = String(session.headers.get("set-cookie")).split(";", 1)[0];
    if (!cookie) throw new Error("Expected session cookie");
    expect(cookie).toMatch(/^superimg_dev_session=/);

    const listed = response();
    await api.handle(request("GET", { cookie }), listed.res, "/api/media/jobs");
    expect(JSON.parse(listed.body)).toEqual({ jobs: [] });

    const rejected = response();
    await api.handle(request("POST", { cookie, origin, "content-type": "text/plain" }, "untrusted"), rejected.res, "/api/media/files");
    expect(rejected.status).toBe(403);
    expect(payload.token).toEqual(expect.any(String));
  });

  it("rejects host rebinding and cross-site session minting", async () => {
    const origin = "http://localhost:4747";
    const api = createDevMediaApi({ origin, sources: new Map() });
    apis.push(api);

    const rebound = response();
    await api.handle(request("GET", { host: "attacker.invalid" }), rebound.res, "/api/media/session");
    expect(rebound.status).toBe(403);
    expect(JSON.parse(rebound.body)).toMatchObject({ error: "host_forbidden" });

    const crossSite = response();
    await api.handle(request("GET", { "sec-fetch-site": "cross-site" }), crossSite.res, "/api/media/session");
    expect(crossSite.status).toBe(403);
    expect(JSON.parse(crossSite.body)).toMatchObject({ error: "session_forbidden" });
  });

  it("applies the media session boundary to collection snapshot and export mutations", async () => {
    const origin = "http://localhost:4747";
    let authorizedCalls = 0;
    const api = createDevMediaApi({
      origin,
      sources: new Map(),
      collectionRoute: async (_req, res, _pathname, authorize) => {
        const allowed = authorize(_req, res);
        if (allowed) authorizedCalls += 1;
        res.writeHead(allowed ? 201 : 403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ allowed }));
        return true;
      },
    });
    apis.push(api);
    const minted = response();
    await api.handle(request("GET"), minted.res, "/api/media/session");
    const token = (JSON.parse(minted.body) as { token: string }).token;
    const cookie = String(minted.headers.get("set-cookie")).split(";", 1)[0]!;

    const rejected = response();
    await api.handle(request("POST", { cookie, origin }), rejected.res, "/api/collection/snapshot");
    expect(rejected.status).toBe(403);
    expect(authorizedCalls).toBe(0);

    const accepted = response();
    await api.handle(request("POST", { cookie, origin, "x-superimg-session": token }), accepted.res, "/api/collection/export");
    expect(accepted.status).toBe(201);
    expect(authorizedCalls).toBe(1);
  });
});

function request(method: string, headers: Record<string, string> = {}, body = ""): IncomingMessage {
  return Object.assign(Readable.from(body ? [Buffer.from(body)] : []), { method, headers: { host: "localhost:4747", ...headers } }) as IncomingMessage;
}

function response(): { res: ServerResponse; readonly status: number; readonly headers: Map<string, unknown>; readonly body: string } {
  const result = { status: 200, headers: new Map<string, unknown>(), body: "" };
  const res = {
    setHeader(name: string, value: unknown) { result.headers.set(name.toLowerCase(), value); },
    writeHead(status: number, headers?: Record<string, unknown>) { result.status = status; for (const [name, value] of Object.entries(headers ?? {})) result.headers.set(name.toLowerCase(), value); return this; },
    end(value?: unknown) { if (value !== undefined) result.body += Buffer.from(value as Uint8Array | string).toString(); },
  } as unknown as ServerResponse;
  return {
    res,
    get status() { return result.status; },
    get headers() { return result.headers; },
    get body() { return result.body; },
  };
}
