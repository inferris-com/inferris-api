import z from "zod"

export const createPlayerBodySchema = z.object({
  id: z.uuid(),
  username: z.string().max(17),
  flags: z.number().min(0).default(0),
  orbs: z.number().default(100),
  lastServer: z.uuid(),
})

export type CreatePlayerBody = z.infer<typeof createPlayerBodySchema>;
