declare module 'virtual:material-study-source-digests' {
  import type { StudyId } from './studies.ts';
  export function currentSourceDigests(): Promise<Record<StudyId, string>>;
}
