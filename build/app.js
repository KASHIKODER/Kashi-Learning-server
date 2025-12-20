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
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const user_route_1 = __importDefault(require("./routes/user.route"));
const course_route_1 = __importDefault(require("./routes/course.route"));
const order_route_1 = __importDefault(require("./routes/order.route"));
const notification_route_1 = __importDefault(require("./routes/notification.route"));
const analytics_route_1 = __importDefault(require("./routes/analytics.route"));
const layout_route_1 = __importDefault(require("./routes/layout.route"));
const express_rate_limit_1 = require("express-rate-limit");
exports.app = (0, express_1.default)();
// Get the correct path to client build folder
const _dirname = path_1.default.resolve();
const clientDistPath = path_1.default.join(_dirname, "client", "dist");
console.log("Client dist path:", clientDistPath); // Debug line
// Debug: Check if client dist exists
if (!fs_1.default.existsSync(clientDistPath)) {
    console.warn("⚠️  Client dist folder not found at:", clientDistPath);
    console.warn("   Run: cd client && npm run build");
}
else {
    console.log("✅ Client dist found at:", clientDistPath);
    try {
        console.log("   Files:", fs_1.default.readdirSync(clientDistPath));
    }
    catch (err) {
        console.log("   Could not read directory contents");
    }
}
// Body parsing middleware
exports.app.use(express_1.default.json({ limit: "50mb" }));
exports.app.use(express_1.default.urlencoded({ extended: true, limit: "50mb" }));
exports.app.use((0, cookie_parser_1.default)());
// ✅ CORS Configuration
const corsOptions = {
    origin: ["http://localhost:3000", "http://localhost:8000"],
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
// Health check
exports.app.get("/health", (_, res) => {
    res.status(200).json({
        status: "healthy",
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
// Test route
exports.app.get("/test", (_, res) => {
    res.status(200).json({
        success: true,
        message: "API is working",
    });
});
// ✅ Serve static files from client/dist
exports.app.use(express_1.default.static(clientDistPath));
// ✅ Catch-all route for client-side routing (React/Vue/Angular)
exports.app.get("*", (req, res, next) => {
    // Check if the request is for an API route
    if (req.originalUrl.startsWith('/api/')) {
        return next(); // Let the 404 handler handle it
    }
    // Serve the React app's index.html
    res.sendFile(path_1.default.join(clientDistPath, "index.html"), (err) => {
        if (err) {
            console.error("Error sending index.html:", err);
            // Check if file exists
            if (!fs_1.default.existsSync(path_1.default.join(clientDistPath, "index.html"))) {
                res.status(404).json({
                    success: false,
                    message: "Client build not found. Run 'npm run build' in client folder."
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    message: "Internal server error"
                });
            }
        }
    });
});
// Global 404 handler
exports.app.all("*", (req, res, next) => {
    const err = new Error(`Route ${req.originalUrl} not found`);
    err.statusCode = 404;
    next(err);
});
// Error middleware
exports.app.use(error_1.ErrorMiddleware);
//# sourceMappingURL=app.js.map