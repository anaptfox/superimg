//! Zod schema for ProjectConfig validation

import { z } from "zod";

const OutputPresetSchema = z.object({
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  fps: z.number().positive().optional(),
});

export const ProjectConfigSchema = z.object({
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  fps: z.number().positive().optional(),
  durationSeconds: z.number().positive().optional(),
  fonts: z.array(z.string()).optional(),
  inlineCss: z.array(z.string()).optional(),
  stylesheets: z.array(z.string()).optional(),
  outputs: z.record(z.string(), OutputPresetSchema).optional(),
});
