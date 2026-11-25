import { describe, expect, it } from 'vitest';
import { buildQualification, choosePreview, fetchQualification, type QualificationInput } from './qualification.ts';
import type { StudyId } from './studies.ts';

const ids: StudyId[] = ['sandglass', 'cleft', 'returning-shore', 'borrowed-shapes', 'aster-basin'];
const current = Object.fromEntries(ids.map(id => [id, `source:${id}`])) as Record<StudyId, string>;
function reports(): QualificationInput[] {
  return ids.flatMap(study => (['full', 'reduced'] as const).map(fidelity => ({ report: `${study}-${fidelity}.json`, sourceDigest: current[study], record: {
    study, fidelity, measured: true, sourceStable: true, defaultQualified: true, meetsLiveBudget: true, heldScenesIdle: true,
    repetitions: 3, warmupMs: 10_000, durationMs: 60_000, environment: { isolation: 'operator-confirmed' },
    configuration: { userAgent: 'Chromium test', platform: 'test', viewport: { width: 1440, height: 1100 }, dpr: 1, logicalCount: 18000, drawnCount: fidelity === 'full' ? 18000 : 9545 },
    measurementContext: { headless: true, physicalDeviceAcceptance: false, cpu: 'test cpu', cpuCount: 8, memoryBytes: 1024, platform: 'test', osRelease: 'test' },
    runs: (['hold', 'auto', 'interaction'] as const).flatMap(mode => [1, 2, 3].map(run => ({ mode, run, durationMs: 60_000, accepted: mode === 'hold' ? 0 : 1800, failures: 0, inputLatencyMs: { p95: mode === 'hold' ? null : 12 } }))),
  } })));
}

describe('preview qualification', () => {
  it('prefers qualified Full and describes the measured scope without pixel-coverage claims', () => {
    const doc = buildQualification(reports(), current);
    const choice = choosePreview('returning-shore', current['returning-shore'], doc);
    expect(choice.fidelity).toBe('full'); expect(choice.basis).toBe('qualified');
    expect(choice.message).toContain('headless'); expect(choice.message).toContain('test cpu');
    expect(choice.qualification?.counts).toEqual({ logical: 18000, drawingPool: 18000, projectedInView: null });
  });
  it('selects Reduced only when Full misses a measured budget and retains an explicit Full choice', () => {
    const inputs = reports(); inputs[0]!.record.runs[3]!.inputLatencyMs.p95 = 150;
    const doc = buildQualification(inputs, current);
    expect(doc.studies.sandglass.defaultFidelity).toBe('reduced');
    expect(choosePreview('sandglass', current.sandglass, doc).fidelity).toBe('reduced');
    const explicit = choosePreview('sandglass', current.sandglass, doc, 'full');
    expect(explicit.basis).toBe('explicit'); expect(explicit.fidelity).toBe('full'); expect(explicit.qualification).toBeNull(); expect(explicit.message).toContain('this profile did not qualify');
  });
  it('rejects stale sources, short runs, busy holds and incomplete run matrices despite pass flags', () => {
    const inputs = reports(); inputs[0]!.sourceDigest = 'old'; inputs[1]!.record.durationMs = 100;
    inputs[2]!.record.runs[0]!.accepted = 1; inputs[3]!.record.runs.pop();
    const doc = buildQualification(inputs, current);
    expect(doc.studies.sandglass.defaultFidelity).toBeNull(); expect(doc.studies.cleft.defaultFidelity).toBeNull();
    expect(doc.studies.sandglass.profiles.full.reasons).toContain('source changed since measurement');
    expect(doc.studies.cleft.profiles.full.reasons).toContain('held scene did not idle');
    expect(doc.studies.cleft.profiles.reduced.reasons).toContain('incomplete run matrix');
    expect(choosePreview('borrowed-shapes', 'new', doc).message).toContain('source changed');
  });
  it('requires exactly ten distinct study/profile reports', () => {
    expect(() => buildQualification(reports().slice(1), current)).toThrow('all ten');
    const inputs = reports(); inputs[1] = inputs[0]!;
    expect(() => buildQualification(inputs, current)).toThrow('exactly one');
  });
  it('leaves missing or invalid measurements explicitly provisional', async () => {
    const missing = await fetchQualification(async () => new Response('', { status: 404 }));
    expect(missing).toBeNull(); expect(choosePreview('cleft', 'source', missing).basis).toBe('unqualified');
    expect(choosePreview('cleft', 'unavailable', missing).message).toContain('fingerprint unavailable');
    const invalid = await fetchQualification(async () => new Response(JSON.stringify({ kind: 'other', schemaVersion: 1 })));
    expect(invalid).toBeNull();
    const malformed = buildQualification(reports(), current);
    delete (malformed.studies.cleft.profiles.full as Partial<typeof malformed.studies.cleft.profiles.full>).scope;
    expect(await fetchQualification(async () => new Response(JSON.stringify(malformed)))).toBeNull();
    const valid = buildQualification(reports(), current);
    expect(await fetchQualification(async () => new Response(JSON.stringify(valid)))).toEqual(valid);
  });
});
