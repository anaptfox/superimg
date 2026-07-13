//! Serializes in-browser template compiles so Rolldown WASM does not stampede.

type CompileTask<T> = {
  key: object;
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

export class CompileSupersededError extends Error {
  constructor() {
    super("Template compilation was superseded by a newer edit");
    this.name = "CompileSupersededError";
  }
}

export class CompileQueue {
  private pending: CompileTask<unknown>[] = [];
  private active = 0;
  private readonly concurrency: number;

  constructor(concurrency = 1) {
    this.concurrency = concurrency;
  }

  enqueue<T>(key: object, run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const priorIndex = this.pending.findIndex((task) => task.key === key);
      if (priorIndex !== -1) {
        const [prior] = this.pending.splice(priorIndex, 1);
        prior?.reject(new CompileSupersededError());
      }
      this.pending.push({
        key,
        run: run as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.pump();
    });
  }

  private pump(): void {
    while (this.active < this.concurrency && this.pending.length > 0) {
      const task = this.pending.shift()!;
      this.active++;
      task
        .run()
        .then(task.resolve, task.reject)
        .finally(() => {
          this.active--;
          this.pump();
        });
    }
  }
}

const globalCompileQueue = new CompileQueue(1);

export function enqueueTemplateCompile<T>(key: object, run: () => Promise<T>): Promise<T> {
  return globalCompileQueue.enqueue(key, run);
}
