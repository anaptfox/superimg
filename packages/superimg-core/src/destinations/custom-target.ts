import type { OutputFormat } from "@superimg/types";
import { getDestination } from "./catalog.js";
import type {
  CustomDestinationTarget,
  DestinationId,
  DestinationTarget,
} from "./types.js";

const CUSTOM_TARGET = /^(\d+)[xX](\d+)(?:\.([a-zA-Z0-9]+))?$/;
const CUSTOM_FORMATS = new Set<OutputFormat>([
  "mp4",
  "webm",
  "mov",
  "mkv",
  "gif",
  "png",
  "webp",
  "jpeg",
  "svg",
  "html",
]);

export type DestinationTargetErrorCode =
  | "DESTINATION_TARGET_EMPTY"
  | "DESTINATION_TARGET_UNKNOWN"
  | "DESTINATION_TARGET_INVALID_DIMENSION"
  | "DESTINATION_TARGET_UNSUPPORTED_FORMAT";

export class DestinationTargetError extends Error {
  readonly code: DestinationTargetErrorCode;

  constructor(code: DestinationTargetErrorCode, message: string) {
    super(message);
    this.name = "DestinationTargetError";
    this.code = code;
  }
}

export function parseCustomDestinationTarget(specifier: string): CustomDestinationTarget | null {
  const input = specifier.trim();
  const match = CUSTOM_TARGET.exec(input);
  if (!match) return null;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new DestinationTargetError(
      "DESTINATION_TARGET_INVALID_DIMENSION",
      `Custom destination dimensions must be positive safe integers: ${JSON.stringify(specifier)}`,
    );
  }

  const rawFormat = match[3]?.toLowerCase();
  if (rawFormat && !CUSTOM_FORMATS.has(rawFormat as OutputFormat)) {
    throw new DestinationTargetError(
      "DESTINATION_TARGET_UNSUPPORTED_FORMAT",
      `Unsupported custom destination format ${JSON.stringify(rawFormat)}`,
    );
  }
  const format = rawFormat as OutputFormat | undefined;
  const id = `${width}x${height}${format ? `.${format}` : ""}`;
  return Object.freeze({ kind: "custom", id, width, height, ...(format ? { format } : {}) });
}

export function resolveDestinationTarget(specifier: string): DestinationTarget {
  const input = specifier.trim();
  if (!input) {
    throw new DestinationTargetError("DESTINATION_TARGET_EMPTY", "Destination target cannot be empty");
  }

  const destination = getDestination(input);
  if (destination) {
    return { kind: "catalog", id: input as DestinationId, destination };
  }

  const custom = parseCustomDestinationTarget(input);
  if (custom) return custom;

  throw new DestinationTargetError(
    "DESTINATION_TARGET_UNKNOWN",
    `Unknown destination ${JSON.stringify(specifier)}; use a catalog ID or WIDTHxHEIGHT[.format]`,
  );
}
