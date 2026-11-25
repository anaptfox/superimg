import type { SceneSnapshot } from '@foxworth/superimg/interactive/define';
import type { StudyId } from './studies.ts';

const NODE_IDS: Partial<Record<StudyId, string>> = {
  sandglass: 'sandglass-stage', 'returning-shore': 'shore-observation',
  'borrowed-shapes': 'forms-observation', 'aster-basin': 'atlas-stage',
};

/** Reuse the facts attached to the accepted paint; never sample a second world. */
export function acceptedObservation(id: StudyId, root: unknown, inputVersion: number): Record<string, unknown> {
  const scene = root as SceneSnapshot | undefined;
  const node = scene?.nodes?.find(value => value.id === NODE_IDS[id]);
  if (!node) throw new Error(`Accepted ${id} observation is missing.`);
  const facts = { ...node.metadata, ...node.properties };
  if (facts.inputVersion !== inputVersion) throw new Error(`Accepted ${id} observation belongs to a different input (${String(facts.inputVersion)}; expected ${inputVersion}).`);
  return facts;
}
