import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import cloudinary from "cloudinary";
import { createCourse, getAllCoursesService } from "../services/course.service";
import CourseModel from "../models/course.model";
import { redis } from "../utils/redis";
import mongoose from "mongoose";
import ejs from "ejs";
import path from "path";
import sendMail from "../utils/sendMail";
import { title } from "process";
import NotificationModel from "../models/notificationModel";
import axios from "axios";
import courseModel from "../models/course.model";
import userModel from "../models/user.model";


export const uploadCourse = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = req.body;
        const thumbnail = data.thumbnail;

        if (thumbnail) {
            const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
                folder: "courses"
            });
            data.thumbnail = {
                public_id: myCloud.public_id,
                url: myCloud.secure_url
            }
        }

        // ✅ now this returns the saved course
        const course = await createCourse(data);

        // ✅ clear cache
        await redis.del('allCourses');

        res.status(201).json({
            success: true,
            course,
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});



export const editCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const data: any = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new ErrorHandler("Invalid course ID", 400));
      }

      const existingCourse = await CourseModel.findById(id);
      if (!existingCourse) {
        return next(new ErrorHandler("Course not found", 404));
      }

      const thumbnail = data.thumbnail;

      if (thumbnail && typeof thumbnail === "string" && !thumbnail.startsWith("http")) {
        if (existingCourse.thumbnail?.public_id) {
          await cloudinary.v2.uploader.destroy(existingCourse.thumbnail.public_id);
        }
        const uploaded = await cloudinary.v2.uploader.upload(thumbnail, { folder: "courses" });
        data.thumbnail = { public_id: uploaded.public_id, url: uploaded.secure_url };
      } else if (typeof thumbnail === "string" && thumbnail.startsWith("http")) {
        data.thumbnail = { public_id: existingCourse.thumbnail?.public_id ?? "", url: existingCourse.thumbnail?.url ?? "" };
      } else if (!thumbnail) {
        data.thumbnail = existingCourse.thumbnail ?? { public_id: "", url: "" };
      }

      const updatedCourse = await CourseModel.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });

      // Clear cache
      await redis.del("allCourses");

      res.status(200).json({
        success: true,
        message: "Course updated successfully",
        course: updatedCourse
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);




export const getSingleCourse = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const courseId = req.params.id;
            const isCatchExist = await redis.get(courseId);  

            if (isCatchExist) {
                const course = JSON.parse(isCatchExist);

                res.status(200).json({
                    success: true,
                    course,
                });
            }
            else {
                const course = await CourseModel.findById(req.params.id).select(
                    "-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links"
                );

                await redis.set(courseId, JSON.stringify(course), 'EX', 604800); //7days/.
                res.status(200).json({
                    success: true,
                    course,
                });
            }

        } catch (error: any) {
            return next(new ErrorHandler(error.message, 500));
        }
    }
);

export const getAllCourses = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
                const courses = await CourseModel.find().select(
                    "-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links"
                );

                res.status(200).json({
                    success: true,
                    courses,
                });
            } catch (error: any) {
            return next(new ErrorHandler(error.message, 500));
        }
    }
);

export const getCourseByUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      const courseId = req.params.id;

      if (!userId) {
        return next(new ErrorHandler("Unauthorized", 401));
      }

      // ✅ Fresh user from DB
      const user = await userModel
        .findById(userId)
        .select("courses role email name");
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      console.log("🔎 getCourseByUser:", {
        userId: user._id,
        role: (user as any).role,
        courseId,
        courses: user.courses,
      });

      const isAdmin = (user as any).role === "admin";

      // ✅ Normal user ke liye: enrollment check
      if (!isAdmin) {
        const courseExists = user.courses?.some((course: any) => {
          const byCourseId =
            course.courseId &&
            course.courseId.toString() === courseId.toString();
          const byOwnId =
            course._id && course._id.toString() === courseId.toString();
          return byCourseId || byOwnId;
        });

        if (!courseExists) {
          console.log("⛔ User not enrolled in this course");
          return next(
            new ErrorHandler("You are not eligible to access this course", 403)
          );
        }
      }

      // ✅ Course load with full courseData
      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      // 🔥 FINAL SHAPE: always { success, course }
      return res.status(200).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

interface IAddQuestionData{
    question: string;
    courseId: string;
    contentId: string;
}

