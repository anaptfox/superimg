//! Schema-0 coordinates shared by planning, execution, events, and manifests.
//! Responsive art direction is authored as `MediaDefinition.editions`; delivery
//! renditions are requested later and never enter render context.

import type { EncodingOptions, OutputFormat } from "./encoding-types.js";

export interface MediaCoordinates {
  sourceId: string;
  entryId?: string;
  variantId: string;
  editionId: string;
}

export interface RenditionCoordinates extends MediaCoordinates {
  renditionId: string;
}

export interface RenditionRequest {
  id: string;
  format: OutputFormat;
  width: number;
  height: number;
  encoding?: Omit<EncodingOptions, "format">;
}

export interface RenditionPlan {
  schemaVersion: 0;
  sourceId: string;
  entryIds?: readonly string[];
  variantIds?: readonly string[];
  editionIds?: readonly string[];
  renditions: readonly RenditionRequest[];
}

export interface CompiledMediaFile {
  relativePath: string;
  mimeType: string;
  width: number;
  height: number;
  byteLength: number;
  sha256: string;
}

export interface CompiledMediaRendition extends CompiledMediaFile {
  coordinates: RenditionCoordinates;
  format: OutputFormat;
  encoder: string;
}
