import { logger } from "@/logger.js";
import type { CronJob, CronJobHandle } from "@/cron/cron.types.js";

export class CronScheduler {
  private readonly handles: CronJobHandle[] = [];

  start(jobs: CronJob[]): void {
    for (const job of jobs) {
      this.handles.push(startJob(job));
    }
  }

  stop(): void {
    for (const handle of this.handles.splice(0)) {
      handle.stop();
    }
  }
}

function startJob(job: CronJob): CronJobHandle {
  let running = false;

  const run = () => {
    if (running) {
      logger.warn({ job: job.name }, "Cron job skipped because previous run is still active");
      return;
    }

    running = true;
    void job
      .run()
      .catch((error: unknown) => {
        logger.error({ error, job: job.name }, "Cron job failed");
      })
      .finally(() => {
        running = false;
      });
  };

  run();

  const interval = setInterval(run, job.intervalMs);
  interval.unref();

  return {
    stop: () => {
      clearInterval(interval);
    },
  };
}