export const addQuestion = CatchAsyncError(
    async ( req: Request , res: Response, next: NextFunction)=>{
        try{
            const { question, courseId, contentId}: IAddQuestionData = req.body;
            const course = await CourseModel.findById(courseId);

            if(!mongoose.Types.ObjectId.isValid(contentId)){
                return next(new ErrorHandler("Invalid content id", 400));
            }

            const courseContent = course?.courseData?.find((item: any) =>
            item._id.equals(contentId)
            );

            if(!courseContent){
                return next(new ErrorHandler("Invalid content id",400));
            }

            const newQuestion: any = {
                user: req.user,
                question,
                questionReplies: [],
            };

            courseContent.questions.push(newQuestion);

            await NotificationModel.create({
                user: req.user?._id,
                title: "New Question Received",
                message: `You have a new question in ${courseContent.title}`,
            });

            await course?.save();

            res.status(200).json({
                success: true,
                course,
            });
        } catch (error: any){
            return next(new ErrorHandler(error.message, 500));
        }
    }
);

interface IAddAnswerData{
    answer: string;
    courseId: string;
    contentId: string;
    questionId: string; 
}

export const addAnswer = CatchAsyncError(async(req: Request, res: Response, next: NextFunction)=> {
    try{
        const {answer, courseId,contentId,questionId}:IAddAnswerData = req.body;
        
        if (!req.user) {
            return next(new ErrorHandler("Unauthorized", 401));
        }

        const course = await CourseModel.findById(courseId);
        if (!course) {
            return next(new ErrorHandler("Course not found", 404));
        }

        if(!mongoose.Types.ObjectId.isValid(contentId)){
            return next (new ErrorHandler("Invalid content id",400));
        }

        const courseContent = course?.courseData?.find((item: any) => 
        item._id.equals(contentId)
        );

        if(!courseContent){
            return next (new ErrorHandler("Invalid content id",400));
        }

        const question = courseContent?.questions?.find((item: any)=>
        item._id.equals(questionId)
        );

        if(!question){
            return next(new ErrorHandler("Invalid question id", 400));
        }

        const newAnswer: any ={
            user: req.user,
            answer,
        };

        question.questionReplies?.push(newAnswer);
        await course?.save();

        if(req.user?._id === question.user._id){
            // create a notification
            await NotificationModel.create({
                user: req.user?._id,
                title: "New Question Reply Received",
                message: `You have a new question reply in ${courseContent.title}`
            })
        }else{
            const data = {
                name: question.user.name,
                title: courseContent.title,
            }

            const html = await ejs.renderFile(path.join(__dirname,"../mails/question-reply.ejs"),data);

            try{
                await sendMail({
                    email:question.user.email,
                    subject: "Question Reply",
                    template: "question-reply.ejs",
                    data,
                });
            }catch (error: any){
                return next (new ErrorHandler(error.message, 500));
            }
        }
        res.status(200).json({
            success: true,
            course,
        }); 
    } catch(error: any){
        return next(new ErrorHandler(error.message, 500));
    }
});

interface IAddReviewData{
    review: string;
    rating: number;
    userId: string;
}

export const addReview = CatchAsyncError(async (req: Request , res: Response , next: NextFunction)=>{
    try{
        const userCourseList = req.user?.courses;

        const courseId = req.params.id;

        const courseExists = userCourseList?.some((course:any) => course._id.toString() === courseId.toString());

        if(!courseExists){
            return next(new ErrorHandler("You are not eligible to access this course", 404))
        }

        const course = await CourseModel.findById(courseId);

        const {review, rating} = req.body as IAddReviewData;

        const reviewData:any = {
            user: req.user,
            comment: review,
            rating,
        };

        course?.reviews.push(reviewData);

        let avg = 0;

        course?.reviews.forEach((rev: any)=>{
            avg += rev.rating;
        });

        if(course){
            course.ratings = avg / course.reviews.length;
        }

        await course?.save();

        const notification = {
            title: "New Review Received",
            message: `${req.user?.name} has given a review in ${course?.name}`,
        };

        res.status(200).json({
            success: true,
            course,
        });
    }catch (error: any){
        return next(new ErrorHandler(error.message, 500));
    }
}
);

interface IAddReviewData{
    comment: string;
    courseId: string;
    reviewId: string;
}

export const addReplyToReview = CatchAsyncError(
    async(req: Request, res: Response , next: NextFunction) =>{
        try{
            const { comment, courseId, reviewId } = req.body as IAddReviewData;

            const course = await CourseModel.findById(courseId);

            if(!course){
                return next (new ErrorHandler("Course not found", 404));
            }

            const review = course?.reviews?.find(
                (rev: any) => rev._id.toStrong() === reviewId
            );

            if(!review){
                return next (new ErrorHandler("Review not found",404));
            }

            const replyData: any = {
                user: req.user,
                comment,
            };

            if(!review.commentReplies){
                review.commentReplies = [];
            }
            
            review.commentReplies?.push(replyData);

            await course?.save();

            res.status(200).json({
                success: true,
                course
            });
        }catch(error: any){
            return next(new ErrorHandler(error.message, 500));
        }
    }
);

