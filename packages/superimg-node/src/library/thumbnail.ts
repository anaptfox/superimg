/** Host-decoded tight RGBA input and owned thumbnail bytes. */
export type DecodedRaster = Readonly<{
  width: number;
  height: number;
  /** Tight RGBA, length `width * height * 4`. */
  rgba: Uint8Array;
}>;

export function scaleRaster(source: DecodedRaster, maxWidth: number): DecodedRaster {
  if (maxWidth < 1) {
    throw new RangeError("maxWidth must be at least 1");
  }
  if (source.width < 1 || source.height < 1) {
    throw new RangeError("source raster must have positive dimensions");
  }
  const width = Math.min(maxWidth, source.width);
  const height = Math.max(1, Math.round((source.height * width) / source.width));
  if (width === source.width && height === source.height) {
    return source;
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const srcY = Math.min(source.height - 1, Math.floor((y * source.height) / height));
    for (let x = 0; x < width; x += 1) {
      const srcX = Math.min(source.width - 1, Math.floor((x * source.width) / width));
      const src = (srcY * source.width + srcX) * 4;
      const dst = (y * width + x) * 4;
      rgba[dst] = source.rgba[src]!;
      rgba[dst + 1] = source.rgba[src + 1]!;
      rgba[dst + 2] = source.rgba[src + 2]!;
      rgba[dst + 3] = source.rgba[src + 3]!;
    }
  }
  return Object.freeze({ width, height, rgba });
}

export function encodeRasterBytes(raster: DecodedRaster): Uint8Array {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(raster.width, 0);
  header.writeUInt32BE(raster.height, 4);
  return Buffer.concat([header, Buffer.from(raster.rgba)]);
}

export function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export function base64ToBytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64"));
}

/** Resize and encode the host-decoded raster without publishing it. */
export function createThumbnail(source: DecodedRaster, maxWidth: number): Readonly<{ raster: DecodedRaster; bytes: Uint8Array }> {
  const raster = scaleRaster(source, maxWidth);
  return Object.freeze({ raster, bytes: encodeRasterBytes(raster) });
}
