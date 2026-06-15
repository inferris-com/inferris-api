import { createCronJobs } from "../cron/jobs.js";
import { CronScheduler } from "../cron/cron.scheduler.js";
import type { AppDependencies } from "./app.dependencies.js";

export type BackgroundRuntime = {
  start(): void;
  stop(): Promise<void>;
};

export function createBackgroundRuntime(dependencies: AppDependencies): BackgroundRuntime {
  const cronScheduler = new CronScheduler();
  const chatMessageFlushWorker = dependencies.workers.chatMessageFlush;

  return {
    start() {
      cronScheduler.start(createCronJobs(dependencies.services.punishment));
      chatMessageFlushWorker.start();
    },
    async stop() {
      cronScheduler.stop();
      await chatMessageFlushWorker.stop();
    },
  };
}
