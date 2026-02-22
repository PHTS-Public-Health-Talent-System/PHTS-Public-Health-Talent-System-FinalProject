import { query } from "@config/database.js";
import redisClient from "@config/redis.js";

export class HealthRepository {
  static async pingDatabase(): Promise<void> {
    await query("SELECT 1");
  }

  static async pingRedis(): Promise<void> {
    await redisClient.set("health:ping", "1", "EX", 5);
  }
}
