import z from "zod";

export const metricsWindowSchema = z.enum(["15m", "1h", "6h", "24h"]).default("1h");

export const metricsQuerySchema = z
  .object({
    window: metricsWindowSchema,
  })
  .strict();

export const serverMetricsParamsSchema = z
  .object({
    serverId: z.guid({ message: "Invalid server UUID format." }),
  })
  .strict();

export type MetricsWindow = z.infer<typeof metricsWindowSchema>;
export type MetricsQuery = z.infer<typeof metricsQuerySchema>;
export type ServerMetricsParams = z.infer<typeof serverMetricsParamsSchema>;

export function windowToMs(window: MetricsWindow): number {
  switch (window) {
    case "15m":
      return 15 * 60 * 1000;
    case "6h":
      return 6 * 60 * 60 * 1000;
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "1h":
      return 60 * 60 * 1000;
  }
}
