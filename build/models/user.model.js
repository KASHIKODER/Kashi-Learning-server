"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
require("dotenv").config();
const emailRegexPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const userSchema = new mongoose_1.default.Schema({
    name: {
        type: String,
        required: [true, "Please enter your name"],
    },
    email: {
        type: String,
        required: [true, "Please enter your email"],
        validate: {
            validator: function (email) {
                return emailRegexPattern.test(email);
            },
            message: "Please enter a valid email",
        },
        unique: true,
    },
    password: {
        type: String,
        minlength: [6, "Password must be at least 6 characters"],
        select: false,
    },
    avatar: {
        public_id: String,
        url: String,
    },
    role: {
        type: String,
        default: "user",
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    courses: [
        {
            courseId: {
                type: mongoose_1.default.Schema.Types.ObjectId,
                ref: "Course",
                required: true,
            },
            purchasedAt: { type: Date, default: Date.now },
        },
    ],
}, { timestamps: true });
// Password hashing
userSchema.pre("save", async function (next) {
    if (!this.isModified("password"))
        return next();
    this.password = await bcryptjs_1.default.hash(this.password, 10);
    next();
});
// Compare password
userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcryptjs_1.default.compare(enteredPassword, this.password);
};
// JWT tokens
userSchema.methods.SignAccessToken = function () {
    return jsonwebtoken_1.default.sign({ _id: this._id }, process.env.ACCESS_TOKEN || "", {
        expiresIn: "5m",
    });
};
userSchema.methods.SignRefreshToken = function () {
    return jsonwebtoken_1.default.sign({ _id: this._id }, process.env.REFRESH_TOKEN || "", {
        expiresIn: "3d",
    });
};
const userModel = mongoose_1.default.model("User", userSchema);
exports.default = userModel;
//# sourceMappingURL=user.model.js.map