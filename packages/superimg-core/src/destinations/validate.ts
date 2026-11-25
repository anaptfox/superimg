import type {
  DestinationClaim,
  DestinationDefinition,
  DestinationMedium,
} from "./types.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class DestinationCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DestinationCatalogError";
  }
}

export function validateDestinationCatalog(catalog: readonly DestinationDefinition[]): void {
  const ids = new Set<string>();

  for (const entry of catalog) {
    if (entry.schemaVersion !== 0) fail(entry.id, "schemaVersion must be 0");
    if (entry.surface !== "organic") fail(entry.id, "only organic destinations belong in this catalog");
    if (!ID.test(entry.id)) fail(entry.id, "id must be lowercase and path-safe");
    if (ids.has(entry.id)) fail(entry.id, "duplicate destination id");
    ids.add(entry.id);
    if (!DATE.test(entry.checkedAt) || Number.isNaN(Date.parse(`${entry.checkedAt}T00:00:00Z`))) {
      fail(entry.id, "checkedAt must be a valid YYYY-MM-DD date");
    }
    if (entry.provenance.length === 0) fail(entry.id, "at least one official provenance source is required");

    const sourceIds = new Set<string>();
    for (const source of entry.provenance) {
      if (!ID.test(source.id) || sourceIds.has(source.id)) fail(entry.id, `invalid or duplicate provenance id ${source.id}`);
      sourceIds.add(source.id);
      let url: URL;
      try {
        url = new URL(source.url);
      } catch {
        fail(entry.id, `invalid provenance URL ${source.url}`);
      }
      if (url!.protocol !== "https:") fail(entry.id, `provenance URL must use HTTPS: ${source.url}`);
    }

    if (entry.supportedMedia.length === 0) fail(entry.id, "supportedMedia cannot be empty");
    const media = new Set<DestinationMedium>();
    for (const claim of entry.supportedMedia) {
      validateClaim(entry.id, claim, sourceIds);
      if (media.has(claim.value)) fail(entry.id, `duplicate supported medium ${claim.value}`);
      media.add(claim.value);
    }
    validateClaim(entry.id, entry.recommendedCanvas, sourceIds);
    if (!positiveInteger(entry.recommendedCanvas.value.width) || !positiveInteger(entry.recommendedCanvas.value.height)) {
      fail(entry.id, "recommended canvas must contain positive integer dimensions");
    }

    if (media.has("video") !== Boolean(entry.encoding.video)) fail(entry.id, "video encoding must exactly match video support");
    if (media.has("image") !== Boolean(entry.encoding.image)) fail(entry.id, "image encoding must exactly match image support");
    if (entry.encoding.video) {
      validateClaim(entry.id, entry.encoding.video.format, sourceIds);
      validateClaim(entry.id, entry.encoding.video.codec, sourceIds);
      validateClaim(entry.id, entry.encoding.video.audioCodec, sourceIds);
      validateClaim(entry.id, entry.encoding.video.fps, sourceIds);
      if (!positiveInteger(entry.encoding.video.fps.value)) fail(entry.id, "video fps must be a positive integer");
    }
    if (entry.encoding.image) validateClaim(entry.id, entry.encoding.image.format, sourceIds);
  }
}

function validateClaim(id: string, claim: DestinationClaim<unknown>, sourceIds: ReadonlySet<string>): void {
  if (claim.authority === "superimg") {
    if (claim.status !== "recommendation") fail(id, "SuperImg-owned values cannot be platform requirements");
    if (claim.provenanceId !== undefined) fail(id, "SuperImg-owned values must not cite a platform source");
    return;
  }
  if (!claim.provenanceId || !sourceIds.has(claim.provenanceId)) {
    fail(id, `platform claim cites missing provenance ${String(claim.provenanceId)}`);
  }
}

function positiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function fail(id: string, message: string): never {
  throw new DestinationCatalogError(`Invalid destination ${JSON.stringify(id)}: ${message}`);
}
