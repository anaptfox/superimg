import type { ArtworkEdition, ArtworkSurface } from "../kit/artwork";

interface StyleSwitcherProps {
  surfaces: ReadonlyArray<ArtworkSurface>;
  value: string;
  onChange: (value: string) => void;
}

export function StyleSwitcher({ surfaces, value, onChange }: StyleSwitcherProps) {
  return (
    <div className="segmented surface-switcher" aria-label="Rendering surface">
      {surfaces.map((surface) => (
        <button
          key={surface.id}
          type="button"
          aria-pressed={value === surface.id}
          data-renderer-id={surface.id}
          onClick={() => onChange(surface.id)}
        >
          <span className="surface-swatch" style={{ background: surface.swatch }} aria-hidden="true" />
          {surface.label}
        </button>
      ))}
    </div>
  );
}

interface EditionSwitcherProps {
  editions: ReadonlyArray<ArtworkEdition>;
  value: string;
  onChange: (value: string) => void;
}

export function EditionSwitcher({ editions, value, onChange }: EditionSwitcherProps) {
  return (
    <div className="icon-group" aria-label="Artwork edition">
      {editions.map((edition) => (
        <button
          key={edition.id}
          type="button"
          aria-label={edition.label}
          aria-pressed={value === edition.id}
          title={edition.label}
          data-edition-id={edition.id}
          onClick={() => onChange(edition.id)}
        >
          <span aria-hidden="true">{edition.glyph}</span>
        </button>
      ))}
    </div>
  );
}

interface CameraControlsProps {
  onZoomOut: () => void;
  onZoomIn: () => void;
  onRotate: () => void;
  onFocus: () => void;
  onReset: () => void;
}

export function CameraControls({
  onZoomOut,
  onZoomIn,
  onRotate,
  onFocus,
  onReset,
}: CameraControlsProps) {
  const actions = [
    { label: "Zoom out", glyph: "−", action: onZoomOut, testId: "camera-zoom-out" },
    { label: "Zoom in", glyph: "+", action: onZoomIn, testId: "camera-zoom-in" },
    { label: "Rotate camera", glyph: "↺", action: onRotate, testId: "camera-rotate" },
    { label: "Focus selected semantic node", glyph: "◎", action: onFocus, testId: "camera-focus" },
    { label: "Reset camera", glyph: "1:1", action: onReset, testId: "camera-reset" },
  ] as const;

  return (
    <div className="icon-group camera-controls" aria-label="Camera controls">
      {actions.map((item) => (
        <button
          key={item.label}
          type="button"
          aria-label={item.label}
          title={item.label}
          data-testid={item.testId}
          onClick={item.action}
        >
          <span aria-hidden="true">{item.glyph}</span>
        </button>
      ))}
    </div>
  );
}
