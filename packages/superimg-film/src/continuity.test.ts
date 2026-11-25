import { describe, expect, it } from "vitest";
import { vector } from "@superimg/stdlib/tree";
import { cast, closeOn, film, filmBreakdown, place, prop, r } from "./index.js";
import { subjectOf } from "./cast.js";
import type { ScriptBlock, Series, Shot } from "./types.js";

const pig = cast("pig", { head: { x: 0, y: -10 }, draw: () => [r(0, 0, 10, 10, "#f9c")] });
const sheep = cast("sheep", { head: { x: 0, y: -10 }, draw: () => [r(0, 0, 10, 10, "#eee")] });
const robot = cast("robot", { head: { x: 0, y: -10 }, draw: () => [r(0, 0, 10, 10, "#9cf")] });

const cinnamonJar = prop("cinnamon-jar", (x: number, y: number, opacity = 1) =>
  vector.group({ opacity }, place(x, y, [r(0, 0, 8, 12, "#c87a3b")])),
);

const BASE_SERIES: Series = {
  stage: { width: 320, height: 180 },
  size: { width: 320, height: 180 },
  cast: [pig, sheep, robot],
  bubble: () => "",
};

const RESOLVE_INPUT = {
  data: {},
  config: { width: 320, height: 180 },
  asset: (f: string) => f,
  assets: {},
};

function makeScript(blocks: ScriptBlock[]) {
  return { version: 1, hash: "test", blocks };
}

function makeShots(map: Record<string, Shot>) {
  return [map];
}

describe("identity: prop() and cast() subject tags", () => {
  it("tags cast() and prop() groups with their subject", () => {
    expect(subjectOf(pig(0, { x: 40, y: 80 }))).toEqual({ id: "pig", kind: "cast" });
    expect(subjectOf(cinnamonJar(20, 30))).toEqual({ id: "cinnamon-jar", kind: "prop" });
    expect(subjectOf(prop("brass-key", [r(0, 0, 4, 4, "#fb0")]))).toEqual({ id: "brass-key", kind: "prop" });
  });

  it("allows the same subject twice in one frame, as in a match cut", async () => {
    const twice: Shot = () => [cinnamonJar(10, 10), cinnamonJar(60, 10), pig(0, { x: 40, y: 80 }), pig(0, { x: 140, y: 80 })];
    const media = film({
      ...BASE_SERIES,
      script: makeScript([{ kind: "shot", id: "twice", section: null, fields: {}, text: "Two jars.", hold: 1 } as ScriptBlock]),
      shots: makeShots({ twice }),
    });
    const tree = (media as unknown as { render: (ctx: unknown) => unknown }).render;
    expect(typeof tree).toBe("function");
    expect(JSON.stringify(media)).not.toContain("semantic");
    const breakdown = await filmBreakdown(media);
    expect(breakdown.twice).toEqual({ cast: ["pig"], props: ["cinnamon-jar"] });
  });

  it("rejects empty or whitespace-only names", () => {
    expect(() => prop("   ", [])).toThrow(/non-empty/);
    expect(() => cast("", { head: { x: 0, y: 0 }, draw: () => [] })).toThrow(/non-empty/);
  });
});

