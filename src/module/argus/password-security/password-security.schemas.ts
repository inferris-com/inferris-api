import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

extendZodWithOpenApi(z);

export const passwordSecurityCueSchema = z
  .object({
    breached: z.boolean(),
    breachCount: z.number().int().nonnegative().nullable(),
    checkedAtMs: z.number().int().nonnegative(),
  })
  .openapi("PasswordSecurityCue");

export type PasswordSecurityCue = z.infer<typeof passwordSecurityCueSchema>;
