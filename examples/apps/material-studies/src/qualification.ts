import type { Fidelity, StudyId } from './studies.ts';

export interface ProfileQualification {
  qualified: boolean;
  reasons: string[];
  sourceDigest: string;
  report: string;
  counts: { logical: number; drawingPool: number | null; projectedInView: null };
  inputLatencyP95Ms: number | null;
  acceptedPerSecondMinimum: number | null;
  scope: {
    headless: boolean;
    physicalDeviceAcceptance: false;
    browser: string;
    cpu: string | null;
    cpuCount: number | null;
    memoryBytes: number | null;
    platform: string;
    osRelease: string;
    viewport: { width: number; height: number };
    dpr: number;
  };
}
export interface QualificationDocument {
  schemaVersion: 1;
  kind: 'material-studies/preview-qualification';
  generatedAt: string;
  studies: Record<StudyId, {
    sourceDigest: string;
    defaultFidelity: Fidelity | null;
    profiles: Record<Fidelity, ProfileQualification>;
  }>;
}
export interface PreviewChoice {
  fidelity: Fidelity;
  basis: 'explicit' | 'qualified' | 'unqualified';
  qualification: ProfileQualification | null;
  message: string;
}

interface BenchmarkRecord {
  study: StudyId; fidelity: Fidelity; measured: boolean; sourceStable: boolean;
  defaultQualified: boolean; meetsLiveBudget: boolean; heldScenesIdle: boolean;
  repetitions: number; warmupMs: number; durationMs: number;
  environment: { isolation: string };
  configuration: { userAgent: string; platform: string; viewport: { width: number; height: number }; dpr: number; logicalCount: number; drawnCount: number | null };
  measurementContext: { headless: boolean; physicalDeviceAcceptance: boolean; cpu?: string; cpuCount?: number; memoryBytes?: number; platform: string; osRelease: string };
  runs: Array<{ mode: 'hold' | 'auto' | 'interaction'; run: number; durationMs: number; accepted: number; failures: number; inputLatencyMs: { p95: number | null } }>;
}
export interface QualificationInput { report: string; sourceDigest: string; record: BenchmarkRecord }

/** Re-check the protocol and each run; a saved pass boolean alone is not qualification. */
export function buildQualification(inputs: readonly QualificationInput[], current: Record<StudyId, string>, generatedAt = new Date().toISOString()): QualificationDocument {
  const ids: StudyId[] = ['sandglass', 'cleft', 'returning-shore', 'borrowed-shapes', 'aster-basin'];
  if (inputs.length !== 10) throw new Error('Qualification requires all ten study/profile reports.');
  const entries = ids.map(id => {
    const profiles = Object.fromEntries((['full', 'reduced'] as const).map(fidelity => {
      const matches = inputs.filter(input => input.record.study === id && input.record.fidelity === fidelity);
      if (matches.length !== 1) throw new Error(`Expected exactly one ${id}/${fidelity} report.`);
      const { record: r, report, sourceDigest } = matches[0]!;
      const reasons: string[] = [];
      if (!r.measured || r.repetitions !== 3 || r.warmupMs !== 10_000 || r.durationMs !== 60_000) reasons.push('full protocol not measured');
      if (!r.sourceStable || sourceDigest !== current[id]) reasons.push('source changed since measurement');
      if (r.environment?.isolation !== 'operator-confirmed') reasons.push('rendering isolation unverified');
      const expectedRuns = ['hold', 'auto', 'interaction'].flatMap(mode => [1, 2, 3].map(run => `${mode}/${run}`));
      const actualRuns = r.runs.map(run => `${run.mode}/${run.run}`);
      if (r.runs.length !== 9 || expectedRuns.some(key => actualRuns.filter(value => value === key).length !== 1) || r.runs.some(run => run.durationMs !== 60_000)) reasons.push('incomplete run matrix');
      const held = r.runs.filter(run => run.mode === 'hold');
      const active = r.runs.filter(run => run.mode !== 'hold');
      if (!r.heldScenesIdle || held.some(run => run.accepted !== 0)) reasons.push('held scene did not idle');
      if (r.runs.some(run => run.failures !== 0)) reasons.push('presentation failures');
      if (!r.meetsLiveBudget || active.some(run => !Number.isFinite(run.accepted) || !Number.isFinite(run.inputLatencyMs.p95) || (run.inputLatencyMs.p95 ?? Infinity) < 0 || (run.inputLatencyMs.p95 ?? Infinity) > 100 || run.accepted / 60 < 29)) reasons.push('live update or latency budget missed');
      if (!r.defaultQualified && !reasons.length) reasons.push('report did not qualify the default');
      const c = r.measurementContext, config = r.configuration;
      const latencies = active.map(run => run.inputLatencyMs.p95).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      const profile: ProfileQualification = {
        qualified: reasons.length === 0, reasons, sourceDigest, report,
        counts: { logical: config.logicalCount, drawingPool: config.drawnCount, projectedInView: null },
        inputLatencyP95Ms: latencies.length ? Math.max(...latencies) : null,
        acceptedPerSecondMinimum: active.length ? Math.min(...active.map(run => run.accepted / 60)) : null,
        scope: { headless: c.headless, physicalDeviceAcceptance: false, browser: config.userAgent,
          cpu: c.cpu ?? null, cpuCount: c.cpuCount ?? null, memoryBytes: c.memoryBytes ?? null,
          platform: c.platform, osRelease: c.osRelease, viewport: config.viewport, dpr: config.dpr },
      };
      return [fidelity, profile];
    })) as Record<Fidelity, ProfileQualification>;
    return [id, { sourceDigest: current[id], defaultFidelity: profiles.full.qualified ? 'full' : profiles.reduced.qualified ? 'reduced' : null, profiles }];
  });
  return { schemaVersion: 1, kind: 'material-studies/preview-qualification', generatedAt, studies: Object.fromEntries(entries) as QualificationDocument['studies'] };
}

