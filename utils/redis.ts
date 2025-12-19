import Redis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

if (!process.env.REDIS_URL) {
  throw new Error("❌ Missing REDIS_URL in .env");
}

export const redis = new Redis(process.env.REDIS_URL as string, {
  tls: {
    rejectUnauthorized: false,
    servername: "sought-ferret-14809.upstash.io", // ✅ force correct SNI
  },
  maxRetriesPerRequest: null,
  reconnectOnError: () => true,
  retryStrategy(times) {
    console.log("♻️ Redis reconnecting...");
    return Math.min(times * 200, 2000);
  },
});

redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("ready", () => console.log("📡 Redis ready"));
redis.on("error", (err) => console.error("❌ Redis error:", err.message));

redis.on("reconnecting", () => console.log("♻️ Redis reconnecting..."));
