import express from "express";
import { Request, Response, NextFunction } from "express";
import { authorizeRoles, isAuthenticated } from "../middleware/auth";
import {
  createOrder,
  getAllOrders,
  createRazorpayOrder,
  verifyRazorpayPayment,
} from "../controllers/order.controller";
import { updateAccessToken } from "../controllers/user.controller";

const orderRouter = express.Router();

// ============================================
// 🐛 DEBUG MIDDLEWARE - TEMPORARY
// ============================================
const debugAuth = (req: Request, res: Response, next: NextFunction) => {
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
orderRouter.get("/test-public", (req: Request, res: Response) => {
  console.log("✅ Public test route hit!");
  res.status(200).json({
    success: true,
    message: "✅ Public route is working!",
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  });
});

// Test route with authentication
orderRouter.get("/test-auth", 
  isAuthenticated, 
  (req: Request, res: Response) => {
    console.log("✅ Auth test route hit!");
    res.status(200).json({
      success: true,
      message: "✅ Authenticated route is working!",
      timestamp: new Date().toISOString(),
      user: req.user,
      userId: req.user?._id
    });
  }
);

// Simple POST test route
orderRouter.post("/test-razorpay-simple", (req: Request, res: Response) => {
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

orderRouter.post("/razorpay-order", debugAuth, createRazorpayOrder);
orderRouter.post("/verify-payment", verifyRazorpayPayment);

// ============================================
// 🧠 COURSE + ADMIN ROUTES
// ============================================
orderRouter.post("/create-order", isAuthenticated, createOrder);

orderRouter.get(
  "/get-orders",
  updateAccessToken,
  isAuthenticated,
  authorizeRoles("admin"),
  getAllOrders
);

// ============================================
// ✅ NO CATCH-ALL ROUTE NEEDED - REMOVED
// Express already has a global 404 handler in app.ts
// ============================================

export default orderRouter;