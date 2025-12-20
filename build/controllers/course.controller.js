"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCourseContent = exports.enrollCourse = exports.generateVideoUrl = exports.deleteCourse = exports.getAdminAllCourses = exports.addReplyToReview = exports.addReview = exports.addAnswer = exports.addQuestion = exports.getCourseByUser = exports.getAllCourses = exports.getSingleCourse = exports.editCourse = exports.uploadCourse = void 0;
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const cloudinary_1 = __importDefault(require("cloudinary"));
const course_service_1 = require("../services/course.service");
const course_model_1 = __importDefault(require("../models/course.model"));
const redis_1 = require("../utils/redis");
const mongoose_1 = __importDefault(require("mongoose"));
const ejs_1 = __importDefault(require("ejs"));
const path_1 = __importDefault(require("path"));
const sendMail_1 = __importDefault(require("../utils/sendMail"));
const notificationModel_1 = __importDefault(require("../models/notificationModel"));
const axios_1 = __importDefault(require("axios"));
const course_model_2 = __importDefault(require("../models/course.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
exports.uploadCourse = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const data = req.body;
        const thumbnail = data.thumbnail;
        if (thumbnail) {
            const myCloud = await cloudinary_1.default.v2.uploader.upload(thumbnail, {
                folder: "courses"
            });
            data.thumbnail = {
                public_id: myCloud.public_id,
                url: myCloud.secure_url
            };
        }
        // ✅ now this returns the saved course
        const course = await (0, course_service_1.createCourse)(data);
        // ✅ clear cache
        await redis_1.redis.del('allCourses');
        res.status(201).json({
            success: true,
            course,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
exports.editCourse = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = req.body;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            return next(new ErrorHandler_1.default("Invalid course ID", 400));
        }
        const existingCourse = await course_model_1.default.findById(id);
        if (!existingCourse) {
            return next(new ErrorHandler_1.default("Course not found", 404));
        }
        const thumbnail = data.thumbnail;
        if (thumbnail && typeof thumbnail === "string" && !thumbnail.startsWith("http")) {
            if (existingCourse.thumbnail?.public_id) {
                await cloudinary_1.default.v2.uploader.destroy(existingCourse.thumbnail.public_id);
            }
            const uploaded = await cloudinary_1.default.v2.uploader.upload(thumbnail, { folder: "courses" });
            data.thumbnail = { public_id: uploaded.public_id, url: uploaded.secure_url };
        }
        else if (typeof thumbnail === "string" && thumbnail.startsWith("http")) {
            data.thumbnail = { public_id: existingCourse.thumbnail?.public_id ?? "", url: existingCourse.thumbnail?.url ?? "" };
        }
        else if (!thumbnail) {
            data.thumbnail = existingCourse.thumbnail ?? { public_id: "", url: "" };
        }
        const updatedCourse = await course_model_1.default.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
        // Clear cache
        await redis_1.redis.del("allCourses");
        res.status(200).json({
            success: true,
            message: "Course updated successfully",
            course: updatedCourse
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
exports.getSingleCourse = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const courseId = req.params.id;
        const isCatchExist = await redis_1.redis.get(courseId);
        if (isCatchExist) {
            const course = JSON.parse(isCatchExist);
            res.status(200).json({
                success: true,
                course,
            });
        }
        else {
            const course = await course_model_1.default.findById(req.params.id).select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links");
            await redis_1.redis.set(courseId, JSON.stringify(course), 'EX', 604800); //7days/.
            res.status(200).json({
                success: true,
                course,
            });
        }
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
exports.getAllCourses = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const courses = await course_model_1.default.find().select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links");
        res.status(200).json({
            success: true,
            courses,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
exports.getCourseByUser = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const user = req.user;
        const userId = user?._id;
        const courseId = req.params.id;
        if (!userId) {
            return next(new ErrorHandler_1.default("Unauthorized", 401));
        }
        // ✅ Fresh user from DB
        const freshUser = await user_model_1.default
            .findById(userId)
            .select("courses role email name");
        if (!freshUser) {
            return next(new ErrorHandler_1.default("User not found", 404));
        }
        console.log("🔎 getCourseByUser:", {
            userId: freshUser._id,
            role: freshUser.role,
            courseId,
            courses: freshUser.courses,
        });
        const isAdmin = freshUser.role === "admin";
        // ✅ Normal user ke liye: enrollment check
        if (!isAdmin) {
            const courseExists = freshUser.courses?.some((course) => {
                const byCourseId = course.courseId && course.courseId.toString() === courseId.toString();
                const byOwnId = course._id && course._id.toString() === courseId.toString();
                return byCourseId || byOwnId;
            });
            if (!courseExists) {
                console.log("⛔ User not enrolled in this course");
                return next(new ErrorHandler_1.default("You are not eligible to access this course", 403));
            }
        }
        // ✅ Course load with full courseData
        const course = await course_model_1.default.findById(courseId);
        if (!course) {
            return next(new ErrorHandler_1.default("Course not found", 404));
        }
        // 🔥 FINAL SHAPE: always { success, course }
        return res.status(200).json({
            success: true,
            course,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
exports.addQuestion = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { question, courseId, contentId } = req.body;
        const course = await course_model_1.default.findById(courseId);
        if (!mongoose_1.default.Types.ObjectId.isValid(contentId)) {
            return next(new ErrorHandler_1.default("Invalid content id", 400));
        }
        const courseContent = course?.courseData?.find((item) => item._id.equals(contentId));
        if (!courseContent) {
            return next(new ErrorHandler_1.default("Invalid content id", 400));
        }
        const newQuestion = {
            user: req.user,
            question,
            questionReplies: [],
        };
        courseContent.questions.push(newQuestion);
        await notificationModel_1.default.create({
            user: req.user?._id,
            title: "New Question Received",
            message: `You have a new question in ${courseContent.title}`,
        });
        await course?.save();
        res.status(200).json({
            success: true,
            course,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
exports.addAnswer = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { answer, courseId, contentId, questionId } = req.body;
        if (!req.user) {
            return next(new ErrorHandler_1.default("Unauthorized", 401));
        }
        const course = await course_model_1.default.findById(courseId);
        if (!course) {
            return next(new ErrorHandler_1.default("Course not found", 404));
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(contentId)) {
            return next(new ErrorHandler_1.default("Invalid content id", 400));
        }
        const courseContent = course?.courseData?.find((item) => item._id.equals(contentId));
        if (!courseContent) {
            return next(new ErrorHandler_1.default("Invalid content id", 400));
        }
        const question = courseContent?.questions?.find((item) => item._id.equals(questionId));
        if (!question) {
            return next(new ErrorHandler_1.default("Invalid question id", 400));
        }
        const newAnswer = {
            user: req.user,
            answer,
        };
        question.questionReplies?.push(newAnswer);
        await course?.save();
        // FIXED: Type-safe comparison with string conversion
        const userId = req.user?._id?.toString();
        const questionUserId = question.user._id?.toString();
        if (userId && questionUserId && userId === questionUserId) {
            // create a notification
            await notificationModel_1.default.create({
                user: userId,
                title: "New Question Reply Received",
                message: `You have a new question reply in ${courseContent.title}`
            });
        }
        else {
            const data = {
                name: question.user.name,
                title: courseContent.title,
            };
            const html = await ejs_1.default.renderFile(path_1.default.join(__dirname, "../mails/question-reply.ejs"), data);
            try {
                await (0, sendMail_1.default)({
                    email: question.user.email,
                    subject: "Question Reply",
                    template: "question-reply.ejs",
                    data,
                });
            }
            catch (error) {
                return next(new ErrorHandler_1.default(error.message, 500));
            }
        }
        res.status(200).json({
            success: true,
            course,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
exports.addReview = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const user = req.user;
        const userCourseList = user?.courses; // FIXED: Now TypeScript knows courses exists
        const courseId = req.params.id;
        const courseExists = userCourseList?.some((course) => {
            const courseIdStr = course._id?.toString();
            const paramIdStr = courseId.toString();
            return courseIdStr === paramIdStr;
        });
        if (!courseExists) {
            return next(new ErrorHandler_1.default("You are not eligible to access this course", 404));
        }
        const course = await course_model_1.default.findById(courseId);
        const { review, rating } = req.body;
        const reviewData = {
            user: req.user,
            comment: review,
            rating,
        };
        course?.reviews.push(reviewData);
        let avg = 0;
        course?.reviews.forEach((rev) => {
            avg += rev.rating;
        });
        if (course) {
            course.ratings = avg / course.reviews.length;
        }
        await course?.save();
        const notification = {
            title: "New Review Received",
            message: `${user?.name} has given a review in ${course?.name}`,
        };
        res.status(200).json({
            success: true,
            course,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
exports.addReplyToReview = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { comment, courseId, reviewId } = req.body;
        const course = await course_model_1.default.findById(courseId);
        if (!course) {
            return next(new ErrorHandler_1.default("Course not found", 404));
        }
        const review = course?.reviews?.find((rev) => rev._id.toString() === reviewId // FIXED: toStrong -> toString
        );
        if (!review) {
            return next(new ErrorHandler_1.default("Review not found", 404));
        }
        const replyData = {
            user: req.user,
            comment,
        };
        if (!review.commentReplies) {
            review.commentReplies = [];
        }
        review.commentReplies?.push(replyData);
        await course?.save();
        res.status(200).json({
            success: true,
            course
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
exports.getAdminAllCourses = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        (0, course_service_1.getAllCoursesService)(res);
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
exports.deleteCourse = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { id } = req.params;
        const course = await course_model_1.default.findById(id);
        if (!course) {
            return next(new ErrorHandler_1.default("Course not found", 404));
        }
        await course.deleteOne({ id });
        await redis_1.redis.del(id);
        res.status(200).json({
            success: true,
            message: "Course deleted successfully",
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
exports.generateVideoUrl = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { videoId } = req.body;
        console.log("🔐 Generating VdoCipher OTP for video:", videoId);
        console.log("🔑 API Secret present:", !!process.env.VDOCIPHER_API_SECRET);
        if (!videoId) {
            return next(new ErrorHandler_1.default("Video ID is required", 400));
        }
        // Check if videoId is already a URL (MP4, YouTube, etc.)
        if (videoId.includes('http') || videoId.includes('.mp4') || videoId.includes('youtube.com') || videoId.includes('vimeo.com')) {
            console.log("✅ Direct video URL detected, skipping VdoCipher");
            res.status(200).json({
                success: true,
                data: {
                    otp: "",
                    playbackInfo: "",
                    videoUrl: videoId
                }
            });
            return;
        }
        // Only for VdoCipher video IDs (should be something like: "abc123xyz")
        if (!process.env.VDOCIPHER_API_SECRET) {
            return next(new ErrorHandler_1.default("VdoCipher API secret not configured", 500));
        }
        console.log("📞 Calling VdoCipher API...");
        const response = await axios_1.default.post(`https://dev.vdocipher.com/api/videos/${videoId}/otp`, { ttl: 300 }, {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Apisecret ${process.env.VDOCIPHER_API_SECRET}`,
            },
            timeout: 10000
        });
        console.log("✅ VdoCipher response status:", response.status);
        res.status(200).json({
            success: true,
            data: response.data,
        });
    }
    catch (error) {
        console.error("❌ VdoCipher API Error:");
        console.error("Error Message:", error.message);
        console.error("Error Code:", error.code);
        console.error("Response Data:", error.response?.data);
        console.error("Response Status:", error.response?.status);
        // Check if it's a 404 from VdoCipher (video not found)
        if (error.response?.status === 404) {
            return next(new ErrorHandler_1.default("Video not found on VdoCipher", 404));
        }
        // Check if it's authentication error
        if (error.response?.status === 401) {
            return next(new ErrorHandler_1.default("Invalid VdoCipher API secret", 401));
        }
        // For other errors, return the videoId as direct URL
        res.status(200).json({
            success: true,
            data: {
                otp: "",
                playbackInfo: "",
                videoUrl: req.body.videoId
            }
        });
    }
});
exports.enrollCourse = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const user = req.user;
        const userId = user?._id;
        const courseId = req.params.id;
        if (!userId)
            return next(new ErrorHandler_1.default("Unauthorized user", 401));
        const freshUser = await user_model_1.default.findById(userId);
        if (!freshUser)
            return next(new ErrorHandler_1.default("User not found", 404));
        const course = await course_model_2.default.findById(courseId);
        if (!course)
            return next(new ErrorHandler_1.default("Course not found", 404));
        // Already enrolled check: compare ObjectId strings
        const alreadyEnrolled = freshUser.courses.some((c) => {
            if (c.courseId)
                return c.courseId.toString() === courseId.toString();
            if (c._id)
                return c._id.toString() === courseId.toString();
            return false;
        });
        if (alreadyEnrolled) {
            return res.status(200).json({ success: true, message: "Already enrolled" });
        }
        // Push courseId as ObjectId
        freshUser.courses.push({
            courseId: new mongoose_1.default.Types.ObjectId(courseId),
            purchasedAt: new Date(),
        });
        await freshUser.save();
        res.status(200).json({
            success: true,
            message: "Course enrolled successfully",
        });
    }
    catch (err) {
        return next(new ErrorHandler_1.default(err.message, 400));
    }
});
exports.getCourseContent = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const user = req.user;
        const userId = user?._id;
        const courseId = req.params.id;
        if (!userId) {
            return next(new ErrorHandler_1.default("Unauthorized", 401));
        }
        // ✅ Fresh user from DB
        const freshUser = await user_model_1.default
            .findById(userId)
            .select("courses role email name");
        if (!freshUser) {
            return next(new ErrorHandler_1.default("User not found", 404));
        }
        console.log("🔎 getCourseContent - User Check:", {
            userId: freshUser._id,
            role: freshUser.role,
            courseId,
            userCourses: freshUser.courses?.length || 0,
        });
        const isAdmin = freshUser.role === "admin";
        // ✅ Normal user ke liye: enrollment check
        if (!isAdmin) {
            const courseExists = freshUser.courses?.some((course) => {
                const byCourseId = course.courseId && course.courseId.toString() === courseId.toString();
                const byOwnId = course._id && course._id.toString() === courseId.toString();
                return byCourseId || byOwnId;
            });
            if (!courseExists) {
                console.log("⛔ User not enrolled in this course");
                return next(new ErrorHandler_1.default("You are not eligible to access this course", 403));
            }
        }
        // ✅ Course load with full courseData
        const course = await course_model_1.default.findById(courseId);
        if (!course) {
            return next(new ErrorHandler_1.default("Course not found", 404));
        }
        console.log("✅ Course Content Found:", {
            courseId: course._id,
            courseName: course.name,
            contentLength: course.courseData?.length || 0,
            contentSections: course.courseData?.map((item) => ({
                title: item.title,
                section: item.videoSection,
                length: item.videoLength
            }))
        });
        // 🔥 FINAL SHAPE: always { success, course }
        return res.status(200).json({
            success: true,
            course: {
                _id: course._id,
                name: course.name,
                courseData: course.courseData || []
            },
        });
    }
    catch (error) {
        console.error("❌ getCourseContent Error:", error);
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
//# sourceMappingURL=course.controller.js.map