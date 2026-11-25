import {
  isMediaElement,
  type CanvasSize,
  type MediaChild,
  type MediaElement,
  type ResolveCueFinding,
  type ResolveFn,
} from "@superimg/types";
import { subjectOf, type SubjectTag } from "./cast.js";
import { EPSILON, type TimedShot } from "./clock.js";
import { clamp } from "./math.js";
import { extractSvgSubjectsAndHeads } from "./measure.js";
import type { ContinuityOptions, FilmBreakdown, ShotContext, ShotLine, ShotResult } from "./types.js";

/** Global symbol attached to `film()` definitions so `filmBreakdown(media)` works purely. */
export const FILM_BREAKDOWN = Symbol.for("superimg.film.breakdown");

type BreakdownCarrier<Data = unknown> = {
  sample?: Data;
  config?: Record<string, unknown>;
  resolve?: ResolveFn<Data>;
  [FILM_BREAKDOWN]?: (data?: Data) => FilmBreakdown;
};

const ascii = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function parseOpacity(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return undefined;
}

function ownOpacity(node: MediaElement): number {
  const props = node.props as Record<string, unknown>;
  if (props.display === "none" || props.visibility === "hidden") return 0;

  let opacity = 1;
  const direct = parseOpacity(props.opacity);
  if (direct !== undefined) opacity *= direct;

  const style = props.style;
  if (style && typeof style === "object" && !Array.isArray(style)) {
    const record = style as Record<string, unknown>;
    if (record.display === "none" || record.visibility === "hidden") return 0;
    const styleOpacity = parseOpacity(record.opacity);
    if (styleOpacity !== undefined) opacity *= styleOpacity;
  }

  const motion = props.motion;
  if (motion && typeof motion === "object" && !Array.isArray(motion)) {
    const motionOpacity = parseOpacity((motion as Record<string, unknown>).opacity);
    if (motionOpacity !== undefined) opacity *= motionOpacity;
  }

  return opacity;
}

function collectElements(children: readonly MediaChild[], out: MediaElement[] = []): MediaElement[] {
  for (const child of children) {
    if (Array.isArray(child)) {
      collectElements(child, out);
    } else if (isMediaElement(child)) {
      out.push(child);
    }
  }
  return out;
}

function hasVisibleContent(node: MediaElement, effectiveOpacity: number): boolean {
  if (effectiveOpacity <= 0) return false;
  const raw = (node.children as readonly unknown[]).flat(Infinity);
  // A group that draws nothing is not on screen; any other leaf is.
  if (raw.length === 0) return node.type !== "VectorGroup";
  const children = collectElements(node.children);
  // Text or other non-element children paint on their own.
  if (children.length < raw.length) return true;
  return children.some((child) => hasVisibleContent(child, effectiveOpacity * ownOpacity(child)));
}

function readSemantic(node: MediaElement): SubjectTag | undefined {
  return subjectOf(node);
}

function extractSubjects(
  art: readonly MediaChild[],
  cast: Map<string, string>,
  props: Map<string, string>,
  parentOpacity = 1,
) {
  for (const child of art) {
    if (Array.isArray(child)) {
      extractSubjects(child, cast, props, parentOpacity);
      continue;
    }
    if (!isMediaElement(child)) continue;
    const effective = parentOpacity * ownOpacity(child);
    if (effective <= 0) continue;

    const semantic = readSemantic(child);
    if (semantic && hasVisibleContent(child, effective)) {
      const target = semantic.kind === "cast" ? cast : props;
      const key = semantic.id.toLowerCase();
      if (!target.has(key)) target.set(key, semantic.id);
    }

    if (child.children.length > 0) {
      extractSubjects(child.children, cast, props, effective);
    }
  }
}

/** Eighths of the shot, its still, and the middle of each line, so a brief appearance is not missed. */
const SAMPLE_STEPS = 8;

function sampleTimes(shot: TimedShot): number[] {
  const raw = [
    clamp(shot.still, 0, shot.duration),
    ...Array.from({ length: SAMPLE_STEPS + 1 }, (_, step) => (shot.duration * step) / SAMPLE_STEPS),
    ...shot.lines.map((line) => clamp((line.start + line.end) / 2, 0, shot.duration)),
  ];
  const unique: number[] = [];
  for (const t of raw) {
    if (!unique.some((existing) => Math.abs(existing - t) <= EPSILON)) {
      unique.push(t);
    }
  }
  return unique;
}

