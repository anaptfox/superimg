declare module "path-data-parser" {
  export interface Segment {
    key: string;
    data: number[];
  }

  export function parsePath(d: string): Segment[];
  export function absolutize(segments: Segment[]): Segment[];
  export function normalize(segments: Segment[]): Segment[];
}