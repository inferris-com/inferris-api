import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

extendZodWithOpenApi(z);

export const apiErrorEnvelopeSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  })
  .openapi("ApiErrorEnvelope");

export function successEnvelope<T extends z.ZodType>(data: T) {
  return z.object({ data });
}

export function listEnvelope<T extends z.ZodType>(data: T) {
  return z.object({
    data: z.array(data),
    meta: z.object({
      count: z.number().int().nonnegative(),
    }),
  });
}
