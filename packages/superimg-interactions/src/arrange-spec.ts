import type { JsonSchema } from "@foxworth/boundary/program";
import { MEDIA_INTERACTION_IDS } from "./contracts.js";

const NON_EMPTY = { type: "string", minLength: 1 } as const;
const POSITIVE_INT = { type: "integer", minimum: 1 } as const;
const SHA256 = { type: "string", pattern: "^[a-f0-9]{64}$" } as const;

/**
 * `request` is deliberately a generic object, not a `oneOf` over
 * `ARRANGE_PATTERNS[].schema`: those per-pattern schemas describe a bare
 * `spec`, not the `{ pattern, spec, assets? }` envelope, and the registry's
 * `schema` field is typed `Readonly<Record<string, unknown>>` — structural,
 * not `JsonSchema`-checked. Reassembling an honest per-pattern envelope
 * union here would duplicate invariants `parseArrangeRequest` already owns
 * (base64 assets, unknown-key rejection, pattern/spec pairing) without the
 * host ever trusting this declared schema over that parse. Declaring less
 * here and enforcing more in the handler is the honest shape; a schema that
 * *looked* exact but had to be re-validated anyway would lie about where the
 * real gate is.
 */
const ARRANGE_STILL_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["request"],
  properties: {
    request: { type: "object" },
    width: POSITIVE_INT,
    height: POSITIVE_INT,
    format: { const: "png" },
    /**
     * Still frame in **seconds**, the same clock `media.export` and
     * `superimg export --at` use. A motion
     * pattern renders as video, so a still needs one.
     */
    at: { type: "number", minimum: 0 },
  },
} as const satisfies JsonSchema;

const ARRANGE_STILL_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["mimeType", "bytes", "width", "height", "sha256"],
  properties: {
    mimeType: NON_EMPTY,
    /** Portable raster bytes, base64. */
    bytes: NON_EMPTY,
    width: POSITIVE_INT,
    height: POSITIVE_INT,
    sha256: SHA256,
  },
} as const satisfies JsonSchema;

export const MEDIA_ARRANGE_STILL_SPEC = Object.freeze({
  id: MEDIA_INTERACTION_IDS.arrange,
  input: ARRANGE_STILL_INPUT_SCHEMA,
  output: ARRANGE_STILL_OUTPUT_SCHEMA,
  reads: [],
  changes: [],
  summary: "Render one portable arrangement request to inline still bytes",
});
