import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCheck } from "./check.js";
import { breakdownTable, filmBreakdownCommand, filterBreakdown } from "./film.js";

const originalCwd = process.cwd();
const roots: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  process.chdir(originalCwd);
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createFilmFixture(options: { plantJarInBreakfast: boolean }): Promise<{
  root: string;
  mediaPath: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "superimg-film-breakdown-"));
  roots.push(root);
  process.chdir(root);
  await writeFile(join(root, "package.json"), '{"type":"module"}\n');

  await writeFile(
    join(root, "story.script.md"),
    [
      "# Breakfast and Supper",
      "",
      "```shot id=breakfast hold=2.0",
      "Pig and sheep sit at the table.",
      "```",
      "",
      "```shot id=walk hold=2.0",
      "Pig walks along the path alone.",
      "```",
      "",
      "```shot id=supper hold=2.5",
      "Pig and sheep share supper.",
      "```",
      "",
      "```speech id=pass-jar at=0.3..1.8",
      "who: pig",
      "",
      "Pass the cinnamon jar, please.",
      "```",
      "",
    ].join("\n"),
  );

  const mediaPath = join(root, "film.media.ts");
  await writeFile(
    mediaPath,
    `
      import { cast, film, prop, r } from "@foxworth/superimg/film";
      import script from "./story.script.md";

      const pig = cast("pig", { head: { x: 0, y: -12 }, draw: () => [r(0, 0, 14, 14, "#f3a8b8")] });
      const sheep = cast("sheep", { head: { x: 0, y: -12 }, draw: () => [r(0, 0, 14, 14, "#eef2f5")] });
      const cinnamonJar = prop("cinnamon-jar", (x: number, y: number) => [r(x, y, 8, 12, "#c87a3b")]);

      const shots = {
        breakfast: ({ t }: { t: number }) => [
          pig(t, { x: 90, y: 120 }),
          sheep(t, { x: 220, y: 120 }),
          ${options.plantJarInBreakfast ? "cinnamonJar(155, 118)," : ""}
        ],
        walk: ({ t }: { t: number }) => [
          pig(t, { x: 140, y: 120 }),
        ],
        supper: ({ t }: { t: number }) => [
          pig(t, { x: 90, y: 120 }),
          sheep(t, { x: 220, y: 120 }),
          cinnamonJar(155, 118),
        ],
      };

      export default film({
        stage: { width: 320, height: 180 },
        size: { width: 320, height: 180 },
        fps: 10,
        background: "#101820",
        cast: [pig, sheep],
        bubble: () => "",
        script,
        shots: [shots],
      });
    `,
  );

  return { root, mediaPath };
}

describe("film breakdown formatting & filtering", () => {
  const sample = {
    breakfast: { cast: ["pig", "sheep"], props: ["cinnamon-jar"] },
    walk: { cast: ["pig"], props: [] },
    supper: { cast: ["pig", "sheep"], props: ["cinnamon-jar", "spoon"] },
  };

  it("renders a shots x subjects table", () => {
    const lines = breakdownTable(sample);
    expect(lines).toHaveLength(5);
    expect(lines[0]).toMatch(/^Shot\s+Cast\s+Props$/);
    expect(lines[2]).toContain("breakfast");
    expect(lines[2]).toContain("pig, sheep");
    expect(lines[2]).toContain("cinnamon-jar");
    expect(lines[3]).toContain("walk");
    expect(lines[3]).toContain("-");
  });

  it("filters shots with --with intersection and hyphen/space normalization", () => {
    expect(Object.keys(filterBreakdown(sample, ["pig", "sheep"]))).toEqual(["breakfast", "supper"]);
    expect(Object.keys(filterBreakdown(sample, ["Cinnamon Jar"]))).toEqual(["breakfast", "supper"]);
    expect(Object.keys(filterBreakdown(sample, ["pig", "spoon"]))).toEqual(["supper"]);
    expect(Object.keys(filterBreakdown(sample, ["robot"]))).toEqual([]);
  });
});

describe("superimg film breakdown & continuity gate", { concurrent: false }, () => {
  it("prints breakdown table, supports --with filtering, and outputs --json", async () => {
    const { mediaPath } = await createFilmFixture({ plantJarInBreakfast: true });

    const logged: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      logged.push(String(line));
    });

    await filmBreakdownCommand(mediaPath, {});
    expect(logged.join("\n")).toContain("breakfast");
    expect(logged.join("\n")).toContain("walk");
    expect(logged.join("\n")).toContain("supper");
    expect(logged.join("\n")).toContain("cinnamon-jar");

    logged.length = 0;
    await filmBreakdownCommand(mediaPath, { with: ["pig", "sheep"], json: true });
    const parsed = JSON.parse(logged.join("\n"));
    expect(parsed.ok).toBe(true);
    expect(parsed.with).toEqual(["pig", "sheep"]);
    expect(parsed.shots).toEqual([
      { id: "breakfast", cast: ["pig", "sheep"], props: ["cinnamon-jar"] },
      { id: "supper", cast: ["pig", "sheep"], props: ["cinnamon-jar"] },
    ]);
    expect(parsed.breakdown).toEqual({
      breakfast: { cast: ["pig", "sheep"], props: ["cinnamon-jar"] },
      supper: { cast: ["pig", "sheep"], props: ["cinnamon-jar"] },
    });
  });

  it("gate check: removing a prop from an early shot makes check fail with PROP_NOT_PLANTED at a later shot", async () => {
    const planted = await createFilmFixture({ plantJarInBreakfast: true });
    const plantedReport = await runCheck(planted.mediaPath, { at: "f:0" });
    expect(plantedReport.issues.filter((i) => i.code === "PROP_NOT_PLANTED")).toEqual([]);
    expect(plantedReport.ok).toBe(true);

    const unplanted = await createFilmFixture({ plantJarInBreakfast: false });
    const unplantedReport = await runCheck(unplanted.mediaPath, { at: "f:0" });
    expect(unplantedReport.ok).toBe(false);
    expect(unplantedReport.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "PROP_NOT_PLANTED",
        nodeId: "supper",
      }),
    );
  });
});
