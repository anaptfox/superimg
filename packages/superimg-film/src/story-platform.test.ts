import { describe, expect, it } from "vitest";
import { needsBrowser, vector } from "@superimg/stdlib/tree";
import type { RenderContext } from "@superimg/types";
import {
  cast,
  castLabel,
  castMeta,
  closeOn,
  film,
  inspectFilm,
  paintedBounds,
  prop,
  type BubbleInput,
  type ShotContext,
  type ShotResolver,
} from "./index.js";

const stage = { width: 360, height: 640 };
const screen = { width: 1080, height: 1920 };
const context = <Data>(seconds: number, data: Data) => ({
  ...screen,
  timeline: { seconds },
  data,
}) as RenderContext<Data>;

describe("browser-first & data-first film authoring", () => {
  it("compiles raw Markdown scripts with shot & speech header fields and zero bundler plugins", () => {
    const markdown = [
      "# Lantern Story",
      "",
      "## Porch",
      "",
      "```shot id=porch hold=3",
      "mood: cozy",
      "camera: close",
      "music: hearth-theme",
      "",
      "Mira holds up a lantern.",
      "```",
      "",
      "```speech id=line-1 at=0.4..2.0",
      "who: mira",
      "do: wave",
      "sfx: chime",
      "",
      "Come inside, {guest}!",
      "```",
      "",
    ].join("\n");

    const mira = cast(
      "mira",
      {
        kind: "image",
        src: "https://cdn.example.com/mira-rest.png",
        poses: { wave: "https://cdn.example.com/mira-wave.png" },
        width: 80,
        height: 120,
        head: { x: 0, y: -110 },
        shadow: true,
      },
      { label: "MIRA THE KEEPER", meta: { accent: "#f59e0b" } },
    );

    expect(castLabel(mira)).toBe("MIRA THE KEEPER");
    expect(castMeta(mira)).toEqual({ accent: "#f59e0b" });

    let seenShot: ShotContext<{ guest: string }> | undefined;
    let seenBubble: BubbleInput | undefined;

    const resolver: ShotResolver<{ guest: string }> = {
      has: (id) => id === "porch",
      render: (id, ctx) => {
        if (id !== "porch") return undefined;
        seenShot = ctx;
        const pose = ctx.lines[0]?.fields.do;
        return [
          closeOn({ x: 180, y: 360 }, { zoom: 1.2 }, [
            prop("lantern", vector.circle({ cx: 210, cy: 360, r: 8, fill: "#ffd27a" })),
            mira(ctx.t, { x: 180, y: 420 }, { size: 1, ...(pose === undefined ? {} : { pose }) }),
          ]),
        ];
      },
    };

    const media = film<{ guest: string }>({
      stage,
      size: screen,
      background: "#111827",
      cast: [mira],
      script: markdown,
      shots: resolver,
      data: { guest: "Fox" },
      tokens: ({ guest }) => ({ guest }),
      bubble: (input) => {
        seenBubble = input;
        return [
          vector.rect({ x: 40, y: 40, width: 320, height: 100, fill: "#fff" }),
          vector.text({ x: 60, y: 90, fill: "#111", size: 24 }, `${input.displayName}: ${input.lines[0]}`),
        ];
      },
    });

    const inspection = inspectFilm(media);
    expect(inspection.duration).toBe(3);
    expect(inspection.findings).toEqual([]);
    expect(inspection.cues.map((c) => c.id)).toEqual(["porch", "line-1"]);
    expect(inspection.breakdown).toEqual({
      porch: { cast: ["mira"], props: ["lantern"] },
    });

    const tree = media.render(context(0.8, { guest: "Sam" }));
    expect(seenShot?.fields).toEqual({ camera: "close", mood: "cozy", music: "hearth-theme" });
    expect(seenShot?.section).toBe("Porch");
    expect(seenShot?.text).toBe("Mira holds up a lantern.");
    expect(seenShot?.screen).toEqual(screen);
    expect(seenShot?.lines[0]?.fields).toEqual({ do: "wave", sfx: "chime" });
    expect(seenShot?.lines[0]?.lines).toEqual(["Come inside, Sam!"]);

    expect(seenBubble).toMatchObject({
      id: "line-1",
      who: "mira",
      displayName: "MIRA THE KEEPER",
      castMeta: { accent: "#f59e0b" },
      fields: { do: "wave", sfx: "chime" },
      lines: ["Come inside, Sam!"],
      screen,
    });

    // Pure-Vector film with Vector bubbles stays on the SVG fast lane (Edge/resvg ready).
    expect(typeof tree).toBe("object");
    expect(needsBrowser(tree as never).browser).toBe(false);
  });

  it("supports SvgCutoutSpec cast members, custom shapeRendering, and paintedBounds", () => {
    const sprite = cast(
      "pip",
      {
        kind: "svg",
        viewBox: { width: 40, height: 60 },
        markup: '<circle cx="20" cy="20" r="18" fill="#38bdf8"/>',
        head: { x: 0, y: -56 },
      },
      { label: "PIP" },
    );

    const media = film({
      stage,
      size: screen,
      shapeRendering: "auto",
      cast: [sprite],
      script: "```shot id=s hold=2\nPip.\n```\n\n```speech id=l at=0.2..1.2\nwho: pip\n\nHi!\n```\n",
      shots: { s: ({ t }) => [sprite(t, { x: 180, y: 400 })] },
      bubble: ({ head }) => [vector.image({ href: "data:image/png;base64,AA==", x: head.x - 40, y: head.y - 60, width: 80, height: 40 })],
    });

    const inspection = inspectFilm(media);
    expect(inspection.findings).toEqual([]);
    expect(inspection.breakdown.s?.cast).toEqual(["pip"]);

    const measured = paintedBounds([vector.image({ href: "a.png", x: 10, y: 20, width: 100, height: 50 })]);
    expect(measured.unparseable).toBe(false);
    expect(measured.box).toEqual({ x0: 10, y0: 20, x1: 110, y1: 70 });
  });

  it("checks MISSING_GLYPH against cast display labels rather than raw script ids", () => {
    const fox = cast("dr-fox", { head: { x: 0, y: -50 }, draw: () => [vector.circle({ cx: 0, cy: 0, r: 10 })] }, { label: "DR★FOX" });
    const media = film({
      stage,
      size: screen,
      cast: [fox],
      glyphs: (text) => !text.includes("★"),
      script: "```shot id=s hold=2\nHello.\n```\n\n```speech id=l at=0.2..1.2\nwho: dr-fox\n\nHi.\n```\n",
      shots: { s: ({ t }) => [fox(t, { x: 180, y: 320 })] },
      bubble: () => [vector.rect({ x: 10, y: 10, width: 40, height: 20, fill: "#fff" })],
    });

    const inspection = inspectFilm(media);
    expect(inspection.findings).toEqual([
      expect.objectContaining({ id: "l", code: "MISSING_GLYPH" }),
    ]);
  });

  it("surfaces script parse findings into inspectFilm() without crashing", () => {
    const media = film({
      stage,
      size: screen,
      cast: [cast("mira", { head: { x: 0, y: -50 }, draw: () => [] })],
      script: "```picture id=old hold=2\nLegacy fence.\n```\n",
      shots: { old: () => [] },
      bubble: () => [],
    });
    const inspection = inspectFilm(media);
    expect(inspection.findings).toEqual([
      expect.objectContaining({ id: "old", code: "RENAMED_FENCE" }),
    ]);
  });
});
