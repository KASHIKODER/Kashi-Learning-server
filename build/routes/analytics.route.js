"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const analytics_controller_1 = require("../controllers/analytics.controller");
const user_controller_1 = require("../controllers/user.controller"); // Import this
const analyticsRouter = express_1.default.Router();
// Add updateAccessToken BEFORE isAuthenticated
analyticsRouter.get("/get-users-analytics", user_controller_1.updateAccessToken, // This will refresh token if needed
auth_1.isAuthenticated, // This will check authentication
(0, auth_1.authorizeRoles)("admin"), analytics_controller_1.getUsersAnalytics);
analyticsRouter.get("/get-orders-analytics", user_controller_1.updateAccessToken, auth_1.isAuthenticated, (0, auth_1.authorizeRoles)("admin"), analytics_controller_1.getOrderAnalytics);
analyticsRouter.get("/get-courses-analytics", user_controller_1.updateAccessToken, auth_1.isAuthenticated, (0, auth_1.authorizeRoles)("admin"), analytics_controller_1.getCoursesAnalytics);
exports.default = analyticsRouter;
//# sourceMappingURL=analytics.route.js.map