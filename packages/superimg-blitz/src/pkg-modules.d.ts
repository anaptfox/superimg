declare module "../pkg/superimg_blitz.js" {
  export class BlitzEngine {
    constructor(width: number, height: number);
    rasterizePng(html: string, t: number): Uint8Array;
    rasterizeRgba(html: string, t: number): Uint8Array;
    addFont(family: string, weight: number, italic: boolean, data: Uint8Array): void;
    setHidpi(scale: number): void;
    free(): void;
    readonly width: number;
    readonly height: number;
  }
}