describe("breakdown and filmBreakdown()", () => {
  it("samples still, start, middle, and end and filters out zero-opacity subjects", async () => {
    const media = film({
      ...BASE_SERIES,
      script: makeScript([
        { kind: "shot", id: "opening", hold: 4, still: 1 },
        { kind: "shot", id: "hidden", hold: 2 },
      ]),
      shots: makeShots({
        opening: ({ t, duration }) => [
          // Present at start (t = 0) only
          ...(t === 0 ? [prop("start-prop", r(0, 0, 5, 5, "#fff"))] : []),
          // Present at still (t = 1) only
          ...(t === 1 ? [closeOn({ x: 100, y: 100 }, { zoom: 1.5 }, [pig(t, { x: 100, y: 100 })])] : []),
          // Present at middle (t = 2) only
          ...(t === duration / 2 ? [cinnamonJar(10, 10)] : []),
          // Present at end (t = 4) only
          ...(t === duration ? [sheep(t, { x: 200, y: 100 })] : []),
        ],
        hidden: ({ t }) => [
          pig(t, { x: 40, y: 80 }, { opacity: 0 }),
          cinnamonJar(10, 10, 0),
          vector.group({ opacity: 0 }, prop("veiled-map", r(0, 0, 5, 5, "#fff"))),
          prop("hidden-style", vector.rect({ x: 0, y: 0, width: 5, height: 5, style: { display: "none" } })),
          sheep(t, { x: 120, y: 80 }),
        ],
      }),
    });

    const expected = {
      opening: { cast: ["pig", "sheep"], props: ["cinnamon-jar", "start-prop"] },
      hidden: { cast: ["sheep"], props: [] },
    };

    expect(filmBreakdown(media)).toEqual(expected);
    // Survives shallow cloning (as CLI cascading config wrapper does)
    expect(filmBreakdown({ ...media })).toEqual(expected);

    const resolved = await media.resolve!(RESOLVE_INPUT);
    expect(resolved.breakdown).toEqual(expected);
  });
});

describe("breakdown robustness", () => {
  it("catches a prop that appears only briefly between the start, middle, and end", () => {
    const media = film({
      ...BASE_SERIES,
      script: makeScript([{ kind: "shot", id: "quick", hold: 8, still: 0 }]),
      shots: makeShots({
        quick: ({ t }) => [pig(t, { x: 80, y: 120 }), ...(t >= 1.9 && t <= 2.1 ? [cinnamonJar(140, 120)] : [])],
      }),
    });
    expect(filmBreakdown(media)).toEqual({ quick: { cast: ["pig"], props: ["cinnamon-jar"] } });
  });

  it("ignores a semantic group that draws nothing", () => {
    const media = film({
      ...BASE_SERIES,
      script: makeScript([{ kind: "shot", id: "empty", hold: 2 }]),
      shots: makeShots({ empty: () => [prop("ghost", []), cast("nobody", { head: { x: 0, y: 0 }, draw: () => [] })(0, { x: 0, y: 0 }), sheep(0, { x: 40, y: 40 })] }),
    });
    expect(filmBreakdown(media)).toEqual({ empty: { cast: ["sheep"], props: [] } });
  });

  it("does not let a drawer that throws at an unrendered time break resolve()", async () => {
    const media = film({
      ...BASE_SERIES,
      script: makeScript([{ kind: "shot", id: "fragile", hold: 4, still: 1 }]),
      shots: makeShots({
        fragile: ({ t, duration }) => {
          if (t === duration) throw new Error("never drawn at the very end");
          return [pig(t, { x: 80, y: 120 })];
        },
      }),
    });
    const resolved = await media.resolve!(RESOLVE_INPUT);
    expect(resolved.breakdown).toEqual({ fragile: { cast: ["pig"], props: [] } });
  });

  it("adds no continuity findings to a film that tags no props and leaves continuity unset", async () => {
    const media = film({
      ...BASE_SERIES,
      script: makeScript([
        { kind: "shot", id: "a", hold: 2, text: "A cinnamon jar sits on the table." },
        { kind: "shot", id: "b", hold: 2, text: "Pig lifts the cinnamon jar." },
        { kind: "speech", id: "line", who: "robot", lines: ["Hello pig, pass the jar."] },
      ]),
      shots: makeShots({
        a: ({ t }) => [pig(t, { x: 80, y: 120 })],
        b: ({ t }) => [robot(t, { x: 80, y: 120 })],
      }),
    });
    const resolved = await media.resolve!(RESOLVE_INPUT);
    expect((resolved.cueFindings ?? []).filter((f) => f.code === "PROP_NOT_PLANTED" || f.code === "CAST_UNMET")).toEqual([]);
  });
});

