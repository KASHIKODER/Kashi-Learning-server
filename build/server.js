"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const cloudinary_1 = require("cloudinary");
const http_1 = __importDefault(require("http"));
const db_1 = __importDefault(require("./utils/db"));
const dotenv_1 = __importDefault(require("dotenv"));
require("./utils/redis");
const socketServer_1 = require("./socketServer");
// Load environment variables first
dotenv_1.default.config();
// Validate required environment variables
const requiredEnvVars = [
    'CLOUD_NAME',
    'CLOUD_API_KEY',
    'CLOUD_API_SECRET'
];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`❌ Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}
const server = http_1.default.createServer(app_1.app);
// Configure Cloudinary
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
});
// Initialize Socket.IO
(0, socketServer_1.initSocketServer)(server);
const PORT = process.env.PORT || 8000;
// Start server
server.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    (0, db_1.default)().catch((error) => {
        console.error("❌ Failed to connect to database:", error);
        process.exit(1);
    });
});
// Handle server errors
server.on('error', (error) => {
    console.error('❌ Server error:', error);
});
// Graceful shutdown
process.on('SIGINT', () => {
    console.log('👋 Shutting down server...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
//# sourceMappingURL=server.js.map