import type { JobEvent } from "@superimg/types";

export interface MediaJobSnapshot extends JobEvent {
  readonly id: string;
  readonly artifacts?: readonly { readonly index: number; readonly filename?: string; readonly mimeType?: string; readonly byteLength?: number }[];
}

export interface MediaJobClient {
  session(): Promise<{ token: string; capabilities: Record<string, unknown> }>;
  upload(file: File): Promise<{ id: string; inspection?: unknown }>;
  submit(body: unknown): Promise<MediaJobSnapshot>;
  get(id: string): Promise<MediaJobSnapshot>;
  watch(id: string, onEvent: (event: JobEvent | MediaJobSnapshot) => void, onError?: (error: Event) => void): () => void;
  command(id: string, command: "pause" | "resume" | "cancel"): Promise<void>;
  artifact(id: string, index: number): Promise<Blob>;
}

export function createMediaJobClient(base = "/api/media"): MediaJobClient {
  let sessionValue: { token: string; capabilities: Record<string, unknown> } | null = null;
  let sessionPending: Promise<{ token: string; capabilities: Record<string, unknown> }> | null = null;
  const session = (): Promise<{ token: string; capabilities: Record<string, unknown> }> => {
    if (sessionValue) return Promise.resolve(sessionValue);
    if (sessionPending) return sessionPending;
    const load = async () => {
      const response = await fetch(`${base}/session`);
      if (!response.ok) throw new Error(`Media session failed (${response.status})`);
      return await response.json() as { token: string; capabilities: Record<string, unknown> };
    };
    // Tabs share cookies. Serialize initial session minting so a second tab
    // sees the first Set-Cookie rather than replacing it with another session.
    const bootstrap = typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks.request("superimg:media-session", load)
      : load();
    sessionPending = bootstrap.then(value => {
      sessionValue = value;
      return value;
    }).finally(() => { sessionPending = null; });
    return sessionPending;
  };
  const mutationHeaders = async (extra: Record<string, string> = {}) => ({
    "X-Superimg-Session": (await session()).token,
    ...extra,
  });
  return {
    session,
    async upload(file) {
      const response = await fetch(`${base}/files`, {
        method: "POST",
        headers: await mutationHeaders({
          "X-Superimg-Filename": encodeURIComponent(file.name),
          "Content-Type": file.type || "application/octet-stream",
        }),
        body: file,
      });
      if (!response.ok) throw new Error(`File upload failed (${response.status})`);
      return await response.json();
    },
    async submit(body) {
      const response = await fetch(`${base}/jobs`, {
        method: "POST",
        headers: await mutationHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`Job submission failed (${response.status})`);
      return await response.json() as MediaJobSnapshot;
    },
    async get(id) {
      const response = await fetch(`${base}/jobs/${encodeURIComponent(id)}`);
      if (!response.ok) throw new Error(`Job lookup failed (${response.status})`);
      return await response.json() as MediaJobSnapshot;
    },
    watch(id, onEvent, onError) {
      const source = new EventSource(`${base}/jobs/${encodeURIComponent(id)}/events`);
      const handle = async (event: MessageEvent) => {
        try {
          const value = JSON.parse(event.data) as Partial<JobEvent> & { id?: string; snapshot?: MediaJobSnapshot };
          const snapshot = value.snapshot;
          if (snapshot) {
            onEvent(snapshot);
            return;
          }
          if (!value.jobId && !value.id) return;
          const eventValue = { ...value, jobId: value.jobId ?? value.id ?? id } as JobEvent;
          if (eventValue.state === "succeeded") {
            const response = await fetch(`${base}/jobs/${encodeURIComponent(id)}`);
            if (response.ok) onEvent(await response.json() as MediaJobSnapshot);
            else onEvent(eventValue);
          } else {
            onEvent(eventValue);
          }
        } catch { /* ignore malformed events */ }
      };
      source.addEventListener("progress", handle);
      source.addEventListener("reset", handle);
      source.addEventListener("succeeded", handle);
      source.onerror = (event) => onError?.(event);
      return () => {
        source.removeEventListener("progress", handle);
        source.removeEventListener("reset", handle);
        source.removeEventListener("succeeded", handle);
        source.close();
      };
    },
    async command(id, command) {
      const response = await fetch(`${base}/jobs/${encodeURIComponent(id)}/${command}`, {
        method: "POST",
        headers: await mutationHeaders(),
      });
      if (!response.ok) throw new Error(`${command} failed (${response.status})`);
    },
    async artifact(id, index) {
      const response = await fetch(`${base}/jobs/${encodeURIComponent(id)}/artifacts/${index}`);
      if (!response.ok) throw new Error(`Artifact download failed (${response.status})`);
      return response.blob();
    },
  };
}
