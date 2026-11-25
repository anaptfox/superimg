//! Versioned compilation: superseded work never becomes an HTTP/cache result.

export function createDevSourceCache<T>(compile: () => Promise<T>, compilerVersion: () => number = () => 0) {
  let version = compilerVersion();
  let generation = 0;
  let cached: { generation: number; value: T } | null = null;
  let inFlight: { generation: number; promise: Promise<T> } | null = null;
  return {
    get generation() { return generation; },
    invalidate() { generation += 1; cached = null; },
    async get(): Promise<{ generation: number; value: T }> {
      while (true) {
        const currentVersion = compilerVersion();
        if (currentVersion !== version) { version = currentVersion; generation += 1; cached = null; }
        if (cached?.generation === generation) return cached;
        const requested = generation;
        if (inFlight?.generation !== requested) {
          inFlight = { generation: requested, promise: compile() };
        }
        const pending = inFlight;
        try {
          const value = await pending.promise;
          if (requested !== generation || compilerVersion() !== version) continue;
          cached = { generation: requested, value };
          return cached;
        } catch (error) {
          if (requested !== generation || compilerVersion() !== version) continue;
          throw error;
        } finally {
          if (inFlight === pending) inFlight = null;
        }
      }
    },
  };
}
