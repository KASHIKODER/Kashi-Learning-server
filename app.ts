// --> Why we need this file ?
//--> 1. first of all users send http request(login , enroll , pay , watch course )
//--> but no one parse the request body . no one hadle cookies . no one decides which routes goes where.
//--> no one protect the server from abuse. no one catches errors properly.
//--> so for that all problem we need this file app.ts to cordinate all these things
import dotenv from "dotenv";
dotenv.config();
//--> we have some scretes to hide (hardcoding them is dangerous and unproffessional)
//--> sensitive credential remain outside the codebase
import express, { NextFunction, Request, Response } from "express";
//--> express helps to create routing and middleware for hadling requests
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
//--> app is your server every thing flows through it , 
// just think as Express app = is your railway station where requests arrive and response departs 
// Request = train arriving , Response = train departing
// routes = different platforms where trains arrive and depart


// Body parsing middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
//--> if this line of code is not here then it make difficult to read the request body and also json data not readble 
//--> this line solve this problem it converts the incoming json data into js object 
//--> also allow large payloads up to 50mb (videos and images)

app.use(cookieParser());
//--> to read cookies from incoming requests .
//--> cookies are small pieces of data stored on the client side and sent with each request to the server. 
//--> i am storing access token and referesh token under the cookies and this comes in raw text in headers.
//--> cookie parser helps to parse that raw thext into js object for easy access

// ✅ CORS Configuration
const corsOptions = {
  origin: ["https://kashi-learning-client.vercel.app", "http://localhost:3000"],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Cookie', 
    'Accept', 
    'Cache-Control', 
    'X-Request-Type'  
  ],
  exposedHeaders: ['Set-Cookie']
};

app.use(cors({origin:['https://kashi-learning-client.vercel.app', 'http://localhost:3000'], credentials:true}));
//--> why we use this cors ? 
//--> CORS (Cross-Origin Resource Sharing) is a security feature implemented by web browsers to restrict web pages from making requests to a different domain than the one that served the web page.
//--> different origin means different domain , protocol , port.
//--> “CORS controls which client domains can access backend resources.”
app.options('*', cors(corsOptions));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  limit: 100, 
  standardHeaders: 'draft-8', 
  legacyHeaders: false, 
  ipv6Subnet: 56, 
})

app.use(limiter);
//--> Rate limiting is a technique used to control the amount of incoming and outgoing traffic to or from a network.
//--> It helps to prevent abuse, DDoS attacks, and ensures fair usage of resources by limiting the number of requests a client can make within a specified time frame.


// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});
//--> 

// Root endpoint
app.get("/", (_: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Kashi-Learning Platform API",
    version: "1.0.0",
    docs: "/api/v1",
    health: "/health",
    test: "/test",
    status: "operational"
  });
});
//--> This is the root endpoint of the API. When a client sends a GET request to the root URL ("/"), 
// the server responds with a JSON object containing basic information about the API, including its name, version, documentation endpoint, health check endpoint, 
// test endpoint, and operational status.

// Health check
app.get("/health", (_: Request, res: Response) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "Kashi-Learning API",
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
//--> if no route found this middleware will handle that and send proper response to client

// Error middleware
app.use(ErrorMiddleware);
//--> ALWAYS KEEP THIS AT THE BOTTOM , EVERY MIDDLEWARE COME AFTER EVERYTHING 
//--> this middleware handle errors thrown from any part of the application and send proper response to client
//--> “Centralized error handling improves reliability and debugging.”


// Request
//  ↓
// Middlewares (JSON → Cookies → CORS → Rate Limit → Logger)
//  ↓
// Routes (user / course / order)
//  ↓
// Error handlers
//  ↓
// Response
