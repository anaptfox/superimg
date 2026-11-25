/** A missing mutation response cannot establish whether an effect started. */
export function remainsUncertain(previous: boolean, error: unknown, mutation: boolean): boolean {
  const evidence = error as { unknown?: boolean; hostReported?: boolean } | null;
  return previous || Boolean(evidence?.unknown) || (mutation && !evidence?.hostReported);
}

/** Only these reconciliation outcomes establish the attempt's source state. */
export function reconciledUncertainty(previous: boolean, status: string, subject: "source" | "export" = "source"): boolean {
  if (subject === "export") return previous;
  if (status === "completed" || status === "not-applied") return false;
  return previous || status === "uncertain";
}
