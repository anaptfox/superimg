import { startTransition, useMemo, useState, ViewTransition } from "react";
import { ARTWORKS, getArtwork } from "./artworks";
import { ArtworkStudio } from "./ArtworkStudio";
import { useReducedMotion } from "./useReducedMotion";

function seedArtworkId(): string {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("artwork");
  if (id && getArtwork(id)) return id;
  return ARTWORKS[0]!.id;
}

function writeArtworkParam(artworkId: string) {
  const params = new URLSearchParams(window.location.search);
  params.set("artwork", artworkId);
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}?${params.toString()}`,
  );
}

export function App() {
  const reducedMotion = useReducedMotion();
  const [artworkId, setArtworkId] = useState(seedArtworkId);
  const artwork = useMemo(
    () => getArtwork(artworkId) ?? ARTWORKS[0]!,
    [artworkId],
  );

  const switchArtwork = (id: string) => {
    if (id === artworkId) return;
    writeArtworkParam(id);
    if (reducedMotion) {
      setArtworkId(id);
    } else {
      startTransition(() => setArtworkId(id));
    }
  };

  return (
    <>
      {ARTWORKS.length > 1 ? (
        <div className="artwork-registry" role="navigation" aria-label="Artworks">
          {ARTWORKS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              data-artwork-id={entry.id}
              aria-pressed={entry.id === artwork.id}
              onClick={() => switchArtwork(entry.id)}
            >
              {entry.meta.title}
            </button>
          ))}
        </div>
      ) : null}
      <ViewTransition
        name="scene-studio-artwork"
        update={reducedMotion ? "none" : "auto"}
      >
        <ArtworkStudio key={artwork.id} artwork={artwork} reducedMotion={reducedMotion} />
      </ViewTransition>
    </>
  );
}
