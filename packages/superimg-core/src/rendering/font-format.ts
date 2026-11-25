/** Native SVG rasterization accepts SFNT fonts, not WOFF web-font containers. */
export function assertNativeFont(data: Uint8Array): void {
  const signature = data.length >= 4
    ? new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(0)
    : 0;
  if (data.length >= 12 && (
    signature === 0x00010000 || // TrueType
    signature === 0x4f54544f || // OpenType (OTTO)
    signature === 0x74727565 || // Apple TrueType (true)
    signature === 0x74746366 // TrueType/OpenType collection (ttcf)
  )) return;

  const format = signature === 0x774f4646 ? "WOFF"
    : signature === 0x774f4632 ? "WOFF2" : "unrecognized font data";
  throw new TypeError(`Native SVG rendering requires TrueType/OpenType font bytes; received ${format}.`);
}
