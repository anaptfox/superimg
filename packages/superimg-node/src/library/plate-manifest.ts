export const PLATE_SCHEMA = 0 as const;
export const PLATE_MAX_FRAMES = 200;
export const PLATE_MAX_SECONDS = 6;
export const PLATE_MAX_WIDTH = 960;
export const PLATE_COLUMNS = 8;

export interface PlateManifest {
  schemaVersion: typeof PLATE_SCHEMA;
  name: string;
  strategy: "atlas";
  source: {
    width: number;
    height: number;
    fps: number;
    durationSeconds: number;
    totalFrames: number;
  };
  compiled: {
    fps: number;
    totalFrames: number;
    width: number;
    height: number;
  };
  atlas: {
    tileWidth: number;
    tileHeight: number;
    columns: number;
    rows: number;
    sheets: Array<{ file: string; startFrame: number; frameCount: number }>;
  };
  compiledAt: string;
  toolVersion: string;
}

export function assertPlateBudget(frames: number, durationSeconds: number): void {
  if (frames > PLATE_MAX_FRAMES || durationSeconds > PLATE_MAX_SECONDS) {
    throw new Error(
      `PLATE_TOO_LONG: ${frames} frames / ${durationSeconds.toFixed(2)}s. Shorten the clip to ≤${PLATE_MAX_SECONDS}s and ≤${PLATE_MAX_FRAMES} frames, or split it. Then: superimg plate <file>`,
    );
  }
}

export function atlasGrid(frameCount: number, columns = PLATE_COLUMNS): { columns: number; rows: number } {
  const cols = Math.min(columns, Math.max(frameCount, 1));
  const rows = Math.ceil(frameCount / cols);
  return { columns: cols, rows };
}
