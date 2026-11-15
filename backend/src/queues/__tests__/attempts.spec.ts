import type { Job } from 'bullmq';
import { isFinalAttempt } from '../utils/attempts';

const job = (attemptsMade: number, attempts?: number) =>
  ({ attemptsMade, opts: { attempts } }) as unknown as Job;

describe('isFinalAttempt', () => {
  it('is false while retries remain', () => {
    expect(isFinalAttempt(job(0, 3))).toBe(false);
    expect(isFinalAttempt(job(1, 3))).toBe(false);
  });
  it('is true on the last attempt', () => {
    expect(isFinalAttempt(job(2, 3))).toBe(true);
  });
  it('treats jobs without retries as single-attempt', () => {
    expect(isFinalAttempt(job(0))).toBe(true);
  });
});
