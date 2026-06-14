import z from "zod";

export const loginBodySchema = z
  .object({
    usernameOrEmail: z.string().min(1),
    password: z.string().min(1),
  })
  .strict();

export const refreshBodySchema = z
  .object({
    refreshToken: z.string().min(1),
  })
  .strict();

export const logoutBodySchema = refreshBodySchema;

export type LoginBody = z.infer<typeof loginBodySchema>;
export type RefreshBody = z.infer<typeof refreshBodySchema>;
export type LogoutBody = z.infer<typeof logoutBodySchema>;
