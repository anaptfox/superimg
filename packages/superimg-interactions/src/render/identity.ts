import { createHash } from "node:crypto";
import { canonicalJson, type JsonValue, type Sha256Digest } from "@foxworth/boundary/program";

export function renderDigest(domain: string, value: JsonValue): Sha256Digest {
  if (!domain.trim() || domain.includes("\0")) {
    throw new TypeError("render digest domain must be non-empty and contain no NUL bytes");
  }
  const hex = createHash("sha256")
    .update(domain)
    .update("\0")
    .update(canonicalJson(value))
    .digest("hex");
  return `sha256:${hex}`;
}
