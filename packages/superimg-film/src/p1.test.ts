import { describe, expect, it } from "vitest";
import type { AudioTimeline, NarrationPlan } from "@superimg/types";
import {
  cast,
  closeOn,
  extractSvgSubjectsAndHeads,
  film,
  filmBreakdown,
  inspectFilm,
  placeBubble,
  r,
  trimShot,
} from "./index.js";

function makeCtx(seconds: number, width = 320, height = 180) {
  return {
    timeline: { seconds, progress: 0, frame: Math.round(seconds * 30), durationSeconds: 10 },
    width,
    height,
    data: {},
  } as never;
}

describe("P1 film audio, reframing, SVG markers, trim, and bubble layout", () => {
  it("compiles FilmOptions.audio with VO-driven speech timing, music ducking, and sfx fields", () => {
    const fox = cast("fox", { head: { x: 0, y: -20 }, draw: () => [r(0, 0, 20, 20, "#f97316")] });
    const script = [
      "# Campfire",
      "",
      "```shot id=open",
      "sfx: crackle",
      "",
      "Fox sits by the fire.",
      "```",
      "",
      "```speech id=line1",
      "who: fox",
      "sfx: chime",
      "",
      "Short.",
      "```",
      "",
    ].join("\n");

    const media = film({
      stage: { width: 320, height: 180 },
      size: { width: 320, height: 180 },
      cast: [fox],
      bubble: () => "",
      script,
      audio: {
        music: { src: "https://cdn.example/bed.mp3", volume: 0.7 },
        speech: {
          line1: { src: "https://cdn.example/line1.mp3", duration: 4.2 },
        },
        sfx: {
          crackle: "https://cdn.example/crackle.wav",
          chime: { src: "https://cdn.example/chime.wav", volume: 0.5 },
        },
      },
      shots: {
        open: ({ t }) => [fox(t, { x: 160, y: 120 })],
      },
    });

    const info = inspectFilm(media);
    // line1 starts at 0.3s, duration 4.2s -> ends at 4.5s; shot auto-ends at 4.5 + 0.3 = 4.8s.
    expect(info.cues.find((c) => c.id === "line1")).toMatchObject({ start: 0.3, end: 4.5 });
    expect(info.duration).toBeCloseTo(4.8, 3);

    const timeline = media.config?.audio as AudioTimeline;
    expect(timeline.mix).toEqual({ ducking: true, duckingLevel: 0.25 });
    expect(timeline.clips).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "music", role: "music", src: "https://cdn.example/bed.mp3", loop: true, volume: 0.7 }),
        expect.objectContaining({ id: "voice:line1", role: "voice", src: "https://cdn.example/line1.mp3", at: "0.3s", duration: "4.2s" }),
        expect.objectContaining({ role: "sfx", src: "https://cdn.example/crackle.wav", at: "0s" }),
        expect.objectContaining({ role: "sfx", src: "https://cdn.example/chime.wav", at: "0.3s", volume: 0.5 }),
      ]),
    );
  });

  it("accepts a NarrationPlan directly in FilmOptions.audio.speech", () => {
    const fox = cast("fox", { head: { x: 0, y: -20 }, draw: () => [r(0, 0, 10, 10, "#fff")] });
    const plan: NarrationPlan = {
      schemaVersion: 1,
      kind: "narration-plan",
      mode: "natural",
      fps: 30,
      totalFrames: 90,
      durationSeconds: 3,
      segments: [
        { id: "line1", startFrame: 0, endFrame: 90, startSeconds: 0, endSeconds: 3, speechStartSeconds: 0, speechDurationSeconds: 2.5, paddingSeconds: 0.5 },
      ],
      phases: { line1: "3s" },
      audio: { clips: [{ id: "line1", src: "https://cdn.example/narration.wav", role: "voice", at: "0s", duration: "2.5s" }] },
      findings: [],
    };
    const media = film({
      stage: { width: 320, height: 180 },
      size: { width: 320, height: 180 },
      cast: [fox],
      bubble: () => "",
      script: "```shot id=s1\nScene.\n```\n\n```speech id=line1\nwho: fox\n\nHi.\n```\n",
      audio: { speech: plan },
      shots: { s1: ({ t }) => [fox(t, { x: 100, y: 100 })] },
    });
    const info = inspectFilm(media);
    expect(info.cues.find((c) => c.id === "line1")).toMatchObject({ start: 0.3, end: 2.8 });
    const timeline = media.config?.audio as AudioTimeline;
    expect(timeline.clips[0]).toMatchObject({ id: "line1", role: "voice", at: "0.3s" });
  });

  it("extracts transformed SVG-string cast, prop, and head markers for continuity and bubbles", () => {
    const svgArt = [
      `<g transform="translate(100 50) scale(2)">`,
      `  <g data-superimg-cast="mira" data-superimg-head="10,20"><rect x="0" y="0" width="20" height="40" fill="#fff"/></g>`,
      `  <g data-superimg-prop="lantern"><circle cx="5" cy="5" r="4" fill="#ff0"/></g>`,
      `</g>`,
      `<g opacity="0" data-superimg-prop="hidden-key"><rect x="0" y="0" width="4" height="4" fill="#fff"/></g>`,
    ].join("");

    const extracted = extractSvgSubjectsAndHeads(svgArt);
    expect([...extracted.cast.values()]).toEqual(["mira"]);
    expect([...extracted.props.values()]).toEqual(["lantern"]);
    // (10, 20) * 2 + (100, 50) = (120, 90)
    expect(extracted.heads.get("mira")).toEqual({ x: 120, y: 90 });

    const seenHeads: Array<{ x: number; y: number }> = [];
    const media = film({
      stage: { width: 320, height: 180 },
      size: { width: 320, height: 180 },
      bubble: (b) => {
        seenHeads.push(b.head);
        return `<rect x="${b.head.x - 20}" y="${b.head.y - 30}" width="40" height="20" fill="#fff"/>`;
      },
      script: [
        "```shot id=s1 hold=2",
        "Mira enters.",
        "```",
        "",
        "```shot id=s2 hold=2",
        "Mira talks about the lantern.",
        "```",
        "",
        "```speech id=sp1",
        "who: mira",
        "",
        "Grab the lantern!",
        "```",
      ].join("\n"),
      shots: {
        s1: () => `<g data-superimg-cast="mira" data-superimg-head="80,90"><rect x="70" y="90" width="20" height="40" fill="#fff"/></g>`,
        s2: () => svgArt,
      },
    });

    const bd = filmBreakdown(media);
    expect(bd.s2).toEqual({ cast: ["mira"], props: ["lantern"] });
    const info = inspectFilm(media);
    // lantern was NOT in s1, but named in s2 -> PROP_NOT_PLANTED
    expect(info.findings.some((f) => f.code === "PROP_NOT_PLANTED")).toBe(true);
    // mira's head was extracted from SVG markup so no NO_HEAD finding
    expect(info.findings.some((f) => f.code === "NO_HEAD")).toBe(false);
    expect(seenHeads[0]).toEqual({ x: 120, y: 90 });
  });

  it("supports fit:'focus' and film({ editions }) with per-edition safeArea", () => {
    const fox = cast("fox", { head: { x: 0, y: -20 }, draw: () => [r(-10, -10, 20, 20, "#f97316")] });
    let capturedSafeBox: { x: number; y: number; width: number; height: number } | undefined;
    let capturedHead: { x: number; y: number } | undefined;

    const media = film({
      stage: { width: 1920, height: 1080 },
      size: { width: 1920, height: 1080 },
      cast: [fox],
      bubble: (b) => {
        capturedSafeBox = b.safeBox;
        capturedHead = b.head;
        return [r(b.safeBox.x, b.safeBox.y, 100, 40, "#fff")];
      },
      script: [
        "```shot id=s1 hold=2",
        "Fox on far right.",
        "```",
        "",
        "```speech id=sp1",
        "who: fox",
        "",
        "Over here!",
        "```",
      ].join("\n"),
      shots: {
        s1: ({ t }) => [closeOn({ x: 1700, y: 540 }, { zoom: 1 }, [fox(t, { x: 1700, y: 540 })])],
      },
      editions: {
        portrait: {
          size: { width: 1080, height: 1920 },
          fit: "focus",
          safeArea: "social",
        },
      },
    });

    expect(media.editions?.portrait?.size).toEqual({ width: 1080, height: 1920 });
    const out = media.editions!.portrait!.render!(makeCtx(0.5, 1080, 1920));
    expect(out).toMatchObject({ type: "Frame" });
    // Focus-panned toward x=1700 on 1920x1080 stage scaled to 1080x1920 (scale = 1920/1080 = 1.7778)
    // Head should remain inside the 1080px portrait width instead of being cropped off right!
    expect(capturedHead).toBeDefined();
    expect(capturedHead!.x).toBeGreaterThan(0);
    expect(capturedHead!.x).toBeLessThan(1080);
    // Social safe area insets are non-zero
    expect(capturedSafeBox!.y).toBeGreaterThan(100);
    expect(capturedSafeBox!.height).toBeLessThan(1920);
  });

  it.each(["vector", "svg"] as const)("avoids a second character's mark in a zoomed %s shot", (lane) => {
    const speaker = cast("fox", {
      head: { x: 0, y: -20 },
      draw: (_t, at) => [r(at.x - 10, at.y - 20, 20, 20, "#f97316")],
    });
    const listener = cast("owl", {
      head: { x: 0, y: -20 },
      draw: (_t, at) => [r(at.x - 10, at.y - 20, 20, 20, "#cbd5e1")],
    });
    const mark = { x: 148, y: 56, width: 24, height: 22 };
    let painted = 0;
    const media = film({
      stage: { width: 320, height: 180 },
      size: { width: 640, height: 480 },
      fit: "contain",
      ending: "cut",
      cast: [speaker, listener],
      safeArea: { top: 80, right: 40, bottom: 80, left: 40 },
      script: [
        "```shot id=talk hold=2", "A question.", "```", "",
        "```speech id=line", "who: fox", "", "What now?", "```",
      ].join("\n"),
      shots: {
        talk: ({ t }) => lane === "vector"
          ? [closeOn({ x: 160, y: 90 }, { zoom: 1.3 }, [
              speaker(t, { x: 160, y: 110 }),
              listener(t, { x: 149, y: 98 }),
              r(mark.x, mark.y, mark.width, mark.height, "#fff"),
            ], [mark])]
          : {
              art: '<g transform="translate(-48 -27) scale(1.3)"><rect x="150" y="90" width="20" height="20"/><rect x="139" y="78" width="20" height="20"/><rect x="148" y="56" width="24" height="22"/></g>',
              heads: { fox: { x: 160, y: 90 } },
              obstacles: [{ x: 144.4, y: 45.8, width: 31.2, height: 28.6 }],
            },
      },
      bubble: ({ avoid, head, safeBox, occupied }) => {
        painted++;
        expect(avoid).toHaveLength(1);
        const obstacle = avoid![0]!;
        expect(obstacle.x).toBeCloseTo(288.8);
        expect(obstacle.y).toBeCloseTo(151.6);
        expect(obstacle.width).toBeCloseTo(62.4);
        expect(obstacle.height).toBeCloseTo(57.2);
        const overlaps = (box: typeof obstacle) =>
          box.x < obstacle.x + obstacle.width && box.x + box.width > obstacle.x &&
          box.y < obstacle.y + obstacle.height && box.y + box.height > obstacle.y;
        const options = { head, safeBox, size: { width: 120, height: 40 } };
        expect(overlaps(placeBubble(options).box)).toBe(true);
        const { box } = placeBubble({ ...options, occupied: [...occupied, obstacle] });
        expect(overlaps(box)).toBe(false);
        expect(box.x).toBeGreaterThanOrEqual(safeBox.x);
        expect(box.y).toBeGreaterThanOrEqual(safeBox.y);
        expect(box.x + box.width).toBeLessThanOrEqual(safeBox.x + safeBox.width);
        expect(box.y + box.height).toBeLessThanOrEqual(safeBox.y + safeBox.height);
        return [r(box.x, box.y, box.width, box.height, "#eee")];
      },
    });

    media.render(makeCtx(0.5, 640, 480));
    expect(painted).toBe(1);
    inspectFilm(media);
    expect(painted).toBe(2);
  });

  it("places bubbles inside safeBox, flips below near top edge, and dodges occupied boxes", () => {
    const safeBox = { x: 40, y: 100, width: 1000, height: 1600 };

    // Near top edge -> flips below head
    const topFlip = placeBubble({
      head: { x: 500, y: 120 },
      size: { width: 300, height: 80 },
      safeBox,
    });
    expect(topFlip.tailSide).toBe("top");
    expect(topFlip.y).toBeGreaterThan(120);

    // Near right edge -> clamps horizontally inside safeBox
    const rightClamp = placeBubble({
      head: { x: 1020, y: 800 },
      size: { width: 300, height: 80 },
      safeBox,
    });
    expect(rightClamp.x + rightClamp.box.width).toBeLessThanOrEqual(safeBox.x + safeBox.width);
    expect(rightClamp.tailX).toBeLessThanOrEqual(rightClamp.x + rightClamp.box.width - 18);

    // Collides with occupied bubble -> nudges cleanly away
    const first = placeBubble({
      head: { x: 500, y: 800 },
      size: { width: 260, height: 80 },
      safeBox,
    });
    const second = placeBubble({
      head: { x: 520, y: 800 },
      size: { width: 260, height: 80 },
      safeBox,
      occupied: [first.box],
    });
    const noVerticalOverlap =
      second.box.y + second.box.height <= first.box.y || second.box.y >= first.box.y + first.box.height;
    expect(noVerticalOverlap).toBe(true);
  });

  it("offsets shot time via in= fence attribute and trimShot()", () => {
    const seenT: number[] = [];
    const rawShot = trimShot(
      ({ t }) => {
        seenT.push(t);
        return [r(0, 0, 10, 10, "#fff")];
      },
      { in: 2, out: 5, sourceDuration: 10 },
    );

    const media = film({
      stage: { width: 100, height: 100 },
      size: { width: 100, height: 100 },
      bubble: () => "",
      script: "```shot id=s1 hold=2 in=1.5\nTrimmed shot.\n```\n",
      shots: { s1: rawShot },
    });

    media.render(makeCtx(0.5, 100, 100));
    // shot.in (1.5) + local t (0.5) = 2.0, plus trimShot({ in: 2 }) -> 4.0
    expect(seenT.at(-1)).toBeCloseTo(4.0, 5);
  });
});
