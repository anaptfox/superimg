import { createHash } from "node:crypto";
import { cpus, arch, platform } from "node:os";
import { performance } from "node:perf_hooks";
import { Instance, Scene, resolveSceneTree, collectSceneSnapshots } from "@foxworth/superimg";
import { filmData, sampleProcess } from "./model";
import { workpieceVisual } from "./scene";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sorted = (values: number[]) => [...values].sort((a, b) => a - b);
const times = [0, 2.4, 4.5, 2.4, 0, 4.5, 0, 2.4, 4.5];
function resolve(count: number, seconds: number) {
  const pose = sampleProcess(filmData(seconds));
  const tree = Scene({ id: "density", width: 640, height: 360 },
    Array.from({ length: count }, (_, i) => Instance({
      id: `part-${i}`, entityId: `batch.part-${i}`, of: workpieceVisual,
      data: { stamped: pose.stamped }, transform: { scale: 0.2 },
      at: { x: 20 + (i % 25) * 24 + pose.workpieceX / 100, y: 20 + Math.floor(i / 25) * 15 },
    })),
  );
  const start = performance.now();
  const resolved = resolveSceneTree(tree);
  const packet = collectSceneSnapshots(resolved)[0]!;
  return { durationMs: performance.now() - start, packet };
}

const measurements = [100, 500].map(count => {
  const expected = new Map<number, string>();
  for (const t of [0, 2.4, 4.5]) expected.set(t, digest(resolve(count, t).packet));
  const durations = times.map(t => {
    const result = resolve(count, t);
    if (result.packet.instances.length !== count || digest(result.packet) !== expected.get(t)) {
      throw new Error(`Unstable resolved packet for ${count} instances at ${t}s`);
    }
    return result.durationMs;
  });
  const ordered = sorted(durations);
  return { instances: count, samples: times.length, warmups: 3, medianMs: ordered[4],
    minMs: ordered[0], maxMs: ordered.at(-1), durationsMs: durations, deterministicPackets: true };
});
console.log(JSON.stringify({
  measuredAt: new Date().toISOString(), node: process.version, platform: platform(), arch: arch(),
  cpu: cpus()[0]?.model, logicalCpus: cpus().length,
  operation: "resolveSceneTree + collectSceneSnapshots; authored construction and digest excluded",
  measurements,
}, null, 2));
