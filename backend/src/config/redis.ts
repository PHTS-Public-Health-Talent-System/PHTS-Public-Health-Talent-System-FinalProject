import { Redis } from "ioredis";
import { loadEnv } from "@config/env.js";

loadEnv();

interface RedisClient {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    ...args: Array<string | number>
  ): Promise<"OK" | null>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  lpush(key: string, ...values: string[]): Promise<number>;
  llen(key: string): Promise<number>;
  brpop(key: string, timeoutSeconds: number): Promise<[string, string] | null>;
  eval(
    script: string,
    numKeys: number,
    ...args: Array<string | number>
  ): Promise<unknown>;
  duplicate(): RedisClient;
  on(event: string, listener: (...args: unknown[]) => void): RedisClient;
  quit(): Promise<"OK">;
  disconnect(): void;
}

const isTestEnv = process.env.NODE_ENV === "test";

const createTestRedisClient = (
  store = new Map<string, string>(),
  lists = new Map<string, string[]>(),
): RedisClient => {
  const client: RedisClient = {
    get: async (key: string) => store.get(key) ?? null,
    set: async (
      key: string,
      value: string,
      ...args: Array<string | number>
    ) => {
      const hasNx = args.some((arg) => String(arg).toUpperCase() === "NX");
      const hasXx = args.some((arg) => String(arg).toUpperCase() === "XX");
      if (hasNx && store.has(key)) {
        return null;
      }
      if (hasXx && !store.has(key)) {
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
    keys: async (pattern: string) => {
      const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
      return Array.from(store.keys()).filter((key) => regex.test(key));
    },
    lpush: async (key: string, ...values: string[]) => {
      const list = lists.get(key) ?? [];
      for (const value of values) {
        list.unshift(value);
      }
      lists.set(key, list);
      return list.length;
    },
    llen: async (key: string) => {
      const list = lists.get(key) ?? [];
      return list.length;
    },
    brpop: async (key: string, _timeoutSeconds: number) => {
      const list = lists.get(key) ?? [];
      const value = list.pop();
      if (value === undefined) return null;
      lists.set(key, list);
      return [key, value];
    },
    eval: async (
      script: string,
      numKeys: number,
      ...args: Array<string | number>
    ) => {
      const keyArgs = args.slice(0, numKeys).map((arg) => String(arg));
      const argv = args.slice(numKeys).map((arg) => String(arg));

      if (numKeys === 1 && keyArgs.length === 1) {
        const key = keyArgs[0];
        const current = store.get(key);
        const hasGetCheck = script.includes('redis.call("GET", KEYS[1])');
        const hasSetWithTtl = script.includes(
          'redis.call("SET", KEYS[1], ARGV[1], "EX", ARGV[2], "XX")',
        );
        const hasDel = script.includes('redis.call("DEL", KEYS[1])');

        if (hasGetCheck && hasSetWithTtl) {
          if (current === argv[0]) {
            store.set(key, argv[0]);
            return "OK";
          }
          return null;
        }

        if (hasGetCheck && hasDel) {
          if (current === argv[0]) {
            store.delete(key);
            return 1;
          }
          return 0;
        }
      }

      throw new Error("Unsupported Redis eval script in test client");
    },
    duplicate: () => createTestRedisClient(store, lists),
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

  const rawEval = client.eval.bind(client) as (
    script: string,
    numKeys: number,
    ...args: Array<string | number>
  ) => Promise<unknown>;

  client.on("connect", () => {
    console.log("[Redis] Connected successfully");
  });

  client.on("error", (err: Error) => {
    console.error("[Redis] Connection error:", err);
  });

  const typedClient = client as unknown as RedisClient;
  typedClient.duplicate = () => createLiveRedisClient();
  typedClient.eval = (
    script: string,
    numKeys: number,
    ...args: Array<string | number>
  ) => rawEval(script, numKeys, ...args);
  return typedClient;
};

const redisClient: RedisClient = isTestEnv
  ? createTestRedisClient()
  : createLiveRedisClient();

export default redisClient;
