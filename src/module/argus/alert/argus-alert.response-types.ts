import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

extendZodWithOpenApi(z);

export const argusAlertResponseSchema = z
  .object({
    id: z.number().int(),
    title: z.string(),
    description: z.string().nullable(),
    priority: z.number().int(),
    cssClass: z.string().nullable(),
    isActive: z.boolean(),
    createdAtMs: z.string(),
  })
  .openapi("ArgusAlertResponse");

export type ArgusAlertResponse = z.infer<typeof argusAlertResponseSchema>;
