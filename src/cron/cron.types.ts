export type CronJob = {
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
};

export type CronJobHandle = {
  stop: () => void;
};
