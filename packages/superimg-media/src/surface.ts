export type MediaSurfaceKind = "dom";

export interface MediaSurface {
  kind: MediaSurfaceKind;
  getElement(): HTMLElement | null;
}

export interface MediaSurfaceMountOptions {
  surface?: MediaSurfaceKind;
}

export class DomMediaSurface implements MediaSurface {
  readonly kind = "dom";

  constructor(private readonly resolveElement: () => HTMLElement | null) {}

  getElement(): HTMLElement | null {
    return this.resolveElement();
  }
}
