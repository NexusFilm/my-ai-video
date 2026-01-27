import { z } from "zod";

export const COMP_NAME = "DynamicComp";

export const CompositionProps = z.object({
  code: z.string(),
  durationInFrames: z.number(),
  fps: z.number(),
  width: z.number().optional().default(1920),
  height: z.number().optional().default(1080),
});
