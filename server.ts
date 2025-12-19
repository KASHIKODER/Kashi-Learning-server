import { app } from "./app";
import { v2 as cloudinary } from "cloudinary";
import http from "http";
import connectDB from "./utils/db";  
import dotenv from "dotenv";
import "./utils/redis";
import { initSocketServer } from "./socketServer";

// Load environment variables first
dotenv.config();

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

const server = http.createServer(app);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME!,
  api_key: process.env.CLOUD_API_KEY!,
  api_secret: process.env.CLOUD_API_SECRET!,
});

// Initialize Socket.IO
initSocketServer(server);

const PORT = process.env.PORT || 8000;

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  connectDB().catch((error) => {
    console.error("❌ Failed to connect to database:", error);
    process.exit(1);
  });
});

// Handle server errors
server.on('error', (error: Error) => {
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