/** Called before loading a study, never while the host is presenting that study. */
export function choosePreview(id: StudyId, currentSourceDigest: string, qualification: QualificationDocument | null, explicit?: Fidelity): PreviewChoice {
  const entry = qualification?.studies?.[id];
  const matches = entry?.sourceDigest === currentSourceDigest;
  const valid = (fidelity: Fidelity) => matches && entry?.profiles?.[fidelity]?.qualified === true && entry.profiles[fidelity].sourceDigest === currentSourceDigest;
  const fidelity = explicit ?? (valid('full') ? 'full' : valid('reduced') ? 'reduced' : 'full');
  const profile = valid(fidelity) ? entry!.profiles[fidelity] : null;
  const label = fidelity === 'full' ? 'Full' : 'Reduced';
  if (profile) {
    const scope = profile.scope;
    return { fidelity, basis: explicit ? 'explicit' : 'qualified', qualification: profile,
      message: `${label} · qualified in ${scope.headless ? 'headless' : 'browser'} Chromium on ${scope.cpu ?? scope.platform}; ${scope.viewport.width} × ${scope.viewport.height}, DPR ${scope.dpr}. Physical playback remains unreviewed.` };
  }
  const reason = currentSourceDigest === 'unavailable' ? 'source fingerprint unavailable' : entry && !matches ? 'source changed since measurement' : !entry ? 'measurements pending' : valid('full') || valid('reduced') ? 'this profile did not qualify' : 'no qualifying profile';
  return { fidelity, basis: explicit ? 'explicit' : 'unqualified', qualification: null,
    message: `${label} · ${reason}${explicit ? '; your selection is retained' : '; provisional preview'}.` };
}

export async function fetchQualification(fetcher: typeof fetch = fetch): Promise<QualificationDocument | null> {
  try {
    const response = await fetcher('/portfolio/qualification.json', { cache: 'no-store' });
    if (!response.ok) return null;
    const value: unknown = await response.json();
    if (!isQualificationDocument(value)) return null;
    return value as QualificationDocument;
  } catch { return null; }
}

function isQualificationDocument(value: unknown): value is QualificationDocument {
  const object = (entry: unknown): entry is Record<string, unknown> => !!entry && typeof entry === 'object' && !Array.isArray(entry);
  if (!object(value) || value.schemaVersion !== 1 || value.kind !== 'material-studies/preview-qualification' || typeof value.generatedAt !== 'string' || !object(value.studies)) return false;
  const ids: StudyId[] = ['sandglass', 'cleft', 'returning-shore', 'borrowed-shapes', 'aster-basin'];
  return ids.every(id => {
    const entry = (value.studies as Record<string, unknown>)[id];
    if (!object(entry) || typeof entry.sourceDigest !== 'string' || !object(entry.profiles)) return false;
    return ['full', 'reduced'].every(fidelity => {
      const profile = (entry.profiles as Record<string, unknown>)[fidelity];
      if (!object(profile) || typeof profile.qualified !== 'boolean' || typeof profile.sourceDigest !== 'string' || !object(profile.scope) || !object(profile.counts)) return false;
      const scope = profile.scope;
      return typeof scope.headless === 'boolean' && scope.physicalDeviceAcceptance === false && typeof scope.browser === 'string' && typeof scope.platform === 'string'
        && (typeof scope.cpu === 'string' || scope.cpu === null) && object(scope.viewport) && Number.isFinite(scope.viewport.width) && Number.isFinite(scope.viewport.height) && Number.isFinite(scope.dpr);
    });
  });
}
