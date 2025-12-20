"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRazorpayPayment = exports.createRazorpayOrder = exports.getAllOrders = exports.createOrder = void 0;
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const user_model_1 = __importDefault(require("../models/user.model"));
const course_model_1 = __importDefault(require("../models/course.model"));
const path_1 = __importDefault(require("path"));
const ejs_1 = __importDefault(require("ejs"));
const sendMail_1 = __importDefault(require("../utils/sendMail"));
const notificationModel_1 = __importDefault(require("../models/notificationModel"));
const order_service_1 = require("../services/order.service");
const razorpay_1 = __importDefault(require("razorpay"));
const crypto_1 = __importDefault(require("crypto"));
// ✅ Initialize Razorpay Instance
const razorpay = new razorpay_1.default({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET,
});
// ---------------------------
//  OLD STRIPE ORDER CREATION
// ---------------------------
exports.createOrder = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { courseId, payment_info } = req.body;
        const user = await user_model_1.default.findById(req.user?._id);
        // Check if already purchased
        const courseExistInUser = user?.courses.some((courseObj) => courseObj?.courseId?.toString() === courseId);
        if (courseExistInUser) {
            return next(new ErrorHandler_1.default("You have already purchased this course", 400));
        }
        const course = await course_model_1.default.findById(courseId);
        if (!course) {
            return next(new ErrorHandler_1.default("Course not found", 404));
        }
        const data = {
            courseId: course._id,
            userId: user?._id,
            payment_info,
        };
        // ✅ FIX: Use findByIdAndUpdate for user enrollment
        await user_model_1.default.findByIdAndUpdate(user?._id, {
            $push: {
                courses: {
                    courseId: course._id,
                    purchasedAt: new Date()
                }
            }
        }, { new: true });
        // ✅ Update course purchased count
        await course_model_1.default.findByIdAndUpdate(courseId, {
            $inc: { purchased: 1 }
        }, { new: true });
        // ... rest of your code (email, notification, etc.) ...
        (0, order_service_1.newOrder)(data, res, next);
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// ---------------------------
//  GET ALL ORDERS (ADMIN)
// ---------------------------
exports.getAllOrders = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        (0, order_service_1.getAllOrdersService)(res);
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// ---------------------------
//  NEW RAZORPAY FUNCTIONS
// ---------------------------
// -----------------------------------------------------------------------------
// ✅ 1. Create Razorpay Order - FIXED VERSION
// -----------------------------------------------------------------------------
exports.createRazorpayOrder = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { courseId } = req.body;
        // Validate courseId
        if (!courseId) {
            return next(new ErrorHandler_1.default("Course ID is required", 400));
        }
        const course = await course_model_1.default.findById(courseId);
        if (!course) {
            return next(new ErrorHandler_1.default("Course not found", 404));
        }
        // Check if user exists (for logged in users)
        const userId = req.user?._id;
        if (userId) {
            const user = await user_model_1.default.findById(userId);
            if (user) {
                // ✅ FIX: Check if already purchased (checking for object with courseId field)
                const alreadyBought = user.courses.some((courseObj) => courseObj.courseId?.toString() === courseId);
                if (alreadyBought) {
                    return next(new ErrorHandler_1.default("You already purchased this course", 400));
                }
            }
        }
        // Create Razorpay order
        const amount = course.price * 100; // Convert to paise
        const options = {
            amount,
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
            notes: { courseId, userId: userId || 'anonymous' },
        };
        const order = await razorpay.orders.create(options);
        res.status(200).json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID,
            courseName: course.name,
        });
    }
    catch (error) {
        console.error("Razorpay order creation error:", error);
        if (error.name === 'CastError') {
            return next(new ErrorHandler_1.default("Invalid ID format", 400));
        }
        next(new ErrorHandler_1.default(error.message || "Order creation failed", 500));
    }
});
// -----------------------------------------------------------------------------
// ✅ 2. Verify Razorpay Payment - FIXED VERSION
// -----------------------------------------------------------------------------
exports.verifyRazorpayPayment = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, courseId, userId, } = req.body;
        // Validate required fields
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return next(new ErrorHandler_1.default("Missing payment verification data", 400));
        }
        if (!courseId || !userId) {
            return next(new ErrorHandler_1.default("Course ID and User ID are required", 400));
        }
        // Verify signature
        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto_1.default
            .createHmac("sha256", process.env.RAZORPAY_SECRET)
            .update(sign)
            .digest("hex");
        if (expectedSign !== razorpay_signature) {
            console.warn("⚠️ Signature mismatch!");
            if (process.env.NODE_ENV === 'production') {
                return next(new ErrorHandler_1.default("Payment verification failed", 400));
            }
        }
        // Find user and course
        const user = await user_model_1.default.findById(userId);
        if (!user) {
            return next(new ErrorHandler_1.default("User not found", 404));
        }
        const course = await course_model_1.default.findById(courseId);
        if (!course) {
            return next(new ErrorHandler_1.default("Course not found", 404));
        }
        // Check if already enrolled
        const alreadyEnrolled = user.courses.some((courseObj) => courseObj?.courseId?.toString() === courseId);
        if (alreadyEnrolled) {
            return res.status(200).json({
                success: true,
                message: "Already enrolled in this course",
                alreadyEnrolled: true
            });
        }
        // ✅ FIX: Enroll the user in the course - Use findByIdAndUpdate to avoid validation issues
        await user_model_1.default.findByIdAndUpdate(userId, {
            $push: {
                courses: {
                    courseId: course._id,
                    purchasedAt: new Date()
                }
            }
        }, { new: true });
        // ✅ Update course purchased count
        await course_model_1.default.findByIdAndUpdate(courseId, {
            $inc: { purchased: 1 }
        }, { new: true });
        // Create order record
        const orderData = {
            courseId: course._id,
            userId: user._id,
            payment_info: {
                id: razorpay_payment_id,
                status: "succeeded",
                amount: course.price,
                currency: "INR",
            },
        };
        // Create notification
        await notificationModel_1.default.create({
            user: user._id,
            title: "New Order",
            message: `You have a new order for ${course.name}`,
        });
        // Send confirmation email
        try {
            const html = await ejs_1.default.renderFile(path_1.default.join(__dirname, "../mails/razorpay-success.ejs"), {
                name: user.name,
                amount: course.price,
                courseName: course.name,
                paymentId: razorpay_payment_id,
                orderId: razorpay_order_id,
            });
            await (0, sendMail_1.default)({
                email: user.email,
                subject: "🎉 Payment Successful — Course Access Granted!",
                html,
            });
        }
        catch (emailError) {
            console.warn("Failed to send email:", emailError);
        }
        // Send success response
        res.status(200).json({
            success: true,
            message: "Payment verified successfully! Course unlocked.",
            data: {
                courseId,
                courseName: course.name,
                paymentId: razorpay_payment_id,
                orderId: razorpay_order_id,
                enrolledAt: new Date().toISOString()
            }
        });
    }
    catch (error) {
        console.error("Payment verification error:", error);
        console.error("Full error details:", {
            message: error.message,
            stack: error.stack,
            errors: error.errors
        });
        if (error.name === 'CastError') {
            return next(new ErrorHandler_1.default("Invalid ID format", 400));
        }
        next(new ErrorHandler_1.default(error.message || "Payment verification failed", 500));
    }
});
//# sourceMappingURL=order.controller.js.map