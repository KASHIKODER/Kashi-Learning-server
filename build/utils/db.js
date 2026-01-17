"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDBConnected = void 0;
// utils/db.ts
const mongoose_1 = __importDefault(require("mongoose"));
require("dotenv").config();
const dbUrl = process.env.DB_URL || "";
if (!dbUrl) {
    throw new Error("❌ DB_URL is not defined in environment variables");
}
// Connection configuration
const connectionOptions = {
    maxPoolSize: 10, // Maximum number of sockets in the connection pool
    serverSelectionTimeoutMS: 5000, // Timeout after 5s if no server is selected
    socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
};
// Track connection state
let isConnected = false;
let connectionAttempts = 0;
const MAX_RETRIES = 3;
const connectDB = async (retryCount = 0) => {
    try {
        if (isConnected) {
            console.log("✅ Using existing database connection");
            return;
        }
        console.log(`🔄 Attempting to connect to MongoDB (Attempt ${retryCount + 1})...`);
        await mongoose_1.default.connect(dbUrl, connectionOptions);
        isConnected = true;
        connectionAttempts = 0;
        console.log(`✅ Database connected successfully to ${mongoose_1.default.connection.host}`);
        // Handle connection events
        mongoose_1.default.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
            isConnected = false;
        });
        mongoose_1.default.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB disconnected');
            isConnected = false;
        });
        mongoose_1.default.connection.on('reconnected', () => {
            console.log('✅ MongoDB reconnected');
            isConnected = true;
        });
    }
    catch (error) {
        console.error(`❌ Database connection failed (Attempt ${retryCount + 1}):`, error.message);
        if (retryCount < MAX_RETRIES) {
            console.log(`⏳ Retrying in 5 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            return connectDB(retryCount + 1);
        }
        else {
            console.error('💥 Max retries reached. Failed to connect to database.');
            throw error;
        }
    }
};
// Export a function to check connection status
const isDBConnected = () => isConnected;
exports.isDBConnected = isDBConnected;
exports.default = connectDB;
//# sourceMappingURL=db.js.map