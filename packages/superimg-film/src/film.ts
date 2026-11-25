import { filmScript, parseScript, scriptBlocks, type ScriptDocument } from "@foxworth/superimg-script";
import { getSafeBox } from "@superimg/stdlib/safe-area";
import { Fill, Frame, Html, Stack, Vector, vector } from "@superimg/stdlib/tree";
import {
  video,
  type AudioClip,
  type AudioMixOptions,
  type AudioTimeline,
  type AudioValue,
  type CanvasSize,
  type MediaEdition,
  type NarrationPlan,
  type RenderContext,
  type ResolveCueFinding,
  type VideoDefinition,
} from "@superimg/types";
import { FILM_BREAKDOWN, computeBreakdown, continuityFindings } from "./breakdown.js";
import { castLabel, castMeta, castName } from "./cast.js";
import { extractFocusPoint, projectRect, projectShot, viewport } from "./camera.js";
import { EPSILON, clock, publishedDuration, quantize, shotAt, type TimedShot } from "./clock.js";
import { bubbleFinding, scriptFindings } from "./findings.js";
import { clamp, span } from "./math.js";
import { extractSvgSubjectsAndHeads, paintedBounds } from "./measure.js";
import type {
  BubbleInput,
  CardBlock,
  CastMember,
  FilmAudioOptions,
  FilmCardMark,
  FilmEdition,
  FilmFit,
  FilmInspection,
  FilmMarks,
  FilmOptions,
  FilmSafeArea,
  FilmScriptInput,
  FilmShotMark,
  FilmSpeechMark,
  Point,
  Rect,
  ScriptBlock,
  ScriptModule,
  Series,
  Shot,
  ShotArt,
  ShotContext,
  ShotLine,
  ShotResolver,
  ShotResult,
  ShotsSource,
  ShotTransition,
  SpeechBlock,
} from "./types.js";

/** Global symbol attached to `film()` definitions so `filmMarks(media)` works purely. */
export const FILM_MARKS = Symbol.for("superimg.film.marks");

const DEFAULT_SIZE = { width: 1080, height: 1920 };
const viewBox = ({ width, height }: CanvasSize) => ({ x: 0, y: 0, width, height });

function svg(
  body: string,
  { width, height }: CanvasSize,
  slice = false,
  shapeRendering: Series["shapeRendering"] = "crispEdges",
) {
  const rendering = shapeRendering === "auto" ? "" : ` shape-rendering="${shapeRendering}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%"${slice ? ' preserveAspectRatio="xMidYMid slice"' : ""}${rendering} style="display:block">${body}</svg>`;
}

// A film shorter than the fade starts it at zero rather than already faded.
function fadeMarkup(t: number, duration: number, { width, height }: CanvasSize, color: string) {
  const opacity = span(t, Math.max(0, duration - 0.7), duration - 0.1);
  return opacity <= 0 ? "" : `<rect x="0" y="0" width="${width}" height="${height}" fill="${color}"${opacity < 1 ? ` opacity="${opacity.toFixed(3)}"` : ""}/>`;
}

function overlays(
  parts: readonly ShotArt[],
  screen: CanvasSize,
  initialId: string,
  shapeRendering: Series["shapeRendering"],
) {
  const layers: (ReturnType<typeof Vector> | ReturnType<typeof Html>)[] = [];
  let markup = "";
  const id = () => layers.length === 0 ? initialId : `${initialId}-${layers.length}`;
  function flush() {
    if (!markup) return;
    layers.push(Html({ id: id(), ...screen, x: 0, y: 0, html: svg(markup, screen, false, shapeRendering) }));
    markup = "";
  }
  for (const part of parts) {
    if (typeof part === "string") markup += part;
    else if (part.length) {
      flush();
      layers.push(Vector({ id: id(), ...screen, viewBox: viewBox(screen) }, ...part));
    }
  }
  flush();
  return layers;
}

function renderFilm(
  art: ShotArt,
  parts: readonly ShotArt[],
  series: Pick<FrameOverrides, "stage" | "background" | "shapeRendering">,
  screen: CanvasSize,
  fit: FilmFit,
  vp: { scale: number; x: number; y: number },
) {
  const shapeRendering = series.shapeRendering ?? "crispEdges";
  if (typeof art === "string") {
    const { scale, x, y } = vp;
    const placed = scale === 1 && x === 0 && y === 0 ? art : `<g transform="translate(${x} ${y}) scale(${scale})">${art}</g>`;
    // A contained stage leaves bars, and the series background fills them.
    const bars = fit === "contain" && (x > 0 || y > 0) && series.background;
    const world = bars ? `<rect x="0" y="0" width="${screen.width}" height="${screen.height}" fill="${series.background}"/>${placed}` : placed;
    if (parts.every(part => typeof part === "string")) {
      return Stack({ width: "fill", height: "fill" },
        Html({ id: "scene", width: "fill", height: "fill", html: svg(world + parts.join(""), screen, fit === "cover" || fit === "focus", shapeRendering) }));
    }
    return Stack({ width: "fill", height: "fill" },
      Frame(screen, ...overlays([world, ...parts], screen, "scene", shapeRendering)));
  }
  // Omit any empty Html overlay so pure-Vector films stay on the SVG raster fast lane.
  const lettering = overlays(parts, screen, "fable-lettering", shapeRendering);
  const stageNode = fit === "focus"
    ? Vector(
        { id: "stage", ...screen, viewBox: viewBox(screen) },
        vector.group({ transform: { x: vp.x, y: vp.y, scale: vp.scale } }, ...art),
      )
    : Vector({ id: "stage", ...screen, viewBox: viewBox(series.stage), ...(fit === "cover" ? { fit } : {}) }, ...art);
  return Frame(screen,
    Fill({ color: series.background ?? "#000" }),
    stageNode,
    ...lettering);
}

