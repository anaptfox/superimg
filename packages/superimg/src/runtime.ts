//! One shared declaration surface for every `@foxworth/superimg/runtime` condition.

export * from "./runtime.shared.js";

/** Prepare an already-built module closure for trusted Node rendering. */
export declare function prepareNativeSurface(options: import("./runtime.shared.js").NativeSurfacePreparationOptions): Promise<import("./runtime.shared.js").NativeSurfacePreparation>;

export declare function init(
  options?: import("@superimg/types").InitOptions,
): Promise<import("@superimg/types").Runtime>;

export declare function setup(
  options?: import("@superimg/types").SetupOptions,
): Promise<import("@superimg/types").DoctorReport>;

export declare function doctor(): Promise<import("@superimg/types").DoctorReport>;

export declare function check<D>(
  media: import("@superimg/types").MediaValue<D>,
  options?: import("@superimg/types").CheckOptions<D>,
): Promise<import("@superimg/types").CheckReport>;

export declare function inspect<D>(
  media: import("@superimg/types").MediaValue<D>,
  options?: import("@superimg/types").InspectOptions<D>,
): Promise<import("@superimg/types").InspectReport>;

export declare function inspectFile(
  input: import("@superimg/types").MediaInput,
  options?: import("@superimg/types").MediaInspectOptions,
): Promise<import("@superimg/types").MediaInspection>;

export declare function render<D>(
  media: import("@superimg/types").ExportableMedia<D>,
  options: import("@superimg/types").MediaRenderOptions<D>,
): Promise<import("@superimg/types").MediaRenderResult>;

export declare function renderResponse<D>(
  media: import("@superimg/types").ExportableMedia<D>,
  options: import("@superimg/types").MediaRenderOptions<D> & { readonly headers?: HeadersInit },
): Promise<Response>;

export declare function exportMedia<D>(
  media: import("@superimg/types").ExportableMedia<D>,
  options: import("@superimg/types").ExportOptions<D>,
): Promise<import("@superimg/types").ExportBundle>;

export declare function startExport<D>(
  media: import("@superimg/types").ExportableMedia<D>,
  options: import("@superimg/types").ExportOptions<D>,
): import("@superimg/types").PausableJob<import("@superimg/types").ExportBundle>;

export declare function startConversion(
  request: import("@superimg/types").ConversionRequest,
  options?: { readonly runtime?: import("@superimg/types").Runtime },
): import("@superimg/types").PausableJob<import("@superimg/types").ConversionArtifact>;

export declare function shutdown(): Promise<void>;
