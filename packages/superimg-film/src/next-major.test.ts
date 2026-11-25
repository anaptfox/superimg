import { describe, expect, it } from "vitest";
import { vector } from "@superimg/stdlib/tree";
import { cast, film, filmBreakdown, filmMarks, inspectFilm, type BubbleInput, type TitleContext } from "./index.js";

function fakeCtx(seconds: number, width = 1080, height = 1920) {
  return {
    width,
    height,
    fps: 30,
    data: {},
    timeline: { seconds, frame: Math.round(seconds * 30), durationSeconds: 5, progress: seconds / 5 },
  } as never;
}

const maya = cast("maya", { head: { x: 0, y: -25 }, draw: () => [vector.circle({ cx: 0, cy: 0, r: 20, fill: "#f59e0b" })] });
const leo = cast("leo", { head: { x: 0, y: -25 }, draw: () => [vector.circle({ cx: 0, cy: 0, r: 20, fill: "#38bdf8" })] });

const SCRIPT = `# Window Seat

\`\`\`shot id=s1 hold=3
The lantern glows on the sill.
\`\`\`

\`\`\`speech id=l1 at=0.2..2.4
who: maya

Hello!
\`\`\`

\`\`\`speech id=l2 at=0.4..2.4
who: leo

Hi!
\`\`\`

\`\`\`shot id=s2 hold=2
transition: dissolve 0.5s

Maya picks up the brass key.
\`\`\`
`;

describe("superimg-film next-major ergonomics", () => {
  it("passes screen/safeBox to drawTitle, supports layoutBubbles, props on SVG shots, raw AudioClip[], filmMarks, and dissolve transitions", () => {
    let titleCtx: TitleContext | undefined;
    let seenBatches: Array<{ count: number; titleActive: boolean; width: number }> = [];

    const movie = film({
      stage: { width: 1080, height: 1920 },
      size: { width: 1080, height: 1920 },
      fps: 30,
      script: SCRIPT,
      cast: [maya, leo],
      audio: [
        { id: "bed", src: "https://example.com/bed.mp3", role: "music", loop: true },
        { id: "vo-1", src: "https://example.com/vo1.mp3", role: "voice", at: "0.2s" },
      ],
      drawTitle: (_t, title, ctx) => {
        titleCtx = ctx;
        return [vector.text({ x: ctx.screen.width / 2, y: 120, fill: "#fff" }, title)];
      },
      layoutBubbles: (active: readonly BubbleInput[], ctx) => {
        seenBatches.push({ count: active.length, titleActive: ctx.titleActive, width: ctx.screen.width });
        return active.map((b, i) =>
          vector.rect({ x: 40 + i * 200, y: 200, width: 160, height: 60, fill: "#ffffff" }),
        );
      },
      shots: {
        s1: () => ({
          art: `<rect x="0" y="0" width="1080" height="1920" fill="#0f172a"/>`,
          heads: { maya: { x: 300, y: 800 }, leo: { x: 780, y: 800 } },
          props: ["lantern"],
        }),
        s2: () => ({
          art: `<rect x="0" y="0" width="1080" height="1920" fill="#1e293b"/>`,
          heads: { maya: { x: 540, y: 900 } },
          props: ["brass-key"],
        }),
      },
    });

    // Audio timeline with auto-ducking
    const audio = movie.config?.audio;
    expect(audio && typeof audio === "object" && "clips" in audio).toBe(true);
    if (audio && typeof audio === "object" && "clips" in audio) {
      expect(audio.clips).toHaveLength(2);
      expect(audio.mix?.ducking).toBe(true);
    }

    // Breakdown picks up explicit `props` on SVG-string shots
    const breakdown = filmBreakdown(movie);
    expect(breakdown.s1?.props).toEqual(["lantern"]);
    expect(breakdown.s2?.props).toEqual(["brass-key"]);

    // filmMarks() + inspectFilm().marks expose resolved shot & speech timing marks
    const marks = filmMarks(movie);
    expect(marks.total).toBeCloseTo(5, 5);
    expect(marks.shots.map((s) => ({ id: s.id, start: s.start, end: s.end }))).toEqual([
      { id: "s1", start: 0, end: 3 },
      { id: "s2", start: 3, end: 5 },
    ]);
    expect(marks.speech.map((s) => ({ id: s.id, who: s.who, start: s.start }))).toEqual([
      { id: "l1", who: "maya", start: 0.2 },
      { id: "l2", who: "leo", start: 0.4 },
    ]);

    const inspection = inspectFilm(movie);
    expect(inspection.marks.shots).toHaveLength(2);
    expect(inspection.findings.filter((f) => f.code === "BUBBLE_OFF_CANVAS")).toEqual([]);

    // Render mid-s1 (both speakers active + title active)
    seenBatches = [];
    movie.render(fakeCtx(1.0));
    expect(titleCtx?.screen).toEqual({ width: 1080, height: 1920 });
    expect(seenBatches).toEqual([{ count: 2, titleActive: true, width: 1080 }]);

    // Render mid-dissolve at t=3.25s (inside 0.5s dissolve into s2)
    const dissolved = movie.render(fakeCtx(3.25));
    const serialized = JSON.stringify(dissolved);
    expect(serialized).toContain("#0f172a");
    expect(serialized).toContain("#1e293b");
    expect(serialized).toContain("0.5000");
  });
});
