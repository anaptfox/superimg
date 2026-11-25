import { Fill, Frame, Image, Text, Video, video } from "@foxworth/superimg";

const embeddedBytes = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

export default video({
  size: { width: 320, height: 180 },
  fps: 10,
  duration: "1s",
  fonts: [{ family: "InstalledFixture", src: __FONT_SOURCE__ }],
  assets: {
    pixel: { type: "image", bytes: __JPEG_BYTES__, mimeType: "image/jpeg", width: 24, height: 24 },
    pixelWebp: { type: "image", bytes: __WEBP_BYTES__, mimeType: "image/webp", width: 24, height: 24 },
    pixelFile: { type: "image", url: "__FILE_URL__" },
    direct: { type: "video", bytes: __VIDEO_BYTES__, mimeType: "video/mp4", width: 64, height: 48, duration: 1 },
  },
  audio: { id: "installed-fixture-tone", src: __WAV_SOURCE__, role: "sfx", duration: "1s" },
  render(ctx) {
    return Frame(
      { width: "fill", height: "fill" },
      Fill({ color: "#101828" }),
      Frame({ x: 12, y: 50, width: 56, height: 56 }, Image({ src: ctx.asset("pixel"), width: 56, height: 56, fit: "fill" })),
      Frame({ x: 80, y: 50, width: 56, height: 56 }, Image({ src: ctx.asset("pixelWebp"), width: 56, height: 56, fit: "fill" })),
      Frame({ x: 148, y: 50, width: 24, height: 24 }, Image({ src: ctx.asset("pixelFile"), width: 24, height: 24, fit: "fill" })),
      Frame({ x: 216, y: 50, width: 64, height: 48 }, Video({ src: ctx.asset("direct"), width: 64, height: 48, fit: "fill", muted: true })),
      Frame({ x: 12, y: 124, width: 296, height: 28 }, Text({ color: "#fff", size: 16, fontFamily: "InstalledFixture" }, "Installed resource check")),
    );
  },
});
