import  express from "express";
import { authorizeRoles, isAuthenticated } from "../middleware/auth";
import { getCoursesAnalytics, getOrderAnalytics, getUsersAnalytics } from "../controllers/analytics.controller";
import { updateAccessToken } from "../controllers/user.controller"; // Import this

const analyticsRouter = express.Router();

// Add updateAccessToken BEFORE isAuthenticated
analyticsRouter.get("/get-users-analytics", 
    updateAccessToken,  // This will refresh token if needed
    isAuthenticated,    // This will check authentication
    authorizeRoles("admin"),
    getUsersAnalytics
);

analyticsRouter.get("/get-orders-analytics", 
    updateAccessToken,
    isAuthenticated,
    authorizeRoles("admin"),
    getOrderAnalytics
);

analyticsRouter.get("/get-courses-analytics", 
    updateAccessToken,
    isAuthenticated,
    authorizeRoles("admin"),
    getCoursesAnalytics
);

export default analyticsRouter;