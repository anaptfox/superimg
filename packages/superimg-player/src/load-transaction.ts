//! Latest-request-wins candidate transaction shared by browser player surfaces.

export type LoadTransactionOutcome<T> =
  | { readonly status: "committed"; readonly value: T }
  | { readonly status: "superseded" }
  | { readonly status: "failed"; readonly error: unknown };

/** Own resources while a load candidate is invisible and uncommitted. */
export class CandidateScope {
  private rollbacks: Array<() => void> = [];

  defer(rollback: () => void): void {
    this.rollbacks.push(rollback);
  }

  release(): void {
    this.rollbacks = [];
  }

  rollback(): void {
    const rollbacks = this.rollbacks.splice(0).reverse();
    for (const rollback of rollbacks) {
      try {
        rollback();
      } catch {
        // Failed candidates must not replace a prior committed surface because
        // their cleanup reported a secondary error.
      }
    }
  }
}

/**
 * Runs a hidden candidate through prepare → current-request check → commit.
 * Candidates retain ownership through `scope` until their commit finishes.
 */
export class LatestLoadTransaction {
  private revision = 0;

  invalidate(): void {
    this.revision++;
  }

  async run<Candidate, Value>(operations: {
    readonly prepare: (scope: CandidateScope) => Promise<Candidate>;
    readonly commit: (candidate: Candidate) => Value | Promise<Value>;
  }): Promise<LoadTransactionOutcome<Value>> {
    const revision = ++this.revision;
    const scope = new CandidateScope();
    try {
      const candidate = await operations.prepare(scope);
      if (revision !== this.revision) {
        scope.rollback();
        return { status: "superseded" };
      }
      // Ownership transfers at the commit boundary. A platform event handler
      // may throw during commit; that is reported to its caller without
      // retroactively tearing down the newly committed surface.
      scope.release();
      const value = await operations.commit(candidate);
      return { status: "committed", value };
    } catch (error) {
      scope.rollback();
      return revision === this.revision
        ? { status: "failed", error }
        : { status: "superseded" };
    }
  }
}
