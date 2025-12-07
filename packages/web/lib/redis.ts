import Redis from 'ioredis';

const getRedisUrl = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  return 'redis://localhost:6379';
};

export const redis = new Redis(getRedisUrl(), {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('error', (err) => {
  console.error('Redis Client Error', err);
});

redis.on('connect', () => {
  console.log('Redis Client Connected');
});

// Usage tracking helpers
export const usageTracker = {
  async incrementMinutes(userId: string, minutes: number) {
    const key = `usage:${userId}:minutes:${new Date().toISOString().slice(0, 7)}`;
    await redis.incrby(key, minutes);
    await redis.expire(key, 60 * 60 * 24 * 90); // 90 days
  },
  
  async incrementCalls(userId: string) {
    const key = `usage:${userId}:calls:${new Date().toISOString().slice(0, 10)}`;
    await redis.incr(key);
    await redis.expire(key, 60 * 60 * 24 * 90);
  },
  
  async getConcurrentCalls(userId: string): Promise<number> {
    const key = `concurrent:${userId}`;
    const count = await redis.get(key);
    return parseInt(count || '0');
  },
  
  async incrementConcurrent(userId: string, callId: string) {
    const key = `concurrent:${userId}`;
    await redis.incr(key);
    await redis.sadd(`concurrent:${userId}:calls`, callId);
    await redis.expire(key, 60 * 60); // 1 hour safety
  },
  
  async decrementConcurrent(userId: string, callId: string) {
    const key = `concurrent:${userId}`;
    await redis.decr(key);
    await redis.srem(`concurrent:${userId}:calls`, callId);
  },
};
