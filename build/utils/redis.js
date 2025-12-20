"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
if (!process.env.REDIS_URL) {
    throw new Error("❌ Missing REDIS_URL in .env");
}
exports.redis = new ioredis_1.default(process.env.REDIS_URL, {
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
exports.redis.on("connect", () => console.log("✅ Redis connected"));
exports.redis.on("ready", () => console.log("📡 Redis ready"));
exports.redis.on("error", (err) => console.error("❌ Redis error:", err.message));
exports.redis.on("reconnecting", () => console.log("♻️ Redis reconnecting..."));
//# sourceMappingURL=redis.js.map