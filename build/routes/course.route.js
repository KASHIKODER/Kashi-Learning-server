"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/course.routes.ts
const express_1 = __importDefault(require("express"));
const course_controller_1 = require("../controllers/course.controller");
const auth_1 = require("../middleware/auth");
const user_controller_1 = require("../controllers/user.controller");
const courseRouter = express_1.default.Router();
courseRouter.use((req, res, next) => {
    console.log(`[COURSE ROUTER] ${req.method} ${req.originalUrl}`);
    console.log(`[COURSE ROUTER] Path: ${req.path}, Base: ${req.baseUrl}`);
    next();
});
// ✅ Create Course
courseRouter.post("/create-course", user_controller_1.updateAccessToken, auth_1.isAuthenticated, (0, auth_1.authorizeRoles)("admin"), course_controller_1.uploadCourse);
courseRouter.get("/getVdoCipherOTP-test", (req, res) => {
    console.log("✅ GET /getVdoCipherOTP-test hit!");
    res.status(200).json({
        success: true,
        message: "GET route works!",
        timestamp: new Date().toISOString()
    });
});
// ✅ Get Admin Courses
courseRouter.get("/get-admin-courses", user_controller_1.updateAccessToken, auth_1.isAuthenticated, (0, auth_1.authorizeRoles)("admin"), course_controller_1.getAdminAllCourses);
// ✅ Edit Course
courseRouter.put("/edit-course/:id", user_controller_1.updateAccessToken, auth_1.isAuthenticated, (0, auth_1.authorizeRoles)("admin"), course_controller_1.editCourse);
// ✅ Get Single Course (Public)
courseRouter.get("/get-course/:id", course_controller_1.getSingleCourse);
// ✅ Get All Courses (Public)
courseRouter.get("/get-courses", course_controller_1.getAllCourses);
// ✅ Get Course Content (For enrolled users) - USING getCourseByUser
courseRouter.get("/get-course-content/:id", user_controller_1.updateAccessToken, auth_1.isAuthenticated, course_controller_1.getCourseByUser);
// ✅ Enroll in Course
courseRouter.post("/enroll-course/:id", user_controller_1.updateAccessToken, auth_1.isAuthenticated, course_controller_1.enrollCourse);
// ✅ Add Question
courseRouter.put("/add-question", user_controller_1.updateAccessToken, auth_1.isAuthenticated, course_controller_1.addQuestion);
// ✅ Add Answer
courseRouter.put("/add-answer", user_controller_1.updateAccessToken, auth_1.isAuthenticated, course_controller_1.addAnswer);
// ✅ Add Review
courseRouter.put("/add-review/:id", user_controller_1.updateAccessToken, auth_1.isAuthenticated, course_controller_1.addReview);
// ✅ Add Reply to Review
courseRouter.put("/add-reply", user_controller_1.updateAccessToken, auth_1.isAuthenticated, (0, auth_1.authorizeRoles)("admin"), course_controller_1.addReplyToReview);
// ✅ Generate Video OTP
courseRouter.post("/getVdoCipherOTP", course_controller_1.generateVideoUrl);
// ✅ Delete Course
courseRouter.delete("/delete-course/:id", user_controller_1.updateAccessToken, auth_1.isAuthenticated, (0, auth_1.authorizeRoles)("admin"), course_controller_1.deleteCourse);
exports.default = courseRouter;
//# sourceMappingURL=course.route.js.map