function resolveSafeBox(screen: CanvasSize, safeArea?: FilmSafeArea): Rect {
  if (safeArea === undefined) {
    return { x: 0, y: 0, width: screen.width, height: screen.height };
  }
  if (typeof safeArea === "string") {
    return getSafeBox(screen.width, screen.height, safeArea);
  }
  return {
    x: safeArea.left,
    y: safeArea.top,
    width: Math.max(0, screen.width - safeArea.left - safeArea.right),
    height: Math.max(0, screen.height - safeArea.top - safeArea.bottom),
  };
}

function bubbleInput(
  line: TimedShot["lines"][number],
  block: SpeechBlock,
  t: number,
  head: Point,
  screen: CanvasSize,
  safeBox: Rect,
  occupied: readonly Rect[],
  avoid: readonly Rect[],
  castLabels: ReadonlyMap<string, string>,
  castMetas: ReadonlyMap<string, Readonly<Record<string, unknown>>>,
): BubbleInput {
  const { start, typed, end, index } = line;
  const key = block.who.toLowerCase();
  const meta = castMetas.get(key);
  return {
    id: block.id,
    who: block.who,
    displayName: castLabels.get(key) ?? block.who.toUpperCase(),
    ...(meta === undefined ? {} : { castMeta: meta }),
    lines: block.lines,
    fields: Object.freeze({ ...(block.fields ?? {}) }),
    t,
    start,
    typed,
    end,
    index,
    head,
    screen,
    safeBox,
    occupied,
    avoid,
  };
}

function cardInput(
  block: CardBlock,
  t: number,
  length: number,
  screen: CanvasSize,
  safeBox: Rect,
) {
  const { id, lines, attribution, sign, source, fields } = block;
  return {
    id,
    lines,
    fields: Object.freeze({ ...(fields ?? {}) }),
    t,
    length,
    screen,
    safeBox,
    ...(attribution == null ? {} : { attribution }),
    ...(sign == null ? {} : { sign }),
    ...(source == null ? {} : { source }),
  };
}

function isCastList(cast: NonNullable<Series["cast"]>): cast is readonly CastMember[] {
  return Array.isArray(cast);
}

interface CastRegistry {
  readonly names: Map<string, string>;
  readonly labels: Map<string, string>;
  readonly metas: Map<string, Readonly<Record<string, unknown>>>;
}

function readCastRegistry(cast: NonNullable<Series["cast"]>): CastRegistry {
  const entries: [string | undefined, CastMember][] = isCastList(cast)
    ? cast.map(member => [undefined, member])
    : Object.entries(cast);
  const names = new Map<string, string>();
  const labels = new Map<string, string>();
  const metas = new Map<string, Readonly<Record<string, unknown>>>();
  for (const [key, member] of entries) {
    const name = typeof member === "function" ? castName(member) : undefined;
    if (!name) {
      throw new Error(`The series cast has an entry${key ? ` under "${key}"` : ""} that is not made by cast(name, ...); a speaker is identified by its cast name.`);
    }
    const lower = name.toLowerCase();
    names.set(lower, name);
    const label = castLabel(member);
    if (label !== undefined) labels.set(lower, label);
    const meta = castMeta(member);
    if (meta !== undefined) metas.set(lower, meta);
  }
  return { names, labels, metas };
}

function isScriptDocument(input: FilmScriptInput): input is ScriptDocument {
  return typeof input === "object" && input !== null && "items" in input && Array.isArray(input.items);
}

function normalizeScriptInput(input: FilmScriptInput): {
  script: ScriptModule;
  parseFindings: ResolveCueFinding[];
} {
  if (typeof input === "string") {
    const doc = parseScript(input);
    if (!doc) throw new Error("The script text contains no shot, speech, or card blocks.");
    return normalizeDocument(doc);
  }
  if (isScriptDocument(input)) {
    return normalizeDocument(input);
  }
  return { script: input, parseFindings: [] };
}

function normalizeDocument(doc: ScriptDocument): {
  script: ScriptModule;
  parseFindings: ResolveCueFinding[];
} {
  const projected = filmScript(doc);
  const rawBlocks = scriptBlocks(doc);
  const parseFindings: ResolveCueFinding[] = doc.findings.map((finding) => {
    const projectedId = finding.blockIndex !== undefined ? projected.blocks[finding.blockIndex]?.id : undefined;
    const rawId = finding.blockIndex !== undefined ? rawBlocks[finding.blockIndex]?.rawId : undefined;
    return {
      id: projectedId ?? rawId ?? `line-${finding.line}`,
      code: finding.code,
      message: finding.message,
    };
  });
  return { script: projected, parseFindings };
}

