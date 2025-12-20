"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllCoursesService = exports.createCourse = void 0;
const course_model_1 = __importDefault(require("../models/course.model"));
const createCourse = async (data) => {
    const course = await course_model_1.default.create(data);
    return course;
};
exports.createCourse = createCourse;
const getAllCoursesService = async (res) => {
    const courses = await course_model_1.default.find().sort({ createdAt: -1 }); // ✅ correct model
    res.status(201).json({
        success: true,
        courses,
    });
};
exports.getAllCoursesService = getAllCoursesService;
//# sourceMappingURL=course.service.js.map