// utils/db.ts
import mongoose from "mongoose";
require("dotenv").config();

const dbUrl: string = process.env.DB_URL || "";

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

const connectDB = async (retryCount = 0): Promise<void> => {
  try {
    if (isConnected) {
      console.log("✅ Using existing database connection");
      return;
    }

    console.log(`🔄 Attempting to connect to MongoDB (Attempt ${retryCount + 1})...`);
    
    await mongoose.connect(dbUrl, connectionOptions);
    
    isConnected = true;
    connectionAttempts = 0;
    
    console.log(`✅ Database connected successfully to ${mongoose.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
      isConnected = true;
    });

  } catch (error: any) {
    console.error(`❌ Database connection failed (Attempt ${retryCount + 1}):`, error.message);
    
    if (retryCount < MAX_RETRIES) {
      console.log(`⏳ Retrying in 5 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return connectDB(retryCount + 1);
    } else {
      console.error('💥 Max retries reached. Failed to connect to database.');
      throw error;
    }
  }
};

// Export a function to check connection status
export const isDBConnected = () => isConnected;

export default connectDB;