"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendToken = exports.refreshTokenOptions = exports.accessTokenOptions = void 0;
require("dotenv").config();
const redis_1 = require("./redis");
// FIX: These calculations are wrong! They're multiplying too much.
// Current: 300 * 60 * 60 * 1000 = 300 hours (12.5 days) - WRONG!
// Should be: 5 minutes = 5 * 60 * 1000 = 300000 ms
const accessTokenExpire = parseInt(process.env.ACCESS_TOKEN_EXPIRE || '5', 10); // 5 minutes
const refreshTokenExpire = parseInt(process.env.REFRESH_TOKEN_EXPIRE || '3', 10); // 3 days
exports.accessTokenOptions = {
    expires: new Date(Date.now() + accessTokenExpire * 60 * 1000), // minutes to milliseconds
    maxAge: accessTokenExpire * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
};
exports.refreshTokenOptions = {
    expires: new Date(Date.now() + refreshTokenExpire * 24 * 60 * 60 * 1000), // days to milliseconds
    maxAge: refreshTokenExpire * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
};
const sendToken = async (user, statusCode, res) => {
    const accessToken = user.SignAccessToken();
    const refreshToken = user.SignRefreshToken();
    // ✅ Redis expiry set for 7 days
    await redis_1.redis.set(String(user._id), JSON.stringify(user), 'EX', 7 * 24 * 60 * 60);
    // Set secure flag based on environment
    const isProduction = process.env.NODE_ENV === 'production';
    const accessTokenCookieOptions = { ...exports.accessTokenOptions, secure: isProduction };
    const refreshTokenCookieOptions = { ...exports.refreshTokenOptions, secure: isProduction };
    res.cookie("access_token", accessToken, accessTokenCookieOptions);
    res.cookie("refresh_token", refreshToken, refreshTokenCookieOptions);
    res.status(statusCode).json({
        success: true,
        accessToken,
        user,
    });
};
exports.sendToken = sendToken;
//# sourceMappingURL=jwt.js.map