function isShotResolver<Data>(shots: ShotsSource<Data>): shots is ShotResolver<Data> {
  return !Array.isArray(shots) &&
    typeof (shots as ShotResolver<Data>).has === "function" &&
    typeof (shots as ShotResolver<Data>).render === "function";
}

function normalizeShots<Data>(shots: ShotsSource<Data>) {
  if (isShotResolver(shots)) {
    return {
      count: (id: string) => (shots.has(id) ? 1 : 0),
      has: (id: string) => shots.has(id),
      render: (id: string, ctx: ShotContext<Data>) => shots.render(id, ctx),
    };
  }
  const modules = Array.isArray(shots) ? shots : [shots];
  // Only a function exported under a shot's id is that shot; other exports are helpers.
  const drawings = new Map<string, Shot<Data>>();
  const exporters = new Map<string, number>();
  for (const module of modules) {
    for (const [name, draw] of Object.entries(module)) {
      if (typeof draw !== "function") continue;
      exporters.set(name, (exporters.get(name) ?? 0) + 1);
      if (!drawings.has(name)) drawings.set(name, draw as Shot<Data>);
    }
  }
  return {
    count: (id: string) => exporters.get(id) ?? 0,
    has: (id: string) => drawings.has(id),
    render: (id: string, ctx: ShotContext<Data>): ShotResult | undefined => drawings.get(id)?.(ctx),
  };
}

function applyTokens(
  blocks: readonly ScriptBlock[],
  title: string,
  tokens: Readonly<Record<string, string>>,
): { blocks: readonly ScriptBlock[]; title: string } {
  const fill = (text: string) => text.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (!Object.hasOwn(tokens, key)) return match;
    return tokens[key]!;
  });
  const nextBlocks = blocks.map((block): ScriptBlock => {
    if (block.kind === "shot") {
      return block.text === undefined ? block : { ...block, text: fill(block.text) };
    }
    if (block.kind === "speech") {
      return { ...block, who: fill(block.who), lines: block.lines.map(fill) };
    }
    return {
      ...block,
      lines: block.lines.map(fill),
      ...(block.attribution ? { attribution: fill(block.attribution) } : {}),
      ...(block.sign ? { sign: fill(block.sign) } : {}),
      ...(block.source ? { source: fill(block.source) } : {}),
    };
  });
  return { blocks: nextBlocks, title: fill(title) };
}

function isNarrationPlan(value: FilmAudioOptions["speech"]): value is NarrationPlan {
  return typeof value === "object" && value !== null && "kind" in value && value.kind === "narration-plan";
}

function isRawAudioTimeline(
  value: FilmOptions<unknown>["audio"],
): value is AudioTimeline {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.clips) &&
    record.music === undefined &&
    record.speech === undefined &&
    record.sfx === undefined
  );
}

function extractSpeechDurations(audio?: FilmOptions<unknown>["audio"]): Map<string, number> | undefined {
  if (!audio || Array.isArray(audio) || isRawAudioTimeline(audio)) return undefined;
  const speech = audio.speech;
  if (!speech) return undefined;
  const durations = new Map<string, number>();
  if (isNarrationPlan(speech)) {
    for (const seg of speech.segments) {
      const dur = seg.speechDurationSeconds > 0 ? seg.speechDurationSeconds : seg.endSeconds - seg.startSeconds;
      if (Number.isFinite(dur) && dur > 0) durations.set(seg.id, dur);
    }
  } else {
    for (const [id, clip] of Object.entries(speech)) {
      if (clip.duration !== undefined && Number.isFinite(clip.duration) && clip.duration > 0) {
        durations.set(id, clip.duration);
      }
    }
  }
  return durations.size > 0 ? durations : undefined;
}

