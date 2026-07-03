//! Serializes in-browser template compiles so Rolldown WASM does not stampede.

type CompileTask<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

class CompileQueue {
  private pending: CompileTask<unknown>[] = [];
  private active = 0;
  private readonly concurrency: number;

  constructor(concurrency = 1) {
    this.concurrency = concurrency;
  }

  enqueue<T>(run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push({
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

export function enqueueTemplateCompile<T>(run: () => Promise<T>): Promise<T> {
  return globalCompileQueue.enqueue(run);
}