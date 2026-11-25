import { describe, expect, it } from "vitest";
import {
  INITIAL_SANDGLASS, scheduleRequests, sampleFilmClock, sampleSandglass,
  validateSnapshot, canonicalAudioEvents, filmTimeForSimulation, pilePosition,
} from "./model";

describe("the finite Sandglass queue", () => {
  it("matches canonical FIFO completion, wait, and request-seventeen facts", () => {
    const slow = scheduleRequests(2, 2);
    const fast = scheduleRequests(4, 2);
    expect(slow.at(-1)?.end).toBe(49);
    expect(fast.at(-1)?.end).toBe(26);
    expect(slow.reduce((sum, job) => sum + job.wait, 0) / 48).toBe(11.5);
    expect(fast.every(job => job.wait === 0)).toBe(true);
    expect(slow[16]).toMatchObject({ id: 17, arrival: 8.5, start: 16.5, end: 18.5, wait: 8 });
    expect(fast[16]?.end).toBe(10.5);
  });

  it("assigns arrivals, service starts, and completions inclusively", () => {
    const at = (t: number) => sampleSandglass(INITIAL_SANDGLASS, { logicalSeconds: t }).systems;
    expect(at(0)[0]?.counts).toMatchObject({ supply: 48, arrived: 0, processing: 0, waiting: 0, completed: 0 });
    expect(at(.5)[0]?.requests[0]).toMatchObject({ state: "processing", progress: 0 });
    expect(at(2.5)[0]?.requests[0]?.state).toBe("completed");
    expect(at(12)[0]?.counts).toMatchObject({ arrived: 24, completed: 10, processing: 2, waiting: 12 });
    expect(at(12)[1]?.counts).toMatchObject({ arrived: 24, completed: 20, processing: 4, waiting: 0 });
    expect(at(24)[0]?.counts).toMatchObject({ arrived: 48, completed: 22, processing: 2, waiting: 24 });
    expect(at(24)[1]?.counts).toMatchObject({ arrived: 48, completed: 44, processing: 4, waiting: 0 });
  });

  it("conserves exclusive states and discrete channels for every live setting", () => {
    for (let workers = 1; workers <= 6; workers++) {
      for (let arrivalRate = .5; arrivalRate <= 6; arrivalRate += .5) {
        const data = { ...INITIAL_SANDGLASS, workers, arrivalRate };
        const schedule = scheduleRequests(workers, arrivalRate);
        const times = [0, 98, ...schedule.flatMap(job => [job.arrival - .0001, job.arrival, job.start, job.end - .0001, job.end])];
        for (const logicalSeconds of times) {
          const snapshot = sampleSandglass(data, { logicalSeconds });
          expect(validateSnapshot(snapshot)).toEqual([]);
          expect(snapshot.systems[0]!.requests.every(job => job.state === "supply" ? job.y < 210
            : job.state === "waiting" ? job.y >= 250 && job.y <= 330
              : job.state === "processing" ? job.y >= 359 && job.y <= 423
                : job.y >= 464 && job.y <= 534)).toBe(true);
        }
      }
    }
  }, 20_000);

  it("does not color a request using future wait and freezes after service starts", () => {
    const request = (logicalSeconds: number) => sampleSandglass(INITIAL_SANDGLASS, { logicalSeconds }).systems[0]!.requests[16]!;
    expect(request(8).visibleWait).toBe(0);
    expect(request(8.5).visibleWait).toBe(0);
    expect(request(12).visibleWait).toBe(3.5);
    expect(request(16.5).visibleWait).toBe(8);
    expect(request(17).visibleWait).toBe(8);
    expect(request(49).visibleWait).toBe(8);
  });

  it("is stable under shuffled seeks and protects all grains in Reduced", () => {
    const before = sampleSandglass(INITIAL_SANDGLASS, { logicalSeconds: 12 });
    for (const logicalSeconds of [49, .5, 24, 0, 17, 2.5]) sampleSandglass(INITIAL_SANDGLASS, { logicalSeconds });
    expect(sampleSandglass(INITIAL_SANDGLASS, { logicalSeconds: 12 })).toEqual(before);
    expect(sampleSandglass({ ...INITIAL_SANDGLASS, fidelity: "reduced" }, { logicalSeconds: 12 })).toEqual(before);
    expect(before.logicalGrains).toBe(1152);
    expect(before.drawnGrains).toBe(1152);
    expect(new Set(Array.from({ length: 48 }, (_, i) => JSON.stringify(pilePosition(i)))).size).toBe(48);
  });

  it("detects faulty duplication, early completion, and future wait fixtures", () => {
    const good = sampleSandglass(INITIAL_SANDGLASS, { logicalSeconds: 12 });
    const primary = good.systems[0]!;
    const mutate = (index: number, patch: Record<string, unknown>) => ({
      ...good, systems: [{ ...primary, requests: primary.requests.map((request, i) => i === index ? { ...request, ...patch } : request) }, good.systems[1]!],
    });
    expect(validateSnapshot(mutate(16, { clusterId: primary.requests[0]!.clusterId }))).toContain("primary:population");
    expect(validateSnapshot(mutate(16, { state: "completed" }))).toContain("primary-request-17:premature-state");
    expect(validateSnapshot(mutate(16, { visibleWait: 8 }))).toContain("primary-request-17:future-wait");
  });

  it("rejects settings outside the live contract", () => {
    for (const [workers, rate] of [[0, 2], [7, 2], [2.5, 2], [2, .25], [2, 6.5], [2, NaN]]) expect(() => scheduleRequests(workers!, rate!)).toThrow();
    expect(() => sampleFilmClock(NaN)).toThrow();
    expect(() => sampleSandglass(INITIAL_SANDGLASS, { logicalSeconds: -1 })).toThrow();
  });
});

describe("authored clocks and score cues", () => {
  it("uses the specified speeds and settled holds", () => {
    for (const [filmSeconds, logicalSeconds, speed] of [[0, 0, 0], [3, 0, 1], [7, 4, 1], [15, 12, 0], [19, 12, 2], [25, 24, 0], [27, 24, 3.125], [35, 49, 0], [40, 49, 0]]) {
      expect(sampleFilmClock(filmSeconds!)).toMatchObject({ logicalSeconds, speed });
    }
    expect(sampleFilmClock(27.64).logicalSeconds).toBeCloseTo(26, 12);
  });

  it("emits each real event once at its first reached model instant", () => {
    const events = canonicalAudioEvents();
    expect(events).toHaveLength(288);
    expect(new Set(events.map(event => event.id)).size).toBe(288);
    expect(events.find(event => event.id === "comparison/48/completion")?.filmSeconds).toBeCloseTo(27.64, 12);
    expect(filmTimeForSimulation(12)).toBe(15);
    expect(filmTimeForSimulation(24)).toBe(25);
    expect(filmTimeForSimulation(49)).toBe(35);
    for (const event of events) {
      expect(sampleFilmClock(event.filmSeconds).logicalSeconds).toBeCloseTo(event.simulationSeconds, 10);
      expect(Math.round(event.filmSeconds * 48000)).toBeGreaterThanOrEqual(0);
    }
  });
});
