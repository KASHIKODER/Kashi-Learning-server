import { Response } from "express";
import CourseModel from "../models/course.model";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";


export const createCourse = async (data: any) => {
  const course = await CourseModel.create(data);
  return course;
};

export const getAllCoursesService = async (res: Response) => {
    const courses = await CourseModel.find().sort({ createdAt: -1 }); // ✅ correct model

    res.status(201).json({
        success: true,
        courses,
    });
}
