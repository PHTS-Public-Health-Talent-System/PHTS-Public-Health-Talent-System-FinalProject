import { Redis } from "ioredis";
import { loadEnv } from "./env.js";

loadEnv();

interface RedisClient {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    ...args: Array<string | number>
  ): Promise<"OK" | null>;
  del(...keys: string[]): Promise<number>;
  lpush(key: string, ...values: string[]): Promise<number>;
  brpop(key: string, timeoutSeconds: number): Promise<[string, string] | null>;
  on(event: string, listener: (...args: unknown[]) => void): RedisClient;
  quit(): Promise<"OK">;
  disconnect(): void;
}

const isTestEnv = process.env.NODE_ENV === "test";

const createTestRedisClient = (): RedisClient => {
  const store = new Map<string, string>();
  const lists = new Map<string, string[]>();
  const client: RedisClient = {
    get: async (key: string) => store.get(key) ?? null,
    set: async (
      key: string,
      value: string,
      ...args: Array<string | number>
    ) => {
      const hasNx = args.some((arg) => String(arg).toUpperCase() === "NX");
      if (hasNx && store.has(key)) {
        return null;
      }
      store.set(key, value);
      return "OK";
    },
    del: async (...keys: string[]) => {
      let removed = 0;
      for (const key of keys) {
        if (store.delete(key)) {
          removed += 1;
        }
      }
      return removed;
    },
    lpush: async (key: string, ...values: string[]) => {
      const list = lists.get(key) ?? [];
      for (const value of values) {
        list.unshift(value);
      }
      lists.set(key, list);
      return list.length;
    },
    brpop: async (key: string, _timeoutSeconds: number) => {
      const list = lists.get(key) ?? [];
      const value = list.pop();
      if (value === undefined) return null;
      lists.set(key, list);
      return [key, value];
    },
    on: () => client,
    quit: async () => "OK",
    disconnect: () => {},
  };
  return client;
};

const createLiveRedisClient = (): RedisClient => {
  const client = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: Number.parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number.parseInt(process.env.REDIS_DB || "0", 10),
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  client.on("connect", () => {
    console.log("[Redis] Connected successfully");
  });

  client.on("error", (err: Error) => {
    console.error("[Redis] Connection error:", err);
  });

  return client as unknown as RedisClient;
};

const redisClient: RedisClient = isTestEnv
  ? createTestRedisClient()
  : createLiveRedisClient();

export default redisClient;