export function computeBreakdown<Data>(
  shots: readonly TimedShot[],
  resolveShot: (id: string, ctx: ShotContext<Data>) => ShotResult | undefined,
  hasShot: (id: string) => boolean,
  lineViews: ReadonlyMap<TimedShot, readonly ShotLine[]>,
  knownCast: ReadonlyMap<string, string>,
  screen: CanvasSize,
  data: Data,
): FilmBreakdown {
  const breakdown: FilmBreakdown = {};
  for (const shot of shots) {
    if (!shot.id) continue;
    const cast = new Map<string, string>();
    const props = new Map<string, string>();
    if (hasShot(shot.id)) {
      const lines = lineViews.get(shot) ?? [];
      for (const t of sampleTimes(shot)) {
        // The breakdown is advisory: a drawer that fails at a time the renderer
        // never visits must not break resolve() for a film that renders fine.
        let result: ShotResult | undefined;
        try {
          result = resolveShot(shot.id, {
            id: shot.id,
            t: t + shot.in,
            u: shot.duration > 0 ? clamp(t / shot.duration) : 1,
            duration: shot.duration,
            screen,
            text: shot.text,
            section: shot.section,
            fields: shot.fields,
            lines,
            data,
          });
        } catch {
          continue;
        }
        if (result === undefined || result === null) continue;
        const { art, heads, props: explicitProps } = typeof result === "string" || Array.isArray(result)
          ? { art: result, heads: undefined, props: undefined }
          : result;
        if (Array.isArray(art)) {
          extractSubjects(art, cast, props);
        } else if (typeof art === "string") {
          const extracted = extractSvgSubjectsAndHeads(art);
          for (const [key, name] of extracted.cast) {
            if (!cast.has(key)) cast.set(key, knownCast.get(key) ?? name);
          }
          for (const [key, name] of extracted.props) {
            if (!props.has(key)) props.set(key, name);
          }
        }
        if (explicitProps) {
          for (const name of explicitProps) {
            const trimmed = name.trim();
            if (!trimmed) continue;
            const key = trimmed.toLowerCase();
            if (!props.has(key)) props.set(key, trimmed);
          }
        }
        if (heads) {
          for (const name of Object.keys(heads)) {
            const trimmed = name.trim();
            if (!trimmed) continue;
            const key = trimmed.toLowerCase();
            if (!cast.has(key)) cast.set(key, knownCast.get(key) ?? trimmed);
          }
        }
      }
    }
    breakdown[shot.id] = {
      cast: [...cast.values()].sort(ascii),
      props: [...props.values()].sort(ascii),
    };
  }
  return breakdown;
}

/**
 * Pure helper that returns the per-shot subject breakdown (`cast` and `props`)
 * for a media definition produced by `film()`.
 */
