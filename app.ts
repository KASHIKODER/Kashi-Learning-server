import dotenv from "dotenv";
dotenv.config();

import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ErrorMiddleware } from "./middleware/error";
import { rateLimit } from 'express-rate-limit'

import userRouter from "./routes/user.route";
import courseRouter from "./routes/course.route";
import orderRouter from "./routes/order.route";
import notificationRouter from "./routes/notification.route";
import analyticsRouter from "./routes/analytics.route";
import layoutRouter from "./routes/layout.route";

export const app = express();

// Body parsing middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

// ✅ CORS Configuration
const corsOptions = {
  origin: ["https://kashi-learning-client.vercel.app/"],
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

// Root endpoint
app.get("/", (_: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "🎓 E-Learning Platform API",
    version: "1.0.0",
    docs: "/api/v1",
    health: "/health",
    test: "/test",
    status: "operational"
  });
});

// Health check
app.get("/health", (_: Request, res: Response) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "E-Learning API",
    uptime: process.uptime()
  });
});

// Test route
app.get("/test", (_: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "API is working",
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

// Global 404 handler
app.all("*", (req: Request, res: Response, next: NextFunction) => {
  const err = new Error(`Route ${req.originalUrl} not found`) as any;
  err.statusCode = 404;
  next(err);
});

// Error middleware
app.use(ErrorMiddleware);