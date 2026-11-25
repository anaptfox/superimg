import type { Program } from "@foxworth/boundary/program";

export const INTERACTION_PROGRAM_LOCK_ID = "superimg-interaction-programs";

export type SuperImgInteractionPrograms = Readonly<{
  media: Program;
  edit: Program;
  render: Program;
  script: Program;
}>;

export function serializeProgramLock(programs: SuperImgInteractionPrograms): string {
  return `${JSON.stringify({ id: INTERACTION_PROGRAM_LOCK_ID, programs })}\n`;
}
