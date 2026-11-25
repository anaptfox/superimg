import type { CanvasSize, ResolveCueFinding } from "@superimg/types";
import type { TimedShot } from "./clock.js";
import { leavesCanvas, paintedBounds } from "./measure.js";
import type { Series, ShotArt } from "./types.js";

export function scriptFindings(
  shots: readonly TimedShot[],
  /** How many shot modules export each name (or a ShotResolver's presence check). */
  hasShotCount: (id: string) => number,
  speakers: ReadonlySet<string>,
  series: Pick<Series, "bubbleLimits" | "glyphs" | "bubbleShowsName" | "card">,
  title: string,
  castLabels: ReadonlyMap<string, string> = new Map(),
) {
  const findings: ResolveCueFinding[] = [];
  const add = (id: string, code: string, message: string) => findings.push({ id, code, message });
  const { glyphs } = series;
  for (const shot of shots) {
    if (shot.id) {
      const count = hasShotCount(shot.id);
      if (count === 0) add(shot.id, "UNPLACED_SHOT", `No module exports shot "${shot.id}".`);
      else if (count > 1) add(shot.id, "DUPLICATE_SHOT", `${count} modules export shot "${shot.id}"; the first is used.`);
    }
    for (const { block } of shot.lines) {
      if (!block.id) continue;
      const lettering = [...block.lines];
      if (block.kind === "speech") {
        const speakerKey = block.who.toLowerCase();
        if (!speakers.has(speakerKey)) {
          add(block.id, "UNKNOWN_SPEAKER", `"${block.who}" is absent from the series cast.`);
        }
        const limits = series.bubbleLimits;
        if (limits && (block.lines.length > limits.lines || block.lines.some(line => line.length > limits.chars))) {
          add(block.id, "BUBBLE_TOO_LONG", `A bubble can show at most ${limits.lines} lines of ${limits.chars} characters.`);
        }
        if (series.bubbleShowsName !== false) {
          const displayName = castLabels.get(speakerKey) ?? block.who.toUpperCase();
          if (displayName) lettering.push(displayName);
        }
      } else {
        if (!series.card) add(block.id, "NO_CARD_PAINTER", "The script has a card, but the series has no card painter.");
        for (const text of [block.attribution, block.sign, block.source]) if (text) lettering.push(text);
      }
      if (glyphs && lettering.some(text => !glyphs(text))) {
        add(block.id, "MISSING_GLYPH", "The series is missing lettering for this block.");
      }
    }
  }
  const first = shots[0];
  if (first?.id && title && glyphs && !glyphs(title)) {
    add(first.id, "MISSING_GLYPH", "The series is missing lettering for the film title.");
  }
  return findings;
}

/**
 * Measure what a bubble paints at one still. A bubble may be clamped on screen
 * for a speaker who is off frame, so the head is not judged; only the paint is.
 */
export function bubbleFinding(art: ShotArt, screen: CanvasSize) {
  const { box, unparseable } = paintedBounds(art);
  if (unparseable) return "BUBBLE_UNPARSEABLE" as const;
  return leavesCanvas(box, screen) ? "BUBBLE_OFF_CANVAS" as const : undefined;
}
