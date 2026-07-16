import { describe, expect, jest, test } from "@jest/globals";

import { createCronJobs } from "../../../src/cron/jobs.js";
import type { PunishmentService } from "../../../src/module/punishment/punishment.service.js";
import type { ServerService } from "../../../src/module/server/server.service.js";

describe("createCronJobs", () => {
  test("registers punishment and inactive server expiration jobs", async () => {
    const punishmentService = {
      expirePunishments: jest.fn<() => Promise<unknown>>().mockResolvedValue([]),
    } as unknown as PunishmentService;
    const serverService = {
      expireInactiveServers: jest.fn<() => Promise<unknown>>().mockResolvedValue(0),
    } as unknown as ServerService;

    const jobs = createCronJobs(punishmentService, serverService);

    expect(jobs.map((job) => job.name)).toEqual(["punishments.expire", "servers.expireInactive"]);

    await Promise.all(jobs.map((job) => job.run()));

    expect(punishmentService.expirePunishments).toHaveBeenCalledWith();
    expect(serverService.expireInactiveServers).toHaveBeenCalledWith();
  });
});
