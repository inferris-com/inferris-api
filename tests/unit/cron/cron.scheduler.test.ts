import { describe, expect, jest, test } from "@jest/globals";

import { CronScheduler } from "@/cron/cron.scheduler.js";
import type { CronJob } from "@/cron/cron.types.js";

describe("CronScheduler", () => {
  test("runs jobs once when started", () => {
    const scheduler = new CronScheduler();
    const job: CronJob = {
      name: "test.job",
      intervalMs: 60_000,
      run: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };

    scheduler.start([job]);
    scheduler.stop();

    expect(job.run).toHaveBeenCalledTimes(1);
  });
});
