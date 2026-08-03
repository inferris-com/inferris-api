import type { PunishmentService } from "@/module/punishment/punishment.service.js";
import type { ServerService } from "@/module/server/server.service.js";
import type { CronJob } from "@/cron/cron.types.js";

const fiveMinutesMs = 5 * 60 * 1000;

export function createCronJobs(
  punishmentService: PunishmentService,
  serverService: ServerService,
): CronJob[] {
  return [
    {
      name: "punishments.expire",
      intervalMs: fiveMinutesMs,
      run: async () => {
        await punishmentService.expirePunishments();
      },
    },
    {
      name: "servers.expireInactive",
      intervalMs: fiveMinutesMs,
      run: async () => {
        await serverService.expireInactiveServers();
      },
    },
  ];
}