function parseSfxNames(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildFilmAudio(
  schedule: ReturnType<typeof clock>,
  durationSeconds: number,
  audioOptions?: FilmOptions<unknown>["audio"],
  score?: string,
): AudioValue | undefined {
  if (!audioOptions) {
    if (score === undefined) return undefined;
    return { id: "score", src: score, role: "sfx", duration: `${durationSeconds}s` };
  }

  if (Array.isArray(audioOptions)) {
    const clips: AudioClip[] = [...audioOptions];
    if (clips.length === 0 && score !== undefined) {
      clips.push({ id: "score", src: score, role: "sfx", duration: `${durationSeconds}s` });
    }
    if (clips.length === 0) return undefined;
    const hasMusic = clips.some((clip) => clip.role === "music");
    const hasVoice = clips.some((clip) => clip.role === "voice");
    return {
      clips,
      ...(hasMusic && hasVoice ? { mix: { ducking: true, duckingLevel: 0.25 } } : {}),
    };
  }

  if (isRawAudioTimeline(audioOptions)) {
    const clips: AudioClip[] = [...audioOptions.clips];
    if (clips.length === 0 && score !== undefined) {
      clips.push({ id: "score", src: score, role: "sfx", duration: `${durationSeconds}s` });
    }
    if (clips.length === 0) return undefined;
    return {
      clips,
      ...(audioOptions.mix !== undefined ? { mix: audioOptions.mix } : {}),
    };
  }

  const structured: FilmAudioOptions = audioOptions as FilmAudioOptions;
  const clips: AudioClip[] = [];

  if (structured.music !== undefined) {
    const music = typeof structured.music === "string"
      ? { src: structured.music }
      : structured.music;
    clips.push({
      id: "music",
      src: music.src,
      role: "music",
      at: "0s",
      duration: `${durationSeconds}s`,
      loop: music.loop ?? true,
      ...(music.volume !== undefined ? { volume: music.volume } : {}),
      ...(music.trim !== undefined ? { trim: music.trim } : {}),
      ...(music.fadeIn !== undefined ? { fadeIn: music.fadeIn } : {}),
      ...(music.fadeOut !== undefined ? { fadeOut: music.fadeOut } : {}),
    });
  } else if (score !== undefined) {
    clips.push({ id: "score", src: score, role: "sfx", duration: `${durationSeconds}s` });
  }

  if (structured.speech) {
    if (isNarrationPlan(structured.speech)) {
      const planClipsById = new Map<string, AudioClip>();
      for (const clip of structured.speech.audio.clips) {
        if (clip.id) planClipsById.set(clip.id, clip);
      }
      const placedIds = new Set<string>();
      for (const shot of schedule.shots) {
        for (const line of shot.lines) {
          if (line.block.kind !== "speech" || !line.block.id) continue;
          const match = planClipsById.get(line.block.id);
          if (!match) continue;
          placedIds.add(line.block.id);
          clips.push({
            ...match,
            id: match.id ?? `voice:${line.block.id}`,
            role: match.role ?? "voice",
            at: `${quantize(shot.start + line.start)}s`,
          });
        }
      }
      for (const clip of structured.speech.audio.clips) {
        if (clip.id && placedIds.has(clip.id)) continue;
        clips.push({ ...clip, role: clip.role ?? "voice" });
      }
    } else {
      for (const shot of schedule.shots) {
        for (const line of shot.lines) {
          if (line.block.kind !== "speech" || !line.block.id) continue;
          const spec = structured.speech[line.block.id];
          if (!spec) continue;
          clips.push({
            id: `voice:${line.block.id}`,
            src: spec.src,
            role: "voice",
            at: `${quantize(shot.start + line.start)}s`,
            ...(spec.duration !== undefined ? { duration: `${spec.duration}s` } : {}),
            ...(spec.volume !== undefined ? { volume: spec.volume } : {}),
            ...(spec.trim !== undefined ? { trim: spec.trim } : {}),
            ...(spec.fadeIn !== undefined ? { fadeIn: spec.fadeIn } : {}),
            ...(spec.fadeOut !== undefined ? { fadeOut: spec.fadeOut } : {}),
            ...(spec.transcript !== undefined ? { transcript: spec.transcript } : {}),
          });
        }
      }
    }
  }

  if (structured.sfx) {
    let sfxCounter = 0;
    const pushSfx = (cueName: string, atSeconds: number, ownerId: string) => {
      const entry = structured.sfx![cueName];
      if (!entry) return;
      sfxCounter += 1;
      if (typeof entry === "string") {
        clips.push({
          id: `sfx:${ownerId}:${cueName}:${sfxCounter}`,
          src: entry,
          role: "sfx",
          at: `${quantize(atSeconds)}s`,
        });
      } else {
        clips.push({
          ...entry,
          id: entry.id ?? `sfx:${ownerId}:${cueName}:${sfxCounter}`,
          role: entry.role ?? "sfx",
          at: `${quantize(atSeconds)}s`,
        });
      }
    };

    for (const shot of schedule.shots) {
      for (const name of parseSfxNames(shot.fields.sfx)) {
        pushSfx(name, shot.start, shot.id ?? "shot");
      }
      for (const line of shot.lines) {
        for (const name of parseSfxNames(line.block.fields?.sfx)) {
          pushSfx(name, shot.start + line.start, line.block.id ?? shot.id ?? "line");
        }
      }
    }
  }

  if (structured.clips) {
    for (const clip of structured.clips) clips.push(clip);
  }

  if (clips.length === 0) return undefined;

  const hasMusic = clips.some((clip) => clip.role === "music");
  const hasVoice = clips.some((clip) => clip.role === "voice");
  const mix: AudioMixOptions | undefined =
    structured.mix ?? (hasMusic && hasVoice ? { ducking: true, duckingLevel: 0.25 } : undefined);

  const timeline: AudioTimeline = {
    clips,
    ...(mix ? { mix } : {}),
  };
  return timeline;
}

function parseShotTransition(
  raw: string | undefined,
  fallback: ShotTransition | undefined,
): { type: "cut" | "dissolve" | "dip"; duration: number; color?: string } {
  if (raw) {
    const tokens = raw.trim().split(/\s+/).filter(Boolean);
    const kind = tokens[0]?.toLowerCase();
    if (kind === "cut") return { type: "cut", duration: 0 };
    if (kind === "dissolve" || kind === "dip") {
      let duration = kind === "dissolve" ? 0.35 : 0.4;
      let color: string | undefined;
      for (const token of tokens.slice(1)) {
        const secMatch = /^(\d+(?:\.\d+)?|\.\d+)s?$/i.exec(token);
        if (secMatch) {
          const parsed = Number(secMatch[1]);
          if (Number.isFinite(parsed) && parsed > 0) duration = parsed;
        } else if (kind === "dip") {
          color = token;
        }
      }
      return { type: kind, duration, ...(color !== undefined ? { color } : {}) };
    }
  }
  if (!fallback || fallback.type === "cut") return { type: "cut", duration: 0 };
  const defaultDuration = fallback.type === "dissolve" ? 0.35 : 0.4;
  const duration =
    fallback.duration !== undefined && Number.isFinite(fallback.duration) && fallback.duration > 0
      ? fallback.duration
      : defaultDuration;
  return {
    type: fallback.type,
    duration,
    ...(fallback.color !== undefined ? { color: fallback.color } : {}),
  };
}

function buildFilmMarks(schedule: ReturnType<typeof clock>, fps: number): FilmMarks {
  const shots: FilmShotMark[] = [];
  const speech: FilmSpeechMark[] = [];
  const cards: FilmCardMark[] = [];
  for (const [index, shot] of schedule.shots.entries()) {
    shots.push(Object.freeze({
      id: shot.id,
      index,
      start: quantize(shot.start),
      end: quantize(shot.end),
      duration: quantize(shot.duration),
      still: quantize(shot.start + shot.still),
      section: shot.section,
      fields: shot.fields,
    }));
    for (const line of shot.lines) {
      if (line.block.kind === "speech") {
        speech.push(Object.freeze({
          id: line.block.id,
          shotId: shot.id,
          who: line.block.who,
          start: quantize(shot.start + line.start),
          typed: quantize(shot.start + line.typed),
          end: quantize(shot.start + line.end),
          still: quantize(shot.start + line.still),
          lines: Object.freeze([...line.block.lines]),
          fields: Object.freeze({ ...(line.block.fields ?? {}) }),
        }));
      } else {
        cards.push(Object.freeze({
          id: line.block.id,
          shotId: shot.id,
          start: quantize(shot.start + line.start),
          end: quantize(shot.start + line.end),
          still: quantize(shot.start + line.still),
          lines: Object.freeze([...line.block.lines]),
          fields: Object.freeze({ ...(line.block.fields ?? {}) }),
        }));
      }
    }
  }
  return Object.freeze({
    total: quantize(schedule.total),
    fps,
    shots: Object.freeze(shots),
    speech: Object.freeze(speech),
    cards: Object.freeze(cards),
  });
}

interface CompiledPlan {
  readonly schedule: ReturnType<typeof clock>;
  readonly duration: number;
  readonly audio: AudioValue | undefined;
  readonly title: string;
  readonly findings: readonly ResolveCueFinding[];
  readonly lineViews: Map<TimedShot, readonly ShotLine[]>;
}

type FrameOverrides = {
  readonly stage: CanvasSize;
  readonly fit: FilmFit | undefined;
  readonly safeArea: FilmSafeArea | undefined;
  readonly background: string | undefined;
  readonly ending: Series["ending"];
  readonly transition: Series["transition"];
  readonly shapeRendering: Series["shapeRendering"];
  readonly bubble: Series["bubble"];
  readonly layoutBubbles: Series["layoutBubbles"];
  readonly card: Series["card"];
  readonly drawTitle: Series["drawTitle"];
};

export function film<Data = unknown>(options: FilmOptions<Data>) {
  const { stage, size = DEFAULT_SIZE, score, audio: audioOptions, data, tokens } = options;
  const fps = options.fps ?? 30;
  const { script, parseFindings } = normalizeScriptInput(options.script);
  const shotSource = normalizeShots(options.shots);
  const castRegistry = readCastRegistry(options.cast ?? []);
  const speakers = new Set(castRegistry.names.keys());
  const baseTitle = options.title ?? script.title ?? "";
  const { drawTitle } = options;
  const speechDurations = extractSpeechDurations(audioOptions);

  const baseOverrides: FrameOverrides = {
    stage,
    fit: options.fit,
    safeArea: options.safeArea,
    background: options.background,
    ending: options.ending,
    transition: options.transition,
    shapeRendering: options.shapeRendering,
    bubble: options.bubble,
    layoutBubbles: options.layoutBubbles,
    card: options.card,
    drawTitle: options.drawTitle,
  };

  function compilePlan(boundBlocks: readonly ScriptBlock[], boundTitle: string): CompiledPlan {
    const schedule = clock(boundBlocks, speechDurations ? { speechDurations } : undefined);
    if (schedule.total <= 0) throw new Error("A film needs at least one shot with positive duration.");
    const findings: ResolveCueFinding[] = [
      ...parseFindings,
      ...schedule.findings,
      ...scriptFindings(
        schedule.shots,
        shotSource.count,
        speakers,
        options,
        drawTitle ? boundTitle : "",
        castRegistry.labels,
      ),
    ];
    const duration = publishedDuration(schedule.total, fps).seconds;
    const audio = buildFilmAudio(schedule, duration, audioOptions, score);
    const lineViews = new Map(schedule.shots.map(shot => [shot, shot.lines.map(({ block, start, typed, end }): ShotLine => ({
      id: block.id,
      kind: block.kind,
      ...(block.kind === "speech" ? { who: block.who, ...(block.pace ? { pace: block.pace } : {}) } : {}),
      lines: block.lines,
      fields: Object.freeze({ ...(block.fields ?? {}) }),
      start,
      typed,
      end,
    }))]));
    return { schedule, duration, audio, title: boundTitle, findings, lineViews };
  }

  const initialTokens = tokens && data !== undefined ? tokens(data) : undefined;
  const initialBound = initialTokens ? applyTokens(script.blocks, baseTitle, initialTokens) : { blocks: script.blocks, title: baseTitle };
  const basePlan = compilePlan(initialBound.blocks, initialBound.title);

  let cachedTokenKey = initialTokens ? JSON.stringify(initialTokens) : undefined;
  let cachedPlan = basePlan;
  function planFor(currentData: Data): CompiledPlan {
    if (!tokens || currentData === undefined) return basePlan;
    const map = tokens(currentData);
    const key = JSON.stringify(map);
    if (key === cachedTokenKey) return cachedPlan;
    const bound = applyTokens(script.blocks, baseTitle, map);
    cachedPlan = compilePlan(bound.blocks, bound.title);
    cachedTokenKey = key;
    return cachedPlan;
  }

  function breakdownFor(currentData: Data, screen: CanvasSize = size) {
    const plan = planFor(currentData);
    return computeBreakdown(
      plan.schedule.shots,
      shotSource.render,
      shotSource.has,
      plan.lineViews,
      castRegistry.names,
      screen,
      currentData,
    );
  }

  function scene(
    plan: CompiledPlan,
    shot: TimedShot,
    t: number,
    currentData: Data,
    screen: CanvasSize,
    overrides: FrameOverrides,
    activeSpeaker?: string,
  ) {
    const id = shot.id ?? "";
    const result = shotSource.render(id, {
      id,
      t: t + shot.in,
      u: shot.duration > 0 ? clamp(t / shot.duration) : 1,
      duration: shot.duration,
      screen,
      text: shot.text,
      section: shot.section,
      fields: shot.fields,
      lines: plan.lineViews.get(shot)!,
      data: currentData,
    }) ?? [];
    const { art, heads, obstacles } = typeof result === "string" || Array.isArray(result) ? { art: result, heads: undefined, obstacles: undefined } : result;
    const projected = typeof art === "string" ? undefined : projectShot(art, overrides.stage);
    const svgExtracted = typeof art === "string" ? extractSvgSubjectsAndHeads(art) : undefined;
    const named = new Map(Object.entries(heads ?? {}).map(([name, head]) => [name.toLowerCase(), head]));
    const stageHead = (who: string): Point | undefined => {
      const name = who.toLowerCase();
      return named.get(name) ?? projected?.heads.get(name) ?? svgExtracted?.heads.get(name);
    };
    const fit: FilmFit = overrides.fit ?? (typeof art === "string" ? "cover" : "contain");
    let focusPoint: Point | undefined;
    if (fit === "focus") {
      focusPoint =
        (Array.isArray(art) ? extractFocusPoint(art) : undefined) ??
        (activeSpeaker ? stageHead(activeSpeaker) : undefined);
    }
    const vp = viewport(overrides.stage, screen, fit, focusPoint);
    const toScreen = ({ x, y }: Point): Point => ({ x: x * vp.scale + vp.x, y: y * vp.scale + vp.y });
    return {
      art: projected?.art ?? art,
      fit,
      vp,
      avoid: [...(obstacles ?? []), ...(projected?.obstacles ?? [])].map(rect => projectRect(rect, toScreen)),
      head(who: string) {
        const point = stageHead(who);
        return point && toScreen(point);
      },
    };
  }

  function renderFrame(ctx: RenderContext<Data>, overrides: FrameOverrides) {
    const { seconds } = ctx.timeline;
    const plan = planFor(ctx.data);
    const first = plan.schedule.shots[0];
    const shot = shotAt(plan.schedule.shots, seconds);
    const shotIndex = plan.schedule.shots.indexOf(shot);
    const t = Math.max(0, seconds - shot.start);
    const screen = { width: ctx.width, height: ctx.height };
    const safeBox = resolveSafeBox(screen, overrides.safeArea);

    const activeSpeech = shot.lines.find(
      (line) => line.block.kind === "speech" && t >= line.start && t <= line.end + 0.15,
    );
    const activeSpeaker =
      activeSpeech?.block.kind === "speech" ? activeSpeech.block.who : undefined;

    const currentScene = scene(plan, shot, t, ctx.data, screen, overrides, activeSpeaker);
    let art: ShotArt = currentScene.art;
    let fit: FilmFit = currentScene.fit;
    let vp = currentScene.vp;
    const { head, avoid } = currentScene;

    const parts: ShotArt[] = [];
    const transition = shotIndex > 0 ? parseShotTransition(shot.fields.transition, overrides.transition) : { type: "cut" as const, duration: 0 };
    if (shotIndex > 0 && transition.type !== "cut" && transition.duration > 0 && t < transition.duration) {
      const prevShot = plan.schedule.shots[shotIndex - 1]!;
      const prevScene = scene(plan, prevShot, prevShot.duration, ctx.data, screen, overrides);
      if (transition.type === "dissolve") {
        const alpha = clamp(t / transition.duration);
        if (Array.isArray(prevScene.art) && Array.isArray(art)) {
          art = [
            ...prevScene.art,
            vector.group({ opacity: alpha }, ...art),
          ];
        } else if (typeof prevScene.art === "string" && typeof art === "string") {
          art = `${prevScene.art}<g opacity="${alpha.toFixed(4)}">${art}</g>`;
        }
      } else if (transition.type === "dip") {
        const half = transition.duration / 2;
        const dipColor = transition.color ?? overrides.background ?? "#000";
        const dipOpacity = t < half ? clamp(t / half) : clamp(1 - (t - half) / half);
        if (t < half) {
          art = prevScene.art;
          fit = prevScene.fit;
          vp = prevScene.vp;
        }
        if (dipOpacity > 0) {
          parts.push(
            typeof art === "string"
              ? `<rect x="0" y="0" width="${screen.width}" height="${screen.height}" fill="${dipColor}" opacity="${dipOpacity.toFixed(4)}"/>`
              : [vector.rect({ x: 0, y: 0, width: screen.width, height: screen.height, fill: dipColor, opacity: dipOpacity })],
          );
        }
      }
    }

    const titleActive = shot === first && Boolean(overrides.drawTitle) && Boolean(plan.title);
    const activeBubbles: BubbleInput[] = [];
    const occupied: Rect[] = [];
    for (const line of shot.lines) {
      const { block, start, end } = line;
      if (t < start || t > end + (block.kind === "speech" ? 0.15 : 0)) continue;
      if (block.kind === "card") {
        if (overrides.card) parts.push(overrides.card(cardInput(block, t - start, end - start, screen, safeBox)));
      } else {
        const point = head(block.who);
        if (point) {
          if (overrides.layoutBubbles) {
            activeBubbles.push(
              bubbleInput(line, block, t, point, screen, safeBox, [], avoid, castRegistry.labels, castRegistry.metas),
            );
          } else if (overrides.bubble) {
            const bubbleArt = overrides.bubble(
              bubbleInput(line, block, t, point, screen, safeBox, occupied, avoid, castRegistry.labels, castRegistry.metas),
            );
            parts.push(bubbleArt);
            const { box } = paintedBounds(bubbleArt);
            if (box) {
              occupied.push({
                x: box.x0,
                y: box.y0,
                width: Math.max(0, box.x1 - box.x0),
                height: Math.max(0, box.y1 - box.y0),
              });
            }
          }
        }
      }
    }
    if (overrides.layoutBubbles && activeBubbles.length > 0) {
      parts.push(overrides.layoutBubbles(activeBubbles, { screen, safeBox, avoid, titleActive }));
    }
    if (shot === first && overrides.drawTitle) parts.push(overrides.drawTitle(t, plan.title, { screen, safeBox }));
    if ((overrides.ending ?? (typeof art === "string" ? "fade" : "cut")) === "fade") {
      parts.push(fadeMarkup(seconds, plan.schedule.total, screen, overrides.background ?? (typeof art === "string" ? "#06070c" : "#000")));
    }
    return renderFilm(art, parts, overrides, screen, fit, vp);
  }

  function overridesForEdition(edition: FilmEdition): FrameOverrides {
    return {
      stage: edition.stage ?? stage,
      fit: edition.fit ?? options.fit,
      safeArea: edition.safeArea ?? options.safeArea,
      background: edition.background ?? options.background,
      ending: edition.ending ?? options.ending,
      transition: edition.transition ?? options.transition,
      shapeRendering: edition.shapeRendering ?? options.shapeRendering,
      bubble: edition.bubble ?? options.bubble,
      layoutBubbles: edition.layoutBubbles ?? options.layoutBubbles,
      card: edition.card ?? options.card,
      drawTitle: edition.drawTitle ?? options.drawTitle,
    };
  }

  const videoEditions: Record<string, MediaEdition<Data, RenderContext<Data>>> | undefined =
    options.editions
      ? Object.fromEntries(
          Object.entries(options.editions).map(([name, edition]) => {
            const editionOverrides = overridesForEdition(edition);
            return [
              name,
              {
                size: edition.size,
                render: (ctx: RenderContext<Data>) => renderFrame(ctx, editionOverrides),
              },
            ];
          }),
        )
      : undefined;

  const media = video<Data>({
    size,
    fps,
    duration: `${basePlan.duration}s`,
    ...(data === undefined ? {} : { sample: data }),
    ...(basePlan.audio === undefined ? {} : { audio: basePlan.audio }),
    ...(options.fonts === undefined ? {} : { fonts: [...options.fonts] }),
    ...(options.inlineCss === undefined ? {} : { inlineCss: [...options.inlineCss] }),
    ...(options.stylesheets === undefined ? {} : { stylesheets: [...options.stylesheets] }),
    ...(videoEditions === undefined ? {} : { editions: videoEditions }),
    resolve({ data: currentData, config }) {
      const screen = { width: config.width ?? size.width, height: config.height ?? size.height };
      const matchingEdition = options.editions
        ? Object.values(options.editions).find(
            (ed) => ed.size.width === screen.width && ed.size.height === screen.height,
          )
        : undefined;
      const activeOverrides = matchingEdition ? overridesForEdition(matchingEdition) : baseOverrides;
      const safeBox = resolveSafeBox(screen, activeOverrides.safeArea);
      const plan = planFor(currentData);
      const breakdown = computeBreakdown(
        plan.schedule.shots,
        shotSource.render,
        shotSource.has,
        plan.lineViews,
        castRegistry.names,
        screen,
        currentData,
      );
      const cueFindings: ResolveCueFinding[] = [
        ...plan.findings,
        ...continuityFindings(plan.schedule.shots, breakdown, castRegistry.names, options.continuity),
      ];
      const firstShot = plan.schedule.shots[0];
      for (const shot of plan.schedule.shots) {
        if (!shot.id || !shotSource.has(shot.id)) continue;
        for (const line of shot.lines) {
          const { block, still: t } = line;
          if (block.kind !== "speech" || !block.id || t > shot.duration + EPSILON) continue;
          const shotFrame = scene(plan, shot, t, currentData, screen, activeOverrides, block.who);
          const head = shotFrame.head(block.who);
          if (!head) {
            cueFindings.push({ id: block.id, code: "NO_HEAD", message: `No head was found for "${block.who}" at this cue's still.` });
            continue;
          }
          let bubbleArt: ShotArt | undefined;
          if (activeOverrides.layoutBubbles) {
            const activeAtStill: BubbleInput[] = [];
            for (const other of shot.lines) {
              if (other.block.kind !== "speech") continue;
              if (t < other.start || t > other.end + 0.15) continue;
              const otherHead = shotFrame.head(other.block.who);
              if (!otherHead) continue;
              activeAtStill.push(
                bubbleInput(other, other.block, t, otherHead, screen, safeBox, [], shotFrame.avoid, castRegistry.labels, castRegistry.metas),
              );
            }
            const titleActive = shot === firstShot && Boolean(activeOverrides.drawTitle) && Boolean(plan.title);
            bubbleArt = activeOverrides.layoutBubbles(activeAtStill, { screen, safeBox, avoid: shotFrame.avoid, titleActive });
          } else if (activeOverrides.bubble) {
            bubbleArt = activeOverrides.bubble(
              bubbleInput(line, block, t, head, screen, safeBox, [], shotFrame.avoid, castRegistry.labels, castRegistry.metas),
            );
          }
          if (bubbleArt === undefined) continue;
          const problem = bubbleFinding(bubbleArt, screen);
          if (problem === "BUBBLE_OFF_CANVAS") {
            cueFindings.push({ id: block.id, code: problem, message: `The bubble for "${block.who}" paints outside the canvas at this cue's still.` });
          } else if (problem) {
            cueFindings.push({ id: block.id, code: problem, message: `The bubble for "${block.who}" is SVG the film cannot read at this cue's still, so its placement was not checked.` });
          }
        }
      }
      return {
        ...(plan !== basePlan ? { duration: `${plan.duration}s`, ...(plan.audio ? { audio: plan.audio } : {}) } : {}),
        cues: plan.schedule.cues,
        cueFindings,
        breakdown,
      };
    },
    render(ctx) {
      return renderFrame(ctx, baseOverrides);
    },
  });

  Object.defineProperty(media, FILM_BREAKDOWN, {
    value: (override?: Data) => breakdownFor((override ?? data) as Data),
    enumerable: true,
  });

  Object.defineProperty(media, FILM_MARKS, {
    value: (override?: Data) => buildFilmMarks(planFor((override ?? data) as Data).schedule, fps),
    enumerable: true,
  });

  return media;
}

/**
 * Pure helper returning resolved shot, speech, and card timing marks for a
 * `film()` definition — designed for procedural score generators and studio
 * timelines that need exact boundaries whenever holds change.
 */
export function filmMarks<Data = unknown>(media: unknown, data?: Data): FilmMarks {
  if (media && typeof media === "object") {
    const fn = (media as Record<symbol, unknown>)[FILM_MARKS];
    if (typeof fn === "function") {
      return (fn as (override?: Data) => FilmMarks)(data);
    }
  }
  return Object.freeze({ total: 0, fps: 30, shots: [], speech: [], cards: [] });
}

/**
 * Pure, synchronous browser-safe inspection of a `film()` media definition.
 * Evaluates `resolve()` once without mounting a DOM Player or launching Chromium,
 * returning live cues, findings, marks, and cast/prop breakdown for studio editors.
 */
export function inspectFilm<Data = unknown>(
  media: VideoDefinition<Data>,
  options: { data?: Data; size?: CanvasSize } = {},
): FilmInspection {
  const width = options.size?.width ?? media.config?.width ?? DEFAULT_SIZE.width;
  const height = options.size?.height ?? media.config?.height ?? DEFAULT_SIZE.height;
  const fps = media.config?.fps ?? 30;
  const parseSec = (value: unknown): number => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = parseFloat(value);
      if (Number.isFinite(parsed)) {
        return value.endsWith("ms") ? parsed / 1000 : value.endsWith("f") ? parsed / fps : parsed;
      }
    }
    return 0;
  };
  const resolved = media.resolve?.({
    data: (options.data ?? media.sample ?? {}) as Data,
    config: { ...(media.config ?? {}), width, height },
    asset: (file) => file,
    assets: {},
  });
  if (resolved && "then" in resolved) {
    throw new Error("inspectFilm() expects a synchronous film() definition.");
  }
  const duration = parseSec(resolved?.duration ?? media.config?.duration);
  return {
    duration,
    fps,
    size: { width, height },
    cues: resolved?.cues ?? [],
    findings: resolved?.cueFindings ?? [],
    breakdown: resolved?.breakdown ?? {},
    marks: filmMarks(media, options.data),
  };
}
