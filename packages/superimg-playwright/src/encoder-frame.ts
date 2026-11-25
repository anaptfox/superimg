import sharp, { type Sharp } from "sharp";

/** Byte arrays (including Buffers) are encoded screenshots. Raw pixels declare their layout explicitly. */
export type CapturedFrame = Uint8Array | RawRgbaFrame;

export interface RawRgbaFrame {
  readonly kind: "rgba";
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
  /** Bytes between row starts; defaults to width * 4. */
  readonly stride?: number;
}

export function validateFrameSize(width: number, height: number): void {
  if (!Number.isSafeInteger(width) || width <= 0
    || !Number.isSafeInteger(height) || height <= 0
    || !Number.isSafeInteger(width * height * 4)) {
    throw new TypeError("Encoder frame dimensions must be positive safe integers");
  }
}

/** Decode and normalize one capture into tightly packed, coded-size 8-bit RGBA. */
export async function decodeEncoderFrame(frame: CapturedFrame, width: number, height: number): Promise<Buffer> {
  validateFrameSize(width, height);
  let pipeline: Sharp;
  let capturedWidth: number;
  let capturedHeight: number;

  if (frame instanceof Uint8Array) {
    pipeline = sharp(Buffer.from(frame.buffer, frame.byteOffset, frame.byteLength), { failOn: "error" });
    const metadata = await pipeline.metadata();
    if (!metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1) {
      throw new TypeError("Encoder input must contain exactly one image with known dimensions");
    }
    capturedWidth = metadata.width;
    capturedHeight = metadata.height;
    validateFrameSize(capturedWidth, capturedHeight);
  } else {
    if (frame?.kind !== "rgba" || !(frame.data instanceof Uint8Array)) {
      throw new TypeError("Raw encoder input must declare kind: 'rgba', data, width, and height");
    }
    capturedWidth = frame.width;
    capturedHeight = frame.height;
    validateFrameSize(capturedWidth, capturedHeight);
    const rowBytes = capturedWidth * 4;
    const stride = frame.stride ?? rowBytes;
    if (!Number.isSafeInteger(stride) || stride < rowBytes
      || !Number.isSafeInteger(stride * capturedHeight)
      || frame.data.byteLength !== stride * capturedHeight) {
      throw new TypeError("Raw RGBA buffer length and stride must match its declared dimensions");
    }
    const bytes = Buffer.from(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength);
    const packed = stride === rowBytes ? bytes : Buffer.allocUnsafe(rowBytes * capturedHeight);
    if (stride !== rowBytes) {
      for (let row = 0; row < capturedHeight; row++) {
        bytes.copy(packed, row * rowBytes, row * stride, row * stride + rowBytes);
      }
    }
    if (capturedWidth === width && capturedHeight === height) return packed;
    pipeline = sharp(packed, { raw: { width: capturedWidth, height: capturedHeight, channels: 4 } });
  }

  if (capturedWidth !== width || capturedHeight !== height) {
    // Capture density is independent of delivery size. Never reinterpret the source stride.
    pipeline = pipeline.resize(width, height, { fit: "fill", kernel: "lanczos3" });
  }
  const { data, info } = await pipeline.toColourspace("srgb").ensureAlpha().raw({ depth: "uchar" })
    .toBuffer({ resolveWithObject: true });
  if (info.width !== width || info.height !== height || info.channels !== 4
    || data.byteLength !== width * height * 4) {
    throw new Error("Decoded encoder frame did not match its coded RGBA dimensions");
  }
  return data;
}
