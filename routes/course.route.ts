// routes/course.routes.ts
import express from "express";
import { 
  enrollCourse, 
  addAnswer, 
  addQuestion, 
  addReplyToReview, 
  addReview, 
  deleteCourse, 
  editCourse,
  generateVideoUrl,
  getAdminAllCourses,
  getAllCourses,
  getCourseByUser,
  getSingleCourse,
  uploadCourse
} from "../controllers/course.controller";
import { authorizeRoles, isAuthenticated } from "../middleware/auth";
import { updateAccessToken } from "../controllers/user.controller";

const courseRouter = express.Router();

courseRouter.use((req, res, next) => {
  console.log(`[COURSE ROUTER] ${req.method} ${req.originalUrl}`);
  console.log(`[COURSE ROUTER] Path: ${req.path}, Base: ${req.baseUrl}`);
  next();
});

// ✅ Create Course
courseRouter.post(
  "/create-course",
  updateAccessToken,
  isAuthenticated,
  authorizeRoles("admin"),
  uploadCourse
);

courseRouter.get("/getVdoCipherOTP-test", (req, res) => {
  console.log("✅ GET /getVdoCipherOTP-test hit!");
  res.status(200).json({
    success: true,
    message: "GET route works!",
    timestamp: new Date().toISOString()
  });
});

// ✅ Get Admin Courses
courseRouter.get(
  "/get-admin-courses",
  updateAccessToken,
  isAuthenticated,
  authorizeRoles("admin"),
  getAdminAllCourses
);

// ✅ Edit Course
courseRouter.put(
  "/edit-course/:id",
  updateAccessToken,
  isAuthenticated,
  authorizeRoles("admin"),
  editCourse
);

// ✅ Get Single Course (Public)
courseRouter.get("/get-course/:id", getSingleCourse);

// ✅ Get All Courses (Public)
courseRouter.get("/get-courses", getAllCourses);

// ✅ Get Course Content (For enrolled users) - USING getCourseByUser
courseRouter.get(
  "/get-course-content/:id",
  updateAccessToken,
  isAuthenticated,
  getCourseByUser
);

// ✅ Enroll in Course
courseRouter.post(
  "/enroll-course/:id",
  updateAccessToken,
  isAuthenticated,
  enrollCourse
);

// ✅ Add Question
courseRouter.put(
  "/add-question",
  updateAccessToken,
  isAuthenticated,
  addQuestion
);

// ✅ Add Answer
courseRouter.put(
  "/add-answer",
  updateAccessToken,
  isAuthenticated,
  addAnswer
);

// ✅ Add Review
courseRouter.put(
  "/add-review/:id",
  updateAccessToken,
  isAuthenticated,
  addReview
);

// ✅ Add Reply to Review
courseRouter.put(
  "/add-reply",
  updateAccessToken,
  isAuthenticated,
  authorizeRoles("admin"),
  addReplyToReview
);

// ✅ Generate Video OTP
courseRouter.post("/getVdoCipherOTP", generateVideoUrl);

// ✅ Delete Course
courseRouter.delete(
  "/delete-course/:id",
  updateAccessToken,
  isAuthenticated,
  authorizeRoles("admin"),
  deleteCourse
);

export default courseRouter;