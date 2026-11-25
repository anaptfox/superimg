import type { InteractiveDefinition, SceneCameraPatch, SceneStyleRenderer } from "@foxworth/superimg/interactive/define";

export interface ArtworkAct<TActId extends string = string> {
  id: TActId;
  numeral: string;
  label: string;
  note: string;
  focus: string;
}

export interface ArtworkSurface<TSurfaceId extends string = string> {
  id: TSurfaceId;
  label: string;
  swatch: string;
}

export interface ArtworkRoleFilter {
  role: string;
  label: string;
}

export interface ArtworkEdition {
  id: string;
  label: string;
  glyph: string;
  width: number;
  height: number;
}

export interface ArtworkMeta {
  title: string;
  eyebrow: string;
  synopsis: string;
  description: string;
}

export interface Artwork<
  TActId extends string = string,
  TSurfaceId extends string = string,
> {
  id: string;
  /** Singular interactive definition; collections are intentionally unsupported. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  template: InteractiveDefinition<any>;
  renderer: SceneStyleRenderer;
  acts: ReadonlyArray<ArtworkAct<TActId>>;
  surfaces: ReadonlyArray<ArtworkSurface<TSurfaceId>>;
  roleFilters: ReadonlyArray<ArtworkRoleFilter>;
  defaultSurface: TSurfaceId;
  editions: ReadonlyArray<ArtworkEdition>;
  defaultEdition: string;
  resetCamera: SceneCameraPatch;
  /** CSS profile map for contract CSS-var parity (optional). */
  surfaceCss?: Readonly<Record<string, string>>;
  /** Node ids every act state must set (optional; contract can derive). */
  requiredNodes?: readonly string[];
  exclusiveParent?: string;
  meta: ArtworkMeta;
}

export function defineArtwork<
  TActId extends string,
  TSurfaceId extends string,
>(artwork: Artwork<TActId, TSurfaceId>): Artwork<TActId, TSurfaceId> {
  return artwork;
}
