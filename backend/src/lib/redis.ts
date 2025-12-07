// ============================================
// Redis Client
// ============================================

import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!config.redisUrl) {
    logger.warn('Redis URL not configured, using in-memory fallback');
    return null;
  }

  if (!redis) {
    redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redis.on('connect', () => {
      logger.info('Redis connected');
    });

    redis.on('error', (error) => {
      logger.error('Redis error:', error);
    });
  }

  return redis;
}

// Simple cache helpers
export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;

  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error('Cache get error:', error);
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number = 300
): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (error) {
    logger.error('Cache set error:', error);
  }
}

export async function cacheDel(key: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.del(key);
  } catch (error) {
    logger.error('Cache delete error:', error);
  }
}
