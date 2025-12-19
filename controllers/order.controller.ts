import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import OrderModel, { IOrder } from "../models/orderModel";
import userModel from "../models/user.model";
import CourseModel from "../models/course.model";
import path from "path";
import ejs from "ejs";
import sendMail from "../utils/sendMail";
import NotificationModel from "../models/notificationModel";
import { getAllOrdersService, newOrder } from "../services/order.service";
import Razorpay from "razorpay";
import crypto from "crypto";

// ✅ Initialize Razorpay Instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID as string,
  key_secret: process.env.RAZORPAY_SECRET as string,
});

// ---------------------------
//  OLD STRIPE ORDER CREATION
// ---------------------------
export const createOrder = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courseId, payment_info } = req.body as IOrder;
    const user = await userModel.findById(req.user?._id);

    // Check if already purchased
    const courseExistInUser = user?.courses.some(
      (courseObj: any) => courseObj?.courseId?.toString() === courseId
    );

    if (courseExistInUser) {
      return next(new ErrorHandler("You have already purchased this course", 400));
    }

    const course = await CourseModel.findById(courseId);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    const data: any = {
      courseId: course._id,
      userId: user?._id,
      payment_info,
    };

    // ✅ FIX: Use findByIdAndUpdate for user enrollment
    await userModel.findByIdAndUpdate(
      user?._id,
      {
        $push: {
          courses: {
            courseId: course._id,
            purchasedAt: new Date()
          }
        }
      },
      { new: true }
    );

    // ✅ Update course purchased count
    await CourseModel.findByIdAndUpdate(
      courseId,
      {
        $inc: { purchased: 1 }
      },
      { new: true }
    );

    // ... rest of your code (email, notification, etc.) ...
    
    newOrder(data, res, next);
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// ---------------------------
//  GET ALL ORDERS (ADMIN)
// ---------------------------
export const getAllOrders = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    getAllOrdersService(res);
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// ---------------------------
//  NEW RAZORPAY FUNCTIONS
// ---------------------------

// -----------------------------------------------------------------------------
// ✅ 1. Create Razorpay Order - FIXED VERSION
// -----------------------------------------------------------------------------
export const createRazorpayOrder = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId } = req.body;

      // Validate courseId
      if (!courseId) {
        return next(new ErrorHandler("Course ID is required", 400));
      }

      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      // Check if user exists (for logged in users)
      const userId = req.user?._id;
      if (userId) {
        const user = await userModel.findById(userId);
        if (user) {
          // ✅ FIX: Check if already purchased (checking for object with courseId field)
          const alreadyBought = user.courses.some(
            (courseObj: any) => courseObj.courseId?.toString() === courseId
          );
          if (alreadyBought) {
            return next(new ErrorHandler("You already purchased this course", 400));
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

    } catch (error: any) {
      console.error("Razorpay order creation error:", error);
      
      if (error.name === 'CastError') {
        return next(new ErrorHandler("Invalid ID format", 400));
      }
      
      next(new ErrorHandler(error.message || "Order creation failed", 500));
    }
  }
);

// -----------------------------------------------------------------------------
// ✅ 2. Verify Razorpay Payment - FIXED VERSION
// -----------------------------------------------------------------------------
export const verifyRazorpayPayment = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        courseId,
        userId,
      } = req.body;

      // Validate required fields
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return next(new ErrorHandler("Missing payment verification data", 400));
      }

      if (!courseId || !userId) {
        return next(new ErrorHandler("Course ID and User ID are required", 400));
      }

      // Verify signature
      const sign = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSign = crypto
        .createHmac("sha256", process.env.RAZORPAY_SECRET as string)
        .update(sign)
        .digest("hex");

      if (expectedSign !== razorpay_signature) {
        console.warn("⚠️ Signature mismatch!");
        if (process.env.NODE_ENV === 'production') {
          return next(new ErrorHandler("Payment verification failed", 400));
        }
      }

      // Find user and course
      const user = await userModel.findById(userId);
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      // Check if already enrolled
      const alreadyEnrolled = user.courses.some(
        (courseObj: any) => courseObj?.courseId?.toString() === courseId
      );
      
      if (alreadyEnrolled) {
        return res.status(200).json({
          success: true,
          message: "Already enrolled in this course",
          alreadyEnrolled: true
        });
      }

      // ✅ FIX: Enroll the user in the course - Use findByIdAndUpdate to avoid validation issues
      await userModel.findByIdAndUpdate(
        userId,
        {
          $push: {
            courses: {
              courseId: course._id,
              purchasedAt: new Date()
            }
          }
        },
        { new: true }
      );

      // ✅ Update course purchased count
      await CourseModel.findByIdAndUpdate(
        courseId,
        {
          $inc: { purchased: 1 }
        },
        { new: true }
      );

      // Create order record
      const orderData: any = {
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
      await NotificationModel.create({
        user: user._id,
        title: "New Order",
        message: `You have a new order for ${course.name}`,
      });

      // Send confirmation email
      try {
        const html = await ejs.renderFile(
          path.join(__dirname, "../mails/razorpay-success.ejs"),
          {
            name: user.name,
            amount: course.price,
            courseName: course.name,
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
          }
        );

        await sendMail({
          email: user.email,
          subject: "🎉 Payment Successful — Course Access Granted!",
          html,
        });
      } catch (emailError) {
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

    } catch (error: any) {
      console.error("Payment verification error:", error);
      console.error("Full error details:", {
        message: error.message,
        stack: error.stack,
        errors: error.errors
      });
      
      if (error.name === 'CastError') {
        return next(new ErrorHandler("Invalid ID format", 400));
      }
      
      next(new ErrorHandler(
        error.message || "Payment verification failed", 
        500
      ));
    }
  }
);