import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

extendZodWithOpenApi(z);

export const BigIntStringSchema = z
  .union([z.string(), z.number(), z.bigint()])
  .transform((value) => value.toString())
  .pipe(z.string().regex(/^-?\d+$/, "Expected an integer-like value."))
  .openapi({
    type: "string",
    pattern: "^-?\\d+$",
  });

export const UsernameSchema = z
  .string()
  .min(3)
  .max(16)
  .regex(/^[a-zA-Z0-9_]+$/, {
    message: "Username may only contain letters, numbers, and underscores.",
  });
