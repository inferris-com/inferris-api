import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

extendZodWithOpenApi(z);

export const groupResponseSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    priority: z.number().int(),
    isStaff: z.boolean(),
    createdAtMs: z.string(),
    updatedAtMs: z.string().nullable(),
  })
  .openapi("GroupManagementResponse");

export type GroupResponse = {
  key: string;
  label: string;
  priority: number;
  isStaff: boolean;
  createdAtMs: string;
  updatedAtMs: string | null;
};