describe("continuity findings: PROP_NOT_PLANTED", () => {
  it("flags a prop named in a later shot's speech or description when never planted earlier", async () => {
    const media = film({
      ...BASE_SERIES,
      script: makeScript([
        { kind: "shot", id: "breakfast", hold: 2, text: "Pig and Sheep eat toast." },
        { kind: "shot", id: "supper", hold: 3, text: "Pig reaches across the table." },
        { kind: "speech", id: "pass-jar", who: "pig", lines: ["Pass the cinnamon jar, please."] },
      ]),
      shots: makeShots({
        breakfast: ({ t }) => [pig(t, { x: 80, y: 120 }), sheep(t, { x: 200, y: 120 })],
        supper: ({ t }) => [pig(t, { x: 80, y: 120 }), sheep(t, { x: 200, y: 120 }), cinnamonJar(140, 120)],
      }),
    });

    const resolved = await media.resolve!(RESOLVE_INPUT);
    expect(resolved.cueFindings).toContainEqual(expect.objectContaining({
      id: "supper",
      code: "PROP_NOT_PLANTED",
    }));
  });

  it("clears PROP_NOT_PLANTED once the prop appears in an earlier shot", async () => {
    const media = film({
      ...BASE_SERIES,
      script: makeScript([
        { kind: "shot", id: "breakfast", hold: 2, text: "A cinnamon-jar sits on the table." },
        { kind: "shot", id: "supper", hold: 3, text: "Pig reaches for the CINNAMON JAR." },
        { kind: "speech", id: "pass-jar", who: "pig", lines: ["Pass the cinnamon jar."] },
      ]),
      shots: makeShots({
        breakfast: ({ t }) => [pig(t, { x: 80, y: 120 }), cinnamonJar(140, 120)],
        supper: ({ t }) => [pig(t, { x: 80, y: 120 }), cinnamonJar(140, 120)],
      }),
    });

    const resolved = await media.resolve!(RESOLVE_INPUT);
    expect(resolved.cueFindings?.filter((f) => f.code === "PROP_NOT_PLANTED")).toEqual([]);
  });

  it("matches shot descriptions with hyphen/space equivalence and respects word boundaries", async () => {
    const jar = prop("jar", r(0, 0, 6, 8, "#c87a3b"));
    const media = film({
      ...BASE_SERIES,
      script: makeScript([
        { kind: "shot", id: "s1", hold: 2, text: "Morning light." },
        { kind: "shot", id: "s2", hold: 2, text: "The door is ajar and full of jargon." },
        { kind: "shot", id: "s3", hold: 2, text: "Pig opens the cinnamon jar." },
      ]),
      shots: makeShots({
        s1: ({ t }) => [pig(t, { x: 80, y: 120 })],
        s2: ({ t }) => [pig(t, { x: 80, y: 120 })],
        s3: ({ t }) => [pig(t, { x: 80, y: 120 }), jar, cinnamonJar(120, 120)],
      }),
    });

    const resolved = await media.resolve!(RESOLVE_INPUT);
    const propFindings = (resolved.cueFindings ?? []).filter((f) => f.code === "PROP_NOT_PLANTED");
    // s2 ("ajar", "jargon") must NOT trigger "jar"; s3 ("cinnamon jar") triggers both "jar" and "cinnamon-jar".
    expect(propFindings.map((f) => f.id)).toEqual(["s3", "s3"]);
  });

  it("enforces replantAfter only when configured", async () => {
    const script = makeScript([
      { kind: "shot", id: "s1", hold: 2 },
      { kind: "shot", id: "s2", hold: 2 },
      { kind: "shot", id: "s3", hold: 2 },
      { kind: "shot", id: "s4", hold: 2 },
    ]);
    const shots = [{
      s1: ({ t }: { t: number }) => [pig(t, { x: 80, y: 120 }), cinnamonJar(120, 120)],
      s2: ({ t }: { t: number }) => [pig(t, { x: 80, y: 120 })],
      s3: ({ t }: { t: number }) => [pig(t, { x: 80, y: 120 })],
      s4: ({ t }: { t: number }) => [pig(t, { x: 80, y: 120 }), cinnamonJar(120, 120)],
    }];

    // Default off: no finding even though absent for 2 shots (s2, s3)
    const off = await film({ ...BASE_SERIES, script, shots }).resolve!(RESOLVE_INPUT);
    expect(off.cueFindings?.filter((f) => f.code === "PROP_NOT_PLANTED")).toEqual([]);

    // replantAfter: 3 -> absent for 2 shots is OK
    const loose = await film({ ...BASE_SERIES, continuity: { replantAfter: 3 }, script, shots }).resolve!(RESOLVE_INPUT);
    expect(loose.cueFindings?.filter((f) => f.code === "PROP_NOT_PLANTED")).toEqual([]);

    // replantAfter: 2 -> absent for 2 shots triggers PROP_NOT_PLANTED at s4
    const strict = await film({ ...BASE_SERIES, continuity: { replantAfter: 2 }, script, shots }).resolve!(RESOLVE_INPUT);
    expect(strict.cueFindings).toContainEqual(expect.objectContaining({
      id: "s4",
      code: "PROP_NOT_PLANTED",
    }));
  });
});

