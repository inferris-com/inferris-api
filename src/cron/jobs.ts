import type { PunishmentService } from "../module/punishment/punishment.service.js";
import type { CronJob } from "./cron.types.js";

const fiveMinutesMs = 5 * 60 * 1000;

export function createCronJobs(punishmentService: PunishmentService): CronJob[] {
  return [
    {
      name: "punishments.expire",
      intervalMs: fiveMinutesMs,
      run: async () => {
        await punishmentService.expirePunishments();
      },
    },
  ];
}
