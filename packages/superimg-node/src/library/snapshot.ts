import type { JsonObject, JsonValue } from "@superimg/types";

/** Portable snapshots accept immutable JSON, independently of interaction transport. */
export type MediaJsonValue = string | number | boolean | null | MediaJsonObject | readonly MediaJsonValue[];
export type MediaJsonObject = { readonly [key: string]: MediaJsonValue };
export type MediaCollectionSnapshotEntry = Readonly<{ id: string; data: MediaJsonObject; dataDigest: string }>;
export type MediaCollectionSnapshot = Readonly<{ schemaVersion: 0; kind: "media-collection-snapshot"; source: string; sourceId: string; providerHash: string; snapshotDigest: string; entries: readonly MediaCollectionSnapshotEntry[] }>;

/** Validate and clone transport data into the mutable JSON shape used by media. */
export function snapshotDataToMediaJson(value: unknown): JsonObject {
  const ancestors = new WeakSet<object>();
  const clone = (input: unknown): JsonValue => {
    if (input === null || typeof input === "string" || typeof input === "boolean") return input;
    if (typeof input === "number" && Number.isFinite(input)) return input;
    if (Array.isArray(input)) {
      const descriptors = Object.getOwnPropertyDescriptors(input);
      if (ancestors.has(input) || Reflect.ownKeys(input).length !== input.length + 1) throw new TypeError("Snapshot data must be portable JSON");
      for (let index = 0; index < input.length; index++) {
        const descriptor = descriptors[String(index)];
        if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) throw new TypeError("Snapshot data must be portable JSON");
      }
      ancestors.add(input);
      try { return Array.from({ length: input.length }, (_, index) => clone(descriptors[String(index)]!.value)); }
      finally { ancestors.delete(input); }
    }

    if (typeof input === "object" && input !== null && (Object.getPrototypeOf(input) === Object.prototype || Object.getPrototypeOf(input) === null)) {
      if (ancestors.has(input) || Object.getOwnPropertySymbols(input).length !== 0) throw new TypeError("Snapshot data must be portable JSON");
      ancestors.add(input);
      try {
        const result: JsonObject = {};
        for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(input))) {
          if (!descriptor.enumerable || !("value" in descriptor)) throw new TypeError("Snapshot data must be portable JSON");
          Object.defineProperty(result, key, { value: clone(descriptor.value), enumerable: true, writable: true, configurable: true });
        }
        return result;
      } finally { ancestors.delete(input); }
    }
    throw new TypeError("Snapshot data must be portable JSON");
  };
  const result = clone(value);
  if (result === null || typeof result !== "object" || Array.isArray(result)) throw new TypeError("Snapshot entry must be a JSON object");
  return result;
}
