import type { JobsOptions } from 'bullmq';

// Platform-wide default job options applied to every queue unless a job overrides them
// per-enqueue. History is bounded so Redis memory doesn't grow without limit.
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,
  },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};
