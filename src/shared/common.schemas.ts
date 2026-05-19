import z from "zod";

export const BigIntStringSchema = z
  .union([z.string(), z.number(), z.bigint()])
  .transform((value) => value.toString())
  .pipe(z.string().regex(/^-?\d+$/, "Expected an integer-like value."));

export const UsernameSchema = z.string().min(3).max(16).regex(/^[a-zA-Z0-9_]+$/, {
  message: "Username may only contain letters, numbers, and underscores."
});