export function filmBreakdown<Data = unknown>(media: unknown, data?: Data): FilmBreakdown {
  if (!media || typeof media !== "object") return {};
  const carrier = media as BreakdownCarrier<Data>;
  const attached = carrier[FILM_BREAKDOWN];
  if (typeof attached === "function") {
    return attached(data);
  }
  if (typeof carrier.resolve === "function") {
    const result = carrier.resolve({
      data: (data ?? carrier.sample ?? {}) as Data,
      config: (carrier.config ?? {}) as never,
      asset: (file) => file,
      assets: {},
    });
    if (result && typeof result === "object" && !("then" in result) && result.breakdown) {
      return result.breakdown;
    }
  }
  return {};
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Case-insensitive word matcher with `-`/space equivalence
 * (e.g. `"cinnamon-jar"` matches `"cinnamon jar"` and `"CINNAMON-JAR"`,
 * without matching `"jar"` inside `"ajar"`).
 */
export function subjectMentionPattern(name: string): RegExp {
  const tokens = name.trim().split(/[-\s]+/).filter(Boolean);
  const body = tokens.map(escapeRegex).join("[-\\s]+");
  return new RegExp(`(?<![a-z0-9])${body}(?![a-z0-9])`, "i");
}

/**
 * Continuity supervisor checks derived solely from the script and shot breakdown:
 * - `PROP_NOT_PLANTED`: a known prop named in a later shot's speech lines or
 *   shot description when it never appeared in an earlier shot; or (when
 *   `continuity.replantAfter` is set) a prop that reappears after being absent
 *   for N or more shots.
 * - `CAST_UNMET`: when `continuity.introductions` is true, a speaker addresses
 *   or speaks in a shot with a cast member they have never shared an earlier
 *   shot with.
 */
export function continuityFindings(
  shots: readonly TimedShot[],
  breakdown: FilmBreakdown,
  knownCast: ReadonlyMap<string, string>,
  continuity?: ContinuityOptions,
): ResolveCueFinding[] {
  const findings: ResolveCueFinding[] = [];
  const placedShots = shots.filter((shot): shot is TimedShot & { id: string } => Boolean(shot.id));

  // Universe of known props across the film's breakdown.
  const allProps = new Map<string, string>();
  for (const shot of placedShots) {
    for (const propName of breakdown[shot.id]?.props ?? []) {
      const key = propName.toLowerCase();
      if (!allProps.has(key)) allProps.set(key, propName);
    }
  }

  const propPatterns = new Map<string, RegExp>();
  for (const [key, propName] of allProps) {
    propPatterns.set(key, subjectMentionPattern(propName));
  }

  const replantAfter =
    typeof continuity?.replantAfter === "number" &&
    Number.isFinite(continuity.replantAfter) &&
    continuity.replantAfter > 0
      ? continuity.replantAfter
      : undefined;

  const firstSeenProp = new Map<string, { index: number; shotId: string }>();
  const lastSeenProp = new Map<string, { index: number; shotId: string }>();

  for (const [index, shot] of placedShots.entries()) {
    const shotBreakdown = breakdown[shot.id] ?? { cast: [], props: [] };
    const flaggedProps = new Set<string>();

    if (index > 0 && allProps.size > 0) {
      const spokenText = shot.lines
        .filter((line) => line.block.kind === "speech")
        .map((line) => line.block.lines.join(" "))
        .join("\n");
      const combinedText = [shot.text, spokenText].filter(Boolean).join("\n");

      if (combinedText) {
        for (const [key, propName] of allProps) {
          if (firstSeenProp.has(key)) continue;
          const pattern = propPatterns.get(key)!;
          if (pattern.test(combinedText)) {
            flaggedProps.add(key);
            findings.push({
              id: shot.id,
              code: "PROP_NOT_PLANTED",
              message: `Prop "${propName}" is named in shot "${shot.id}" without appearing in an earlier shot.`,
            });
          }
        }
      }
    }

    if (replantAfter !== undefined) {
      for (const propName of shotBreakdown.props) {
        const key = propName.toLowerCase();
        const prev = lastSeenProp.get(key);
        if (!prev || flaggedProps.has(key)) continue;
        const absent = index - prev.index - 1;
        if (absent >= replantAfter) {
          flaggedProps.add(key);
          findings.push({
            id: shot.id,
            code: "PROP_NOT_PLANTED",
            message: `Prop "${propName}" appears in shot "${shot.id}" after being absent for ${absent} ${absent === 1 ? "shot" : "shots"} (last seen in "${prev.shotId}").`,
          });
        }
      }
    }

    for (const propName of shotBreakdown.props) {
      const key = propName.toLowerCase();
      const seen = { index, shotId: shot.id };
      if (!firstSeenProp.has(key)) firstSeenProp.set(key, seen);
      lastSeenProp.set(key, seen);
    }
  }

  if (continuity?.introductions === true) {
    const allCast = new Map<string, string>(knownCast);
    for (const shot of placedShots) {
      for (const castMember of breakdown[shot.id]?.cast ?? []) {
        const key = castMember.toLowerCase();
        if (!allCast.has(key)) allCast.set(key, castMember);
      }
    }

    const castPatterns = new Map<string, RegExp>();
    for (const [key, name] of allCast) {
      castPatterns.set(key, subjectMentionPattern(name));
    }

    const sharedWith = new Map<string, Set<string>>();
    const haveShared = (a: string, b: string) => sharedWith.get(a)?.has(b) === true;
    const recordShared = (a: string, b: string) => {
      if (!sharedWith.has(a)) sharedWith.set(a, new Set());
      if (!sharedWith.has(b)) sharedWith.set(b, new Set());
      sharedWith.get(a)!.add(b);
      sharedWith.get(b)!.add(a);
    };

    for (const shot of placedShots) {
      const presentCast = new Map<string, string>();
      for (const member of breakdown[shot.id]?.cast ?? []) {
        const key = member.toLowerCase();
        if (!presentCast.has(key)) presentCast.set(key, allCast.get(key) ?? member);
      }

      const flaggedPairs = new Set<string>();
      for (const line of shot.lines) {
        if (line.block.kind !== "speech") continue;
        const speakerKey = line.block.who.trim().toLowerCase();
        if (!speakerKey) continue;
        const speakerName = allCast.get(speakerKey) ?? line.block.who;
        const findingId = line.block.id ?? shot.id;

        for (const [otherKey, otherName] of presentCast) {
          if (otherKey === speakerKey || haveShared(speakerKey, otherKey)) continue;
          const pairKey = `${speakerKey}\0${otherKey}`;
          if (flaggedPairs.has(pairKey)) continue;
          flaggedPairs.add(pairKey);
          findings.push({
            id: findingId,
            code: "CAST_UNMET",
            message: `"${speakerName}" speaks in shot "${shot.id}" with "${otherName}", who they have not shared an earlier shot with.`,
          });
        }

        const spoken = line.block.lines.join(" ");
        if (spoken) {
          for (const [otherKey, otherName] of allCast) {
            if (otherKey === speakerKey || haveShared(speakerKey, otherKey)) continue;
            const pairKey = `${speakerKey}\0${otherKey}`;
            if (flaggedPairs.has(pairKey)) continue;
            if (castPatterns.get(otherKey)!.test(spoken)) {
              flaggedPairs.add(pairKey);
              findings.push({
                id: findingId,
                code: "CAST_UNMET",
                message: `"${speakerName}" addresses "${otherName}" in shot "${shot.id}", who they have not shared an earlier shot with.`,
              });
            }
          }
        }
      }

      const keys = [...presentCast.keys()];
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          recordShared(keys[i]!, keys[j]!);
        }
      }
    }
  }

  return findings;
}
