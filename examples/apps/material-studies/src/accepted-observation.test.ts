import { describe, expect, it } from 'vitest';
import { acceptedObservation } from './accepted-observation.ts';

describe('accepted observation binding', () => {
  it('reuses metadata and properties from the correct accepted node', () => {
    const facts = { inputVersion: 7, logicalCount: 18_000, restored: true };
    expect(acceptedObservation('returning-shore', { nodes: [{ id: 'shore-observation', metadata: {}, properties: facts }] }, 7)).toEqual(facts);
    expect(acceptedObservation('sandglass', { nodes: [{ id: 'sandglass-stage', metadata: { inputVersion: 7, valid: true }, properties: {} }] }, 7)).toEqual({ inputVersion: 7, valid: true });
  });
  it('rejects a stale input or missing accepted world instead of inventing its facts', () => {
    expect(() => acceptedObservation('returning-shore', { nodes: [{ id: 'shore-observation', metadata: {}, properties: { inputVersion: 6 } }] }, 7)).toThrow('different input');
    expect(() => acceptedObservation('aster-basin', undefined, 7)).toThrow('missing');
  });
});
