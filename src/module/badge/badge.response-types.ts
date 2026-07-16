import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

extendZodWithOpenApi(z);

export const badgeResponseSchema = z
  .object({
    id: z.number().int(),
    key: z.string(),
    label: z.string(),
    description: z.string().nullable(),
    color: z.string().nullable(),
    emoji: z.string().nullable(),
    displayOrder: z.number().int(),
    isActive: z.boolean(),
  })
  .openapi("BadgeManagementResponse");

export type BadgeResponse = {
  id: number;
  key: string;
  label: string;
  description: string | null;
  color: string | null;
  emoji: string | null;
  displayOrder: number;
  isActive: boolean;
};
