import type { Artwork } from "../kit/artwork";
import { livingCanvasArtwork } from "./living-canvas/artwork";
import { study02Artwork } from "./study-02/artwork";

/** Explicit artwork registry — no glob magic. */
export const ARTWORKS: readonly Artwork[] = [livingCanvasArtwork, study02Artwork];

export function getArtwork(id: string): Artwork | undefined {
  return ARTWORKS.find((a) => a.id === id);
}

export { livingCanvasArtwork };
