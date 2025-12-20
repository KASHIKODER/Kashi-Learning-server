"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const error_1 = require("./middleware/error");
const express_rate_limit_1 = require("express-rate-limit");
const user_route_1 = __importDefault(require("./routes/user.route"));
const course_route_1 = __importDefault(require("./routes/course.route"));
const order_route_1 = __importDefault(require("./routes/order.route"));
const notification_route_1 = __importDefault(require("./routes/notification.route"));
const analytics_route_1 = __importDefault(require("./routes/analytics.route"));
const layout_route_1 = __importDefault(require("./routes/layout.route"));
exports.app = (0, express_1.default)();
// Body parsing middleware
exports.app.use(express_1.default.json({ limit: "50mb" }));
exports.app.use(express_1.default.urlencoded({ extended: true, limit: "50mb" }));
exports.app.use((0, cookie_parser_1.default)());
// ✅ CORS Configuration
const corsOptions = {
    origin: ["https://kashi-learning-client.vercel.app", "http://localhost:3000"],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Accept'],
    exposedHeaders: ['Set-Cookie']
};
exports.app.use((0, cors_1.default)(corsOptions));
exports.app.options('*', (0, cors_1.default)(corsOptions));
const limiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ipv6Subnet: 56,
});
exports.app.use(limiter);
// Request logging
exports.app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
});
// Root endpoint
exports.app.get("/", (_, res) => {
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
exports.app.get("/health", (_, res) => {
    res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        service: "E-Learning API",
        uptime: process.uptime()
    });
});
// Test route
exports.app.get("/test", (_, res) => {
    res.status(200).json({
        success: true,
        message: "API is working",
        timestamp: new Date().toISOString()
    });
});
// ✅ IMPORTANT: Routes in CORRECT ORDER
exports.app.use("/api/v1", user_route_1.default);
exports.app.use("/api/v1", course_route_1.default);
exports.app.use("/api/v1", analytics_route_1.default);
exports.app.use("/api/v1", notification_route_1.default);
exports.app.use("/api/v1", layout_route_1.default);
exports.app.use("/api/v1", order_route_1.default);
// Global 404 handler
exports.app.all("*", (req, res, next) => {
    const err = new Error(`Route ${req.originalUrl} not found`);
    err.statusCode = 404;
    next(err);
});
// Error middleware
exports.app.use(error_1.ErrorMiddleware);
//# sourceMappingURL=app.js.map