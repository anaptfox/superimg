import type { KeyboardEvent } from "react";
import type { ArtworkAct } from "../kit/artwork";

interface StoryRailProps {
  acts: ReadonlyArray<ArtworkAct>;
  active: string;
  onSelect: (id: string) => void;
}

export function StoryRail({ acts, active, onSelect }: StoryRailProps) {
  const activeIndex = acts.findIndex((act) => act.id === active);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = (activeIndex + direction + acts.length) % acts.length;
    const act = acts[next];
    if (act) onSelect(act.id);
  };

  return (
    <div className="story-rail" role="tablist" aria-label="Story states" onKeyDown={handleKeyDown}>
      {acts.map((act) => {
        const selected = act.id === active;
        return (
          <button
            className="story-step"
            data-state-id={act.id}
            key={act.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-current={selected ? "step" : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(act.id)}
          >
            <span className="story-step-number">{act.numeral}</span>
            <span className="story-step-copy">
              <strong>{act.label}</strong>
              <span>{act.note}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
