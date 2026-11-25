//! Host-admitted native graphics module contract. Modules are prepared by
//! the host; functions are never serialized into a media artifact.

export interface NativeSurfaceHost {
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
  readonly signal: AbortSignal;
  /** Host-prepared resource URLs, keyed by declared resource name. */
  readonly assets: Readonly<Record<string, string>>;
}

export interface NativeSurfaceFrame<Data> {
  /** Absolute scene-local time in seconds. */
  readonly seconds: number;
  readonly data: Data;
}

export interface NativeSurfaceInstance<Data> {
  sample(frame: NativeSurfaceFrame<Data>): void | Promise<void>;
  dispose(): void | Promise<void>;
}

/** An ordinary browser module exports a value satisfying this interface. */
export interface NativeSurfaceModule<Data> {
  create(host: NativeSurfaceHost): NativeSurfaceInstance<Data> | Promise<NativeSurfaceInstance<Data>>;
}
