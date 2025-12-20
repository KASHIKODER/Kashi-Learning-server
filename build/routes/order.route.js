"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const order_controller_1 = require("../controllers/order.controller");
const user_controller_1 = require("../controllers/user.controller");
const orderRouter = express_1.default.Router();
// ============================================
// 🐛 DEBUG MIDDLEWARE - TEMPORARY
// ============================================
const debugAuth = (req, res, next) => {
    console.log("🔍 [DEBUG RAZORPAY] =========================================");
    console.log("🔍 [DEBUG RAZORPAY] Request received for:", req.method, req.originalUrl);
    console.log("🔍 [DEBUG RAZORPAY] Full URL:", req.protocol + '://' + req.get('host') + req.originalUrl);
    console.log("🔍 [DEBUG RAZORPAY] Request body:", JSON.stringify(req.body, null, 2));
    console.log("🔍 [DEBUG RAZORPAY] Headers:", {
        'content-type': req.headers['content-type'],
        authorization: req.headers.authorization,
        cookie: req.headers.cookie,
        origin: req.headers.origin,
        referer: req.headers.referer
    });
    console.log("🔍 [DEBUG RAZORPAY] Cookies (parsed):", req.cookies);
    console.log("🔍 [DEBUG RAZORPAY] Query params:", req.query);
    console.log("🔍 [DEBUG RAZORPAY] =========================================");
    next();
};
// ============================================
// 🧪 TEST ROUTES (PUBLIC - NO AUTH)
// ============================================
// Public test route
orderRouter.get("/test-public", (req, res) => {
    console.log("✅ Public test route hit!");
    res.status(200).json({
        success: true,
        message: "✅ Public route is working!",
        timestamp: new Date().toISOString(),
        path: req.originalUrl
    });
});
// Test route with authentication
orderRouter.get("/test-auth", auth_1.isAuthenticated, (req, res) => {
    console.log("✅ Auth test route hit!");
    res.status(200).json({
        success: true,
        message: "✅ Authenticated route is working!",
        timestamp: new Date().toISOString(),
        user: req.user,
        userId: req.user?._id
    });
});
// Simple POST test route
orderRouter.post("/test-razorpay-simple", (req, res) => {
    console.log("✅ Simple POST test route hit!");
    res.status(200).json({
        success: true,
        message: "Simple POST route works!",
        receivedBody: req.body,
        timestamp: new Date().toISOString()
    });
});
// ============================================
// 🧾 RAZORPAY ROUTES
// ============================================
orderRouter.post("/razorpay-order", debugAuth, order_controller_1.createRazorpayOrder);
orderRouter.post("/verify-payment", order_controller_1.verifyRazorpayPayment);
// ============================================
// 🧠 COURSE + ADMIN ROUTES
// ============================================
orderRouter.post("/create-order", auth_1.isAuthenticated, order_controller_1.createOrder);
orderRouter.get("/get-orders", user_controller_1.updateAccessToken, auth_1.isAuthenticated, (0, auth_1.authorizeRoles)("admin"), order_controller_1.getAllOrders);
// ============================================
// ✅ NO CATCH-ALL ROUTE NEEDED - REMOVED
// Express already has a global 404 handler in app.ts
// ============================================
exports.default = orderRouter;
//# sourceMappingURL=order.route.js.map