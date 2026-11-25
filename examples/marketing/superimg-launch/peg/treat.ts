import type { Pt } from "./kit";

export type Paint = string | { grad: [string, string]; angle?: number };

export type Era = {
  id: string;
  label: string;
  when: string;
  note: string;
  treatment: "ink" | "flat" | "pixel" | "clean" | "toy";
  /** Stage colour the palette was designed against. Assets stay transparent. */
  bg: string;
  line: string;
  lineWidth: number;
  palette: Record<string, Paint>;
  /** Roles that receive hatch (ink) or halftone (flat) shading, or read as pressed in (toy). */
  shade?: string[];
  /** Playback rate the period could afford. Used by the live sheet and media. */
  fps: number;
  opts?: {
    jitter?: number;
    misregister?: Pt;
    hardShadow?: { dx: number; dy: number; color: string; opacity: number };
    grid?: number;
    hair?: string;
    /** Toy: thickness of the under-lip, and the colour it darkens toward. */
    lip?: number;
    deep?: string;
  };
};

