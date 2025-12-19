import { NextFunction , Request , Response } from "express";
import ErrorHandler from "../utils/ErrorHandler";

// backend/middleware/error.ts
export const ErrorMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => {
    err.statusCode = err.statusCode || 500;
    err.message = err.message || "Internal Server Error";

    console.error("🔥 ERROR MIDDLEWARE CAUGHT:");
    console.error("Error Name:", err.name);
    console.error("Error Message:", err.message);
    console.error("Status Code:", err.statusCode);
    console.error("Request Path:", req.path);
    console.error("Request Method:", req.method);
    
    if (err.name === "CastError") {
        const message = `Resource not found. Invalid: ${err.path}`;
        err = new ErrorHandler(message, 400);
    }

    if (err.code === 11000){  // Fixed: should be err.code, not err.name
        const message = `Duplicate ${Object.keys(err.keyValue)} Entered`;
        err = new ErrorHandler(message, 400);
    } 

    if (err.name === "JsonWebTokenError") {
        const message = `JSON Web Token is invalid, try again`;
        err = new ErrorHandler(message, 400);
    }

    if (err.name === "TokenExpiredError") {
        const message = `JSON Web Token is expired, try again`;
        err = new ErrorHandler(message, 400);
    }   

    res.status(err.statusCode).json({
        success: false,
        message: err.message,
        // stack: err.stack, // Enable in development only
    });
}