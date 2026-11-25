import type { ArrangeFailure } from "./types.js";

export class ArrangeError extends Error {
  readonly failures: ArrangeFailure[];

  constructor(failures: ArrangeFailure[]) {
    super(failures.map((failure) => failure.message).join("; "));
    this.name = "ArrangeError";
    this.failures = failures;
  }
}
