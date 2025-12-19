require("dotenv").config();
import { Response } from "express";
import { IUser } from "../models/user.model";
import { redis } from "./redis";

interface ItokenOptions {
    expires: Date;
    maxAge: number;
    httpOnly: boolean;
    sameSite: 'lax' | 'strict' | 'none' | undefined;
    secure?: boolean;
}

// FIX: These calculations are wrong! They're multiplying too much.
// Current: 300 * 60 * 60 * 1000 = 300 hours (12.5 days) - WRONG!
// Should be: 5 minutes = 5 * 60 * 1000 = 300000 ms

const accessTokenExpire = parseInt(process.env.ACCESS_TOKEN_EXPIRE || '5', 10); // 5 minutes
const refreshTokenExpire = parseInt(process.env.REFRESH_TOKEN_EXPIRE || '3', 10); // 3 days

export const accessTokenOptions: ItokenOptions = {
    expires: new Date(Date.now() + accessTokenExpire * 60 * 1000), // minutes to milliseconds
    maxAge: accessTokenExpire * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
};

export const refreshTokenOptions: ItokenOptions = {
    expires: new Date(Date.now() + refreshTokenExpire * 24 * 60 * 60 * 1000), // days to milliseconds
    maxAge: refreshTokenExpire * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
};

export const sendToken = async (user: IUser, statusCode: number, res: Response) => {
    const accessToken = user.SignAccessToken();
    const refreshToken = user.SignRefreshToken();

    // ✅ Redis expiry set for 7 days
    await redis.set(String(user._id), JSON.stringify(user), 'EX', 7 * 24 * 60 * 60);

    // Set secure flag based on environment
    const isProduction = process.env.NODE_ENV === 'production';
    
    const accessTokenCookieOptions = { ...accessTokenOptions, secure: isProduction };
    const refreshTokenCookieOptions = { ...refreshTokenOptions, secure: isProduction };

    res.cookie("access_token", accessToken, accessTokenCookieOptions);
    res.cookie("refresh_token", refreshToken, refreshTokenCookieOptions);

    res.status(statusCode).json({
        success: true,
        accessToken,
        user,
    });
};