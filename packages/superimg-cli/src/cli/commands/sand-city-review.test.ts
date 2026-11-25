import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ReviewPlan } from "@foxworth/superimg";
import { loadDataScript } from "../utils/data-loader";
import { parseAtList, resolveAtSample } from "../utils/inspect-at";
import { evaluateReviewAssertions, observeReviewBeat } from "../utils/review-packet";

const config = { width: 1280, height: 720, fps: 30, duration: 24, totalFrames: 720 };
interface CityFrame { seconds: number; width: number; height: number; assembly: number; collapse: number }
interface CityModel {
  renderCity(frame: CityFrame): unknown;
  inspectCity(frame: CityFrame): {
    camera: { finite: boolean; insideBuilding: boolean };
    grains: { visibleBuilding: number; [metric: string]: number };
  };
}
let plan: ReviewPlan;
let currentModel: CityModel;
let modelSource: string;
let temporaryDirectory: string;
beforeAll(async () => {
  temporaryDirectory = mkdtempSync(join(tmpdir(), "superimg-city-review-"));
  const engine = fileURLToPath(new URL("../../../../../examples/showcase/sand-city/city-particles.ts", import.meta.url));
  const companion = fileURLToPath(new URL("../../../../../examples/showcase/sand-city/sand-city.review.ts", import.meta.url));
  const publicEntry = fileURLToPath(new URL("../../../../superimg/dist/index.js", import.meta.url));
  modelSource = readFileSync(engine, "utf8").replace('from "@foxworth/superimg"', `from ${JSON.stringify(publicEntry)}`);
  const current = join(temporaryDirectory, "current-camera.ts");
  writeFileSync(current, `${modelSource}\nexport default { renderCity, inspectCity };\n`);
  // Black-box loading keeps authored files outside the CLI's compilation root
  // while exercising their exact current implementations and bundled imports.
  currentModel = await loadDataScript(current) as CityModel;
  plan = await loadDataScript(companion) as ReviewPlan;
});
afterAll(() => { if (temporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true }); });

function frameAt(seconds: number): CityFrame {
  return { seconds, width: config.width, height: config.height,
    assembly: Math.max(0, Math.min(1, (seconds - .5) / 3)),
    collapse: Math.max(0, Math.min(1, (seconds - 19) / 3)) };
}

describe("sand city review acceptance", () => {
  it("checks the real city at the exact authored poses used by its captured frames", () => {
    const review: ReviewPlan = plan;
    for (const beat of review.beats) {
      const resolved = resolveAtSample(parseAtList(beat.at)[0]!, config);
      const progress = resolved.frame / (config.totalFrames - 1);
      const observed = observeReviewBeat(review, { ...resolved, progress, ...config, data: {} });
      expect(observed.observationError, beat.id).toBeUndefined();
      const checks = evaluateReviewAssertions(review.checks ?? [], beat.id, observed.observation);
      expect(checks.length).toBeGreaterThan(0);
      expect(checks.every(check => check.status === "pass"), JSON.stringify({ beat: beat.id, checks })).toBe(true);
    }
  });

  it("rejects the original empty-sky camera while its finite, collision-free geometry still passes", async () => {
    const correctedGaze = "(eyeY - street.y) * (1 - ease((seconds - 17) / 1.4))";
    expect(modelSource).toContain(correctedGaze);
    const oldSource = modelSource.replace(correctedGaze, "(eyeY - street.y)");
    const path = join(temporaryDirectory, "old-camera.ts");
    writeFileSync(path, `${oldSource}\nexport default { renderCity, inspectCity };\n`);
    const oldModel = await loadDataScript(path) as CityModel;
    const resolved = resolveAtSample(parseAtList("17.7s")[0]!, config);
    const old = oldModel.inspectCity(frameAt(resolved.timelineSeconds));
    const current = currentModel.inspectCity(frameAt(resolved.timelineSeconds));
    expect(old.camera.finite).toBe(true);
    expect(old.camera.insideBuilding).toBe(false);
    expect(old.grains.visibleBuilding).toBeLessThan(100);
    expect(current.grains.visibleBuilding).toBeGreaterThanOrEqual(100);
    const check = plan.checks!.find(check => check.id === "lift-architecture")!;
    expect(evaluateReviewAssertions([check], "lift", { grains: { ...old.grains } })[0]!.status).toBe("fail");
    expect(evaluateReviewAssertions([check], "lift", { grains: { ...current.grains } })[0]!.status).toBe("pass");
  });

  it("reproduces paint and observations after out-of-order seeks", () => {
    const samples = [4.4, 8, 12.8, 17.7, 18, 20.5, 23.5];
    const digest = (seconds: number) => createHash("sha256").update(JSON.stringify({
      paint: currentModel.renderCity(frameAt(seconds)), observation: currentModel.inspectCity(frameAt(seconds)),
    })).digest("hex");
    const expected = new Map(samples.map(seconds => [seconds, digest(seconds)]));
    for (const seconds of [23.5, 12.8, 4.4, 20.5, 18, 8, 17.7, 4.4]) expect(digest(seconds)).toBe(expected.get(seconds));
  });
});
