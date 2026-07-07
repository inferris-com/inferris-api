import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

extendZodWithOpenApi(z);

export const apiErrorEnvelopeSchema = z
  .object({
    error: z.object({
      code: z.string().optional(),
      message: z.string(),
      details: z.unknown().optional(),
      issues: z
        .array(
          z.object({
            path: z.array(z.union([z.string(), z.number()])),
            message: z.string(),
          }),
        )
        .optional(),
    }),
  })
  .openapi("ApiErrorEnvelope");

export function successEnvelopeSchema<T extends z.ZodType>(name: string, data: T) {
  return z.object({ data }).openapi(name);
}

export function listEnvelopeSchema<T extends z.ZodType>(name: string, data: T) {
  return z
    .object({
      data: z.array(data),
      meta: z.object({
        count: z.number().int().nonnegative(),
      }),
    })
    .openapi(name);
}