export const getAdminAllCourses = CatchAsyncError(
    async(req: Request , res: Response , next: NextFunction) => {
        try{
            getAllCoursesService(res);
        }catch(error : any){
            return next(new ErrorHandler(error.message , 400))
        }
    }
);

export const deleteCourse = CatchAsyncError(
    async (req: Request, res: Response , next :NextFunction) => {
        try{
            const {id} = req.params;

            const course = await CourseModel.findById(id);

            if(!course){
                return next (new ErrorHandler("Course not found",404));
            }

            await course.deleteOne({ id });
            
            await redis.del(id);

            res.status(200).json({
                success: true,
                message: "Course deleted successfully",
            });
        } catch (error: any){
            return next (new ErrorHandler (error.message, 400));
        }
    }
);

// In your course.controller.ts - Make sure this exists
export const generateVideoUrl = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { videoId } = req.body;
    
    console.log("🔐 Generating VdoCipher OTP for video:", videoId);
    console.log("🔑 API Secret present:", !!process.env.VDOCIPHER_API_SECRET);
    
    if (!videoId) {
      return next(new ErrorHandler("Video ID is required", 400));
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
      return next(new ErrorHandler("VdoCipher API secret not configured", 500));
    }

    console.log("📞 Calling VdoCipher API...");
    
    const response = await axios.post(
      `https://dev.vdocipher.com/api/videos/${videoId}/otp`,
      { ttl: 300 },
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Apisecret ${process.env.VDOCIPHER_API_SECRET}`,
        },
        timeout: 10000
      }
    );

    console.log("✅ VdoCipher response status:", response.status);
    
    res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error("❌ VdoCipher API Error:");
    console.error("Error Message:", error.message);
    console.error("Error Code:", error.code);
    console.error("Response Data:", error.response?.data);
    console.error("Response Status:", error.response?.status);
    
    // Check if it's a 404 from VdoCipher (video not found)
    if (error.response?.status === 404) {
      return next(new ErrorHandler("Video not found on VdoCipher", 404));
    }
    
    // Check if it's authentication error
    if (error.response?.status === 401) {
      return next(new ErrorHandler("Invalid VdoCipher API secret", 401));
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

// ------------------------------------------------------
//  Enroll Course Controller
// ------------------------------------------------------

export const enrollCourse = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?._id;
        const courseId = req.params.id;

        if (!userId) return next(new ErrorHandler("Unauthorized user", 401));

        const user = await userModel.findById(userId);
        if (!user) return next(new ErrorHandler("User not found", 404));

        const course = await courseModel.findById(courseId);
        if (!course) return next(new ErrorHandler("Course not found", 404));

        // Already enrolled check: compare ObjectId strings
        const alreadyEnrolled = user.courses.some((c: any) => {
            if (c.courseId) return c.courseId.toString() === courseId.toString();
            if (c._id) return c._id.toString() === courseId.toString();
            return false;
        });
        if (alreadyEnrolled) {
            return res.status(200).json({ success: true, message: "Already enrolled" });
        }

        // Push courseId as ObjectId
        user.courses.push({
            courseId: new mongoose.Types.ObjectId(courseId),
            purchasedAt: new Date(),
        });

        await user.save();

        res.status(200).json({
            success: true,
            message: "Course enrolled successfully",
        });
    } catch (err: any) {
        return next(new ErrorHandler(err.message, 400));
    }
});
// Add this to your course.controller.ts
export const getCourseContent = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      const courseId = req.params.id;

      if (!userId) {
        return next(new ErrorHandler("Unauthorized", 401));
      }

      // ✅ Fresh user from DB
      const user = await userModel
        .findById(userId)
        .select("courses role email name");
      
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      console.log("🔎 getCourseContent - User Check:", {
        userId: user._id,
        role: (user as any).role,
        courseId,
        userCourses: user.courses?.length || 0,
      });

      const isAdmin = (user as any).role === "admin";

      // ✅ Normal user ke liye: enrollment check
      if (!isAdmin) {
        const courseExists = user.courses?.some((course: any) => {
          const byCourseId = course.courseId && course.courseId.toString() === courseId.toString();
          const byOwnId = course._id && course._id.toString() === courseId.toString();
          return byCourseId || byOwnId;
        });

        if (!courseExists) {
          console.log("⛔ User not enrolled in this course");
          return next(new ErrorHandler("You are not eligible to access this course", 403));
        }
      }

      // ✅ Course load with full courseData
      const course = await CourseModel.findById(courseId);
      
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      console.log("✅ Course Content Found:", {
        courseId: course._id,
        courseName: course.name,
        contentLength: course.courseData?.length || 0,
        contentSections: course.courseData?.map((item: any) => ({
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
    } catch (error: any) {
      console.error("❌ getCourseContent Error:", error);
      return next(new ErrorHandler(error.message, 500));
    }
  }
);