import z from "zod";

export const changePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1).max(256),
    newPassword: z.string().min(12).max(256),
  })
  .strict();

export const accountSessionParamsSchema = z
  .object({
    sessionId: z.string().uuid(),
  })
  .strict();

export const accountNotificationParamsSchema = z
  .object({
    notificationId: z.string().min(1).max(128),
  })
  .strict();

export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
export type AccountNotificationParams = z.infer<typeof accountNotificationParamsSchema>;
export type AccountSessionParams = z.infer<typeof accountSessionParamsSchema>;
