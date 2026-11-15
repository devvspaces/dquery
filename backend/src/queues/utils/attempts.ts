import type { Job } from 'bullmq';

/**
 * True when the current run is the job's last attempt, so a failure now is
 * final. BullMQ's attemptsMade counts attempts that already failed.
 */
export function isFinalAttempt(job: Job): boolean {
  return job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
}
