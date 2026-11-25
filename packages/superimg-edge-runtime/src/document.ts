import {
  createEdgeRuntimeAdapterBase,
  type EdgeRuntimeAdapterOptions,
} from "./adapter-base.js";

export type EdgeDocumentRuntimeAdapterOptions = Pick<
  EdgeRuntimeAdapterOptions,
  "fetch" | "defaultFonts"
>;

/** Create the document-only edge adapter without linking any rasterizer code. */
export function createEdgeDocumentRuntimeAdapter(
  options: EdgeDocumentRuntimeAdapterOptions = {},
) {
  return createEdgeRuntimeAdapterBase(options);
}
