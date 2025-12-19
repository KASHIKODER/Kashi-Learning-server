// backend/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "./catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import jwt, { JwtPayload } from "jsonwebtoken";
import { redis } from "../utils/redis";

import { updateAccessToken } from "../controllers/user.controller"; // Add this import

export const isAuthenticated = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        const access_token = req.cookies.access_token as string || req.headers.authorization?.split(' ')[1];

        console.log("🔍 Auth Check - Access token present:", !!access_token);
        
        if (!access_token) {
            console.log("❌ No access token found");
            return next(new ErrorHandler("Please login to access this resource", 401));
        }

        try {
            const decoded = jwt.verify(access_token, process.env.ACCESS_TOKEN as string) as JwtPayload;
            
            if (!decoded) {
                console.log("❌ Token verification failed");
                return next(new ErrorHandler("Invalid token, please login again", 400));
            }

            const user = await redis.get(decoded._id);

            if (!user) {
                console.log("❌ User not found in Redis");
                return next(new ErrorHandler("Please login to access this resource", 404));
            }

            req.user = JSON.parse(user) as any;
            console.log("✅ User authenticated:", req.user.email, "Role:", req.user.role);
            next();
        } catch (error: any) {
            // If token expired, don't immediately return error
            // Let the updateAccessToken middleware handle it
            if (error.name === 'TokenExpiredError') {
                console.log("🔄 Access token expired, will be refreshed by updateAccessToken middleware");
                // Don't return error here - let the next middleware (updateAccessToken) handle it
                next();
            } else {
                console.log("❌ JWT Error:", error.message);
                return next(new ErrorHandler("Invalid or expired token", 401));
            }
        }
    });

export const authorizeRoles = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        console.log("🔍 Role Check - User role:", req.user?.role, "Required roles:", roles);
        
        if (!req.user?.role) {
            console.log("❌ No user role found");
            return next(new ErrorHandler("User role not found", 403));
        }
        
        if (!roles.includes(req.user?.role || '')) {  
            console.log(`❌ Role: ${req.user?.role} is not allowed to access this resource`);
            return next(new ErrorHandler(`Role: ${req.user?.role} is not allowed to access this resource`, 403));
        }      
        
        console.log("✅ Role authorized");
        next(); 
    }; 
};