import z from "zod";

import { paginationQuerySchema } from "../../shared/pagination.schemas.js";

const boolQuerySchema = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => (value === undefined ? true : value === "true"));

const alertFieldsSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(4000).nullable().optional(),
    priority: z.number().int().min(0).max(1000).optional(),
    cssClass: z.string().trim().min(1).max(120).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const argusAlertParamsSchema = z.object({ alertId: z.coerce.number().int().positive() }).strict();

export const listArgusAlertsQuerySchema = paginationQuerySchema
  .extend({
    isActive: boolQuerySchema,
  })
  .strict();

export const createArgusAlertBodySchema = alertFieldsSchema.extend({
  priority: z.number().int().min(0).max(1000).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateArgusAlertBodySchema = alertFieldsSchema.partial().refine(
  (body) => Object.keys(body).length > 0,
  {
    message: "At least one field must be provided.",
  },
);

export type ArgusAlertParams = z.infer<typeof argusAlertParamsSchema>;
export type ListArgusAlertsQuery = z.infer<typeof listArgusAlertsQuerySchema>;
export type CreateArgusAlertBody = z.infer<typeof createArgusAlertBodySchema>;
export type UpdateArgusAlertBody = z.infer<typeof updateArgusAlertBodySchema>;
