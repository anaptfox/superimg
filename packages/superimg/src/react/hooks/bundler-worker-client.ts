//! Offloads Rolldown WASM bundling to a dedicated worker when available.

import type { TemplateBundle } from "@superimg/types";
import { enqueueTemplateCompile } from "./compile-queue.js";

type WorkerResponse =
  | { id: number; ok: true; result: TemplateBundle }
  | { id: number; ok: false; error: string };

let worker: Worker | null = null;
let workerFailed = false;
let nextId = 0;
const inflight = new Map<
  number,
  { resolve: (v: TemplateBundle) => void; reject: (e: Error) => void }
>();

function ensureWorker(): Worker | null {
  if (workerFailed || typeof Worker === "undefined") return null;
  if (worker) return worker;

  try {
    // Chunk lives under dist/chunks/; worker entry is dist/bundler.worker.js.
    // Avoid `new Worker(new URL(...))` — Vite rebundles that pattern and breaks the prebuilt worker.
    const workerUrl = new URL("../bundler.worker.js", import.meta.url);
    worker = new Worker(workerUrl, { type: "module" });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      const pending = inflight.get(msg.id);
      if (!pending) return;
      inflight.delete(msg.id);
      if (msg.ok) pending.resolve(msg.result);
      else pending.reject(new Error(msg.error));
    };
    worker.onerror = () => {
      workerFailed = true;
      worker?.terminate();
      worker = null;
      for (const [, pending] of inflight) {
        pending.reject(new Error("Bundler worker failed"));
      }
      inflight.clear();
    };
    return worker;
  } catch {
    workerFailed = true;
    return null;
  }
}

function bundleInWorker(code: string): Promise<TemplateBundle> {
  const w = ensureWorker();
  if (!w) return Promise.reject(new Error("Worker unavailable"));

  const id = ++nextId;
  return new Promise<TemplateBundle>((resolve, reject) => {
    inflight.set(id, { resolve, reject });
    w.postMessage({ id, code });
  });
}

async function bundleOnMainThread(code: string): Promise<TemplateBundle> {
  const { initBundler, bundleTemplateBrowser } = await import(
    "../../bundler-browser.js"
  );
  await initBundler();
  return bundleTemplateBrowser(code);
}

/** Queue-backed bundle: worker when possible, main-thread fallback. */
export function bundleTemplateQueued(code: string): Promise<TemplateBundle> {
  return enqueueTemplateCompile(async () => {
    if (!workerFailed) {
      try {
        return await bundleInWorker(code);
      } catch {
        workerFailed = true;
      }
    }
    return bundleOnMainThread(code);
  });
}