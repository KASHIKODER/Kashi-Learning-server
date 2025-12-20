"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeRoles = exports.isAuthenticated = void 0;
const catchAsyncErrors_1 = require("./catchAsyncErrors");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const redis_1 = require("../utils/redis");
exports.isAuthenticated = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    const access_token = req.cookies.access_token || req.headers.authorization?.split(' ')[1];
    console.log("🔍 Auth Check - Access token present:", !!access_token);
    if (!access_token) {
        console.log("❌ No access token found");
        return next(new ErrorHandler_1.default("Please login to access this resource", 401));
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(access_token, process.env.ACCESS_TOKEN);
        if (!decoded) {
            console.log("❌ Token verification failed");
            return next(new ErrorHandler_1.default("Invalid token, please login again", 400));
        }
        // Note: Check both '_id' and 'id' based on your JWT payload
        const userId = decoded._id || decoded.id;
        if (!userId) {
            console.log("❌ No user ID in token");
            return next(new ErrorHandler_1.default("Invalid token payload", 400));
        }
        const user = await redis_1.redis.get(userId);
        if (!user) {
            console.log("❌ User not found in Redis");
            return next(new ErrorHandler_1.default("Please login to access this resource", 404));
        }
        req.user = JSON.parse(user);
        // SAFE CHECK: Use optional chaining
        if (req.user && req.user.email && req.user.role) {
            console.log("✅ User authenticated:", req.user.email, "Role:", req.user.role);
        }
        else {
            console.log("✅ User authenticated but missing some properties");
        }
        next();
    }
    catch (error) {
        // If token expired, don't immediately return error
        // Let the updateAccessToken middleware handle it
        if (error.name === 'TokenExpiredError') {
            console.log("🔄 Access token expired, will be refreshed by updateAccessToken middleware");
            // Don't return error here - let the next middleware (updateAccessToken) handle it
            next();
        }
        else {
            console.log("❌ JWT Error:", error.message);
            return next(new ErrorHandler_1.default("Invalid or expired token", 401));
        }
    }
});
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        console.log("🔍 Role Check - User role:", req.user?.role, "Required roles:", roles);
        // Check if user exists and has a role
        if (!req.user || !req.user.role) {
            console.log("❌ No user or role found");
            return next(new ErrorHandler_1.default("User role not found", 403));
        }
        if (!roles.includes(req.user.role)) {
            console.log(`❌ Role: ${req.user.role} is not allowed to access this resource`);
            return next(new ErrorHandler_1.default(`Role: ${req.user.role} is not allowed to access this resource`, 403));
        }
        console.log("✅ Role authorized");
        next();
    };
};
exports.authorizeRoles = authorizeRoles;
//# sourceMappingURL=auth.js.map