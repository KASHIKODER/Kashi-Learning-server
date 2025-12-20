import dotenv from "dotenv";
dotenv.config();

import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ErrorMiddleware } from "./middleware/error";
import path from "path";
import fs from "fs";

import userRouter from "./routes/user.route";
import courseRouter from "./routes/course.route";
import orderRouter from "./routes/order.route";
import notificationRouter from "./routes/notification.route";
import analyticsRouter from "./routes/analytics.route";
import layoutRouter from "./routes/layout.route";
import { rateLimit } from 'express-rate-limit'

export const app = express();

// Get the correct path to client build folder
const _dirname = path.resolve();
const clientDistPath = path.join(_dirname, "client", "dist");

console.log("Client dist path:", clientDistPath); // Debug line

// Debug: Check if client dist exists
if (!fs.existsSync(clientDistPath)) {
  console.warn("⚠️  Client dist folder not found at:", clientDistPath);
  console.warn("   Run: cd client && npm run build");
} else {
  console.log("✅ Client dist found at:", clientDistPath);
  try {
    console.log("   Files:", fs.readdirSync(clientDistPath));
  } catch (err) {
    console.log("   Could not read directory contents");
  }
}

// Body parsing middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());


// ✅ CORS Configuration
const corsOptions = {
  origin: ["http://localhost:3000", "http://localhost:8000"],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Accept'],
  exposedHeaders: ['Set-Cookie']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, 
	limit: 100, 
	standardHeaders: 'draft-8', 
	legacyHeaders: false, 
	ipv6Subnet: 56, 
})

app.use(limiter);

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Health check
app.get("/health", (_: Request, res: Response) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

// ✅ IMPORTANT: Routes in CORRECT ORDER
app.use("/api/v1", userRouter);
app.use("/api/v1", courseRouter);
app.use("/api/v1", analyticsRouter);
app.use("/api/v1", notificationRouter);
app.use("/api/v1", layoutRouter);
app.use("/api/v1", orderRouter);

// Test route
app.get("/test", (_: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "API is working",
  });
});

// ✅ Serve static files from client/dist
app.use(express.static(clientDistPath));

// ✅ Catch-all route for client-side routing (React/Vue/Angular)
app.get("*", (req: Request, res: Response, next: NextFunction) => {
  // Check if the request is for an API route
  if (req.originalUrl.startsWith('/api/')) {
    return next(); // Let the 404 handler handle it
  }
  
  // Serve the React app's index.html
  res.sendFile(path.join(clientDistPath, "index.html"), (err) => {
    if (err) {
      console.error("Error sending index.html:", err);
      // Check if file exists
      if (!fs.existsSync(path.join(clientDistPath, "index.html"))) {
        res.status(404).json({
          success: false,
          message: "Client build not found. Run 'npm run build' in client folder."
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Internal server error"
        });
      }
    }
  });
});

// Global 404 handler
app.all("*", (req: Request, res: Response, next: NextFunction) => {
  const err = new Error(`Route ${req.originalUrl} not found`) as any;
  err.statusCode = 404;
  next(err);
});

// Error middleware
app.use(ErrorMiddleware);