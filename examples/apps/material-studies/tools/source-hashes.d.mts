export const MATERIAL_STUDY_IDS: readonly ['sandglass', 'cleft', 'returning-shore', 'borrowed-shapes', 'aster-basin'];
export interface SourceHash { path: string; sha256: string }
export function materialSourceHashes(root: string, id: string): Promise<SourceHash[]>;
export function materialSourceDigest(files: readonly SourceHash[]): string;
export function materialSourceDigests(root: string): Promise<Record<string, string>>;