describe("continuity findings: CAST_UNMET", () => {
  const script = makeScript([
    { kind: "shot", id: "meet", hold: 2 },
    { kind: "shot", id: "chat", hold: 3 },
    { kind: "speech", id: "pig-line", who: "pig", lines: ["Good morning, sheep."] },
    { kind: "shot", id: "supper", hold: 3 },
    { kind: "speech", id: "robot-line", who: "robot", lines: ["Hello everyone."] },
    { kind: "shot", id: "solo", hold: 3 },
    { kind: "speech", id: "sheep-calls-robot", who: "sheep", lines: ["Where did pig go?"] },
  ]);
  const shots = [{
    meet: ({ t }: { t: number }) => [pig(t, { x: 80, y: 120 }), sheep(t, { x: 200, y: 120 })],
    chat: ({ t }: { t: number }) => [pig(t, { x: 80, y: 120 }), sheep(t, { x: 200, y: 120 })],
    supper: ({ t }: { t: number }) => [robot(t, { x: 80, y: 120 }), sheep(t, { x: 200, y: 120 })],
    solo: ({ t }: { t: number }) => [sheep(t, { x: 160, y: 120 })],
  }];

  it("is off by default and adds no findings to existing films", async () => {
    const resolved = await film({ ...BASE_SERIES, script, shots }).resolve!(RESOLVE_INPUT);
    expect(resolved.cueFindings?.filter((f) => f.code === "CAST_UNMET")).toEqual([]);
  });

  it("flags speakers with unmet co-present or addressed cast when introductions is true", async () => {
    const resolved = await film({
      ...BASE_SERIES,
      continuity: { introductions: true },
      script,
      shots,
    }).resolve!(RESOLVE_INPUT);

    const unmet = (resolved.cueFindings ?? []).filter((f) => f.code === "CAST_UNMET");
    // pig + sheep met in "meet" -> chat & solo addressing pig are both clean.
    // robot has never shared a shot with sheep before "supper" -> flagged at robot-line.
    expect(unmet.map((f) => f.id)).toEqual(["robot-line"]);
    expect(unmet[0]?.message).toContain("robot");
    expect(unmet[0]?.message).toContain("sheep");
  });

  it("flags addressing an off-screen cast member the speaker has never met", async () => {
    const resolved = await film({
      ...BASE_SERIES,
      continuity: { introductions: true },
      script: makeScript([
        { kind: "shot", id: "only-pig", hold: 3 },
        { kind: "speech", id: "call-robot", who: "pig", lines: ["Hey robot, come over!"] },
      ]),
      shots: makeShots({
        "only-pig": ({ t }) => [pig(t, { x: 160, y: 120 })],
      }),
    }).resolve!(RESOLVE_INPUT);

    const unmet = (resolved.cueFindings ?? []).filter((f) => f.code === "CAST_UNMET");
    expect(unmet).toHaveLength(1);
    expect(unmet[0]).toMatchObject({ id: "call-robot", code: "CAST_UNMET" });
    expect(unmet[0]?.message).toContain("robot");
  });
});
