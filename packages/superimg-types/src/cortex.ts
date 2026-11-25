//! Cortex task material. Not an Ops operation and not an export bundle.
//! Untrusted JSON becomes a bundle only through parseCortexBundle.

export const CORTEX_STOCK_VIEWS = [
  "event-story",
  "daily-project-report",
] as const;

export type CortexStockViewId = (typeof CORTEX_STOCK_VIEWS)[number];

export const EDITORIAL_INTENTS = [
  "decision_support",
  "status",
  "explanation",
  "memory",
] as const;

export type EditorialIntent = (typeof EDITORIAL_INTENTS)[number];

export const EDITORIAL_AUDIENCES = ["owner", "team", "public"] as const;

export type EditorialAudience = (typeof EDITORIAL_AUDIENCES)[number];

export interface EditorialBrief {
  readonly question: string;
  readonly intent: EditorialIntent;
  readonly audience: EditorialAudience;
  readonly emphasis?: readonly string[];
}

export const VISUAL_ATOM_KINDS = [
  "metric",
  "series",
  "event",
  "table",
  "entity",
  "relation",
  "text",
  "image",
  "video",
  "code",
  "geo",
  "duration",
  "status",
  "evidence",
] as const;

export type VisualAtomKind = (typeof VISUAL_ATOM_KINDS)[number];

export interface VisualAtom {
  readonly kind: VisualAtomKind;
  readonly id?: string;
  readonly label?: string;
  readonly value?: string | number;
  readonly unit?: string;
  readonly at?: string;
  readonly href?: string;
  readonly text?: string;
}

export const CORTEX_ASSET_KINDS = ["image", "video", "file"] as const;

export type CortexAssetKind = (typeof CORTEX_ASSET_KINDS)[number];

export interface CortexAssetRef {
  readonly id: string;
  readonly kind: CortexAssetKind;
  readonly href?: string;
}

export interface CortexEvidenceRef {
  readonly id: string;
  readonly source: string;
  readonly href?: string;
  readonly label?: string;
}

export interface CortexCustomPayload {
  readonly kind: string;
  readonly data: unknown;
}

/** Ephemeral task material. Render does not require a snapshot. */
export interface CortexBundle {
  readonly brief: EditorialBrief;
  readonly atoms: readonly VisualAtom[];
  readonly custom?: CortexCustomPayload;
  readonly assets?: readonly CortexAssetRef[];
  readonly evidence?: readonly CortexEvidenceRef[];
}

/** Plan identity for a stock view. Not a publication receipt. */
export interface CortexArtifactRecord {
  readonly viewId: CortexStockViewId | string;
  readonly reason: string;
}

export class CortexBundleError extends Error {
  readonly code = "INVALID_BUNDLE" as const;
  constructor(readonly path: string, message: string) {
    super(message);
    this.name = "CortexBundleError";
  }
}

export function isCortexStockViewId(value: string): value is CortexStockViewId {
  return (CORTEX_STOCK_VIEWS as readonly string[]).includes(value);
}

export function atomKinds(bundle: CortexBundle): ReadonlySet<VisualAtomKind> {
  return new Set(bundle.atoms.map((atom) => atom.kind));
}

const BUNDLE_KEYS = new Set(["brief", "atoms", "custom", "assets", "evidence"]);
const BRIEF_KEYS = new Set(["question", "intent", "audience", "emphasis"]);
const ATOM_KEYS = new Set(["kind", "id", "label", "value", "unit", "at", "href", "text"]);
const ASSET_KEYS = new Set(["id", "kind", "href"]);
const EVIDENCE_KEYS = new Set(["id", "source", "href", "label"]);
const CUSTOM_KEYS = new Set(["kind", "data"]);
const INTENTS = new Set<string>(EDITORIAL_INTENTS);
const AUDIENCES = new Set<string>(EDITORIAL_AUDIENCES);
const ATOM_KIND_SET = new Set<string>(VISUAL_ATOM_KINDS);
const ASSET_KIND_SET = new Set<string>(CORTEX_ASSET_KINDS);

export function parseCortexBundle(value: unknown): CortexBundle {
  const root = asRecord(value, "");
  rejectUnknownKeys(root, BUNDLE_KEYS, "");
  const brief = parseBrief(root.brief);
  const atoms = asArray(root.atoms, "atoms").map((atom, index) =>
    parseAtom(atom, `atoms.${index}`),
  );
  const bundle: CortexBundle = {
    brief,
    atoms: Object.freeze(atoms),
    ...(root.custom === undefined ? {} : { custom: parseCustom(root.custom) }),
    ...(root.assets === undefined
      ? {}
      : {
          assets: Object.freeze(
            asArray(root.assets, "assets").map((asset, index) =>
              parseAsset(asset, `assets.${index}`),
            ),
          ),
        }),
    ...(root.evidence === undefined
      ? {}
      : {
          evidence: Object.freeze(
            asArray(root.evidence, "evidence").map((item, index) =>
              parseEvidence(item, `evidence.${index}`),
            ),
          ),
        }),
  };
  return Object.freeze(bundle);
}

