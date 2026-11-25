//! Lifecycle for one host-admitted native surface occurrence. The existing
//! retained-resource owner decides when to create and dispose this instance.
import type { NativeSurfaceFrame, NativeSurfaceHost, NativeSurfaceInstance, NativeSurfaceModule } from "@superimg/types";

export interface NativeSurfaceLifecycle<Data> {
  sample(frame: NativeSurfaceFrame<Data>): Promise<void>;
  dispose(): Promise<void>;
}

export function createNativeSurfaceLifecycle<Data>(module: NativeSurfaceModule<Data>, host: NativeSurfaceHost): NativeSurfaceLifecycle<Data> {
  const controller = new AbortController();
  let disposed = false;
  let disposal: Promise<void> | undefined;
  let queue: Promise<void> = Promise.resolve();
  const onAbort = () => { void dispose().catch(() => {}); };
  if (host.signal.aborted) controller.abort(host.signal.reason);
  else host.signal.addEventListener("abort", onAbort, { once: true });
  const ready: Promise<NativeSurfaceInstance<Data>> = Promise.resolve().then(() => {
    controller.signal.throwIfAborted();
    return module.create({ ...host, signal: controller.signal });
  });
  // Creation may fail before the first sample; preserve the original rejection
  // for sample/dispose callers without producing an unhandled rejection.
  void ready.catch(() => {});

  function sample(frame: NativeSurfaceFrame<Data>): Promise<void> {
    const next = queue.then(async () => {
      if (disposed) throw new Error("Native surface is disposed");
      controller.signal.throwIfAborted();
      const instance = await ready;
      if (disposed) throw new Error("Native surface is disposed");
      controller.signal.throwIfAborted();
      try { await instance.sample(frame); }
      catch (error) { disposed = true; controller.abort(error); throw error; }
    });
    queue = next.catch(() => {});
    return next.catch(async error => {
      try { await dispose(); }
      catch (cleanupError) { throw new AggregateError([error, cleanupError], "Native surface sample and cleanup failed"); }
      throw error;
    });
  }

  function dispose(): Promise<void> {
    if (disposal) return disposal;
    disposed = true;
    controller.abort(host.signal.reason);
    host.signal.removeEventListener("abort", onAbort);
    disposal = (async () => {
      await queue;
      let instance: NativeSurfaceInstance<Data>;
      try { instance = await ready; } catch { return; }
      await instance.dispose();
    })();
    return disposal;
  }
  return Object.freeze({ sample, dispose });
}
