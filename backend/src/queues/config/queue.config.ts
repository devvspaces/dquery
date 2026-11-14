import { registerAs } from '@nestjs/config';

export default registerAs('queue', () => ({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  generation: {
    concurrency: parseInt(process.env.QUEUE_GENERATION_CONCURRENCY || '2', 10),
    timeout: parseInt(process.env.QUEUE_GENERATION_TIMEOUT || '60000', 10),
    attempts: 2,
    backoff: {
      type: 'exponential' as const,
      delay: 10000,
    },
  },
  checking: {
    concurrency: parseInt(process.env.QUEUE_CHECKING_CONCURRENCY || '10', 10),
    timeout: parseInt(process.env.QUEUE_CHECKING_TIMEOUT || '30000', 10),
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 5000,
    },
  },
  removeOnComplete: {
    age: parseInt(process.env.QUEUE_REMOVE_ON_COMPLETE_AGE || '3600', 10),
    count: 1000,
  },
  removeOnFail: {
    age: parseInt(process.env.QUEUE_REMOVE_ON_FAIL_AGE || '86400', 10),
  },
}));