function parseBrief(value: unknown): EditorialBrief {
  const brief = asRecord(value, "brief");
  rejectUnknownKeys(brief, BRIEF_KEYS, "brief");
  const question = asNonEmptyString(brief.question, "brief.question");
  const intent = brief.intent;
  if (typeof intent !== "string" || !INTENTS.has(intent)) {
    throw new CortexBundleError("brief.intent", "brief.intent is not a known editorial intent");
  }
  const audience = brief.audience;
  if (typeof audience !== "string" || !AUDIENCES.has(audience)) {
    throw new CortexBundleError("brief.audience", "brief.audience is not a known editorial audience");
  }
  const parsed: EditorialBrief = {
    question,
    intent: intent as EditorialIntent,
    audience: audience as EditorialAudience,
    ...(brief.emphasis === undefined
      ? {}
      : {
          emphasis: Object.freeze(
            asArray(brief.emphasis, "brief.emphasis").map((item, index) =>
              asNonEmptyString(item, `brief.emphasis.${index}`),
            ),
          ),
        }),
  };
  return Object.freeze(parsed);
}

function parseAtom(value: unknown, path: string): VisualAtom {
  const atom = asRecord(value, path);
  rejectUnknownKeys(atom, ATOM_KEYS, path);
  const kind = atom.kind;
  if (typeof kind !== "string" || !ATOM_KIND_SET.has(kind)) {
    throw new CortexBundleError(`${path}.kind`, `${path}.kind is not a known visual atom kind`);
  }
  const parsed: VisualAtom = {
    kind: kind as VisualAtomKind,
    ...(atom.id === undefined ? {} : { id: asNonEmptyString(atom.id, `${path}.id`) }),
    ...(atom.label === undefined ? {} : { label: asNonEmptyString(atom.label, `${path}.label`) }),
    ...(atom.value === undefined ? {} : { value: asScalar(atom.value, `${path}.value`) }),
    ...(atom.unit === undefined ? {} : { unit: asNonEmptyString(atom.unit, `${path}.unit`) }),
    ...(atom.at === undefined ? {} : { at: asNonEmptyString(atom.at, `${path}.at`) }),
    ...(atom.href === undefined ? {} : { href: asNonEmptyString(atom.href, `${path}.href`) }),
    ...(atom.text === undefined ? {} : { text: asNonEmptyString(atom.text, `${path}.text`) }),
  };
  return Object.freeze(parsed);
}

function parseCustom(value: unknown): CortexCustomPayload {
  const custom = asRecord(value, "custom");
  rejectUnknownKeys(custom, CUSTOM_KEYS, "custom");
  return Object.freeze({
    kind: asNonEmptyString(custom.kind, "custom.kind"),
    data: custom.data,
  });
}

function parseAsset(value: unknown, path: string): CortexAssetRef {
  const asset = asRecord(value, path);
  rejectUnknownKeys(asset, ASSET_KEYS, path);
  const kind = asset.kind;
  if (typeof kind !== "string" || !ASSET_KIND_SET.has(kind)) {
    throw new CortexBundleError(`${path}.kind`, `${path}.kind is not a known asset kind`);
  }
  return Object.freeze({
    id: asNonEmptyString(asset.id, `${path}.id`),
    kind: kind as CortexAssetKind,
    ...(asset.href === undefined ? {} : { href: asNonEmptyString(asset.href, `${path}.href`) }),
  });
}

function parseEvidence(value: unknown, path: string): CortexEvidenceRef {
  const evidence = asRecord(value, path);
  rejectUnknownKeys(evidence, EVIDENCE_KEYS, path);
  return Object.freeze({
    id: asNonEmptyString(evidence.id, `${path}.id`),
    source: asNonEmptyString(evidence.source, `${path}.source`),
    ...(evidence.href === undefined ? {} : { href: asNonEmptyString(evidence.href, `${path}.href`) }),
    ...(evidence.label === undefined
      ? {}
      : { label: asNonEmptyString(evidence.label, `${path}.label`) }),
  });
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new CortexBundleError(path || "/", `${path || "bundle"} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new CortexBundleError(path, `${path} must be an array`);
  }
  return value;
}

function asNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new CortexBundleError(path, `${path} must be a non-empty string`);
  }
  return value;
}

function asScalar(value: unknown, path: string): string | number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return value;
  throw new CortexBundleError(path, `${path} must be a string or finite number`);
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      const where = path ? `${path}.${key}` : key;
      throw new CortexBundleError(where, `Unknown field '${where}'`);
    }
  }
}
