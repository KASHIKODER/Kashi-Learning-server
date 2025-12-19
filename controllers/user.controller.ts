require("dotenv").config();
import { Request, Response, NextFunction } from "express";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import userModel, { IUser } from "../models/user.model";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import ejs from "ejs";
import path from "path";
import sendMail from "../utils/sendMail";
import { refreshTokenOptions, accessTokenOptions, sendToken } from "../utils/jwt";
import { redis } from "../utils/redis";
import { getAllUsersService, getUserById, updateUserRoleService } from "../services/user.service";
import cloudinary from "cloudinary";

interface IRegistrationBody {
    name: string;
    email: string;
    password: string;
    avatar?: string;
}

export const registrationUser = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { name, email, password } = req.body;

            const isEmailExist = await userModel.findOne({ email });
            if (isEmailExist) {
                return next(new ErrorHandler("Email already exists", 400));
            };
            const user: IRegistrationBody = { name, email, password };

            const activationToken = createActivationToken(user);

            const activationCode = activationToken.activationCode;

            const data = { user: { name: user.name }, activationCode };

            const html = await ejs.renderFile(path.join(__dirname, "../mails/activation-mail.ejs"), data);

            try {
                await sendMail({
                    email: user.email,
                    subject: "Activate your account",
                    template: "activation-mail.ejs",
                    data,
                });
                res.status(201).json({
                    success: true,
                    message: `Please check your email:- ${user.email} to activate your account!`,
                    activationToken: activationToken.token,
                });
            } catch (error: any) {
                return next(new ErrorHandler(error.message, 500));
            }

        } catch (error: any) {
            return next(new ErrorHandler(error.message, 500));
        }
    });

interface IActivationToken {
    token: string;
    activationCode: string;
}

export const createActivationToken = (user: any): IActivationToken => {
    const activationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const token = jwt.sign({
        user, activationCode
    },
        process.env.ACTIVATION_SECRET as Secret,
        {
            expiresIn: "5m",
        });

    return { token, activationCode };
};

interface IActivationRequest {
    activation_token: string;
    activation_code: string;
}

export const activateUser = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { activation_token, activation_code } = req.body as IActivationRequest;

            const newUser: { user: IUser; activationCode: string } = jwt.verify(
                activation_token,
                process.env.ACTIVATION_SECRET as string
            ) as { user: IUser; activationCode: string };

            if (newUser.activationCode !== activation_code) {
                return next(new ErrorHandler("Invalid activation code", 400));
            }
            const { name, email, password } = newUser.user;

            const exitUser = await userModel.findOne({ email });
            if (exitUser) {
                return next(new ErrorHandler("Email already exists", 400));
            }
            const user = await userModel.create({ name, email, password });

            res.status(201).json({
                success: true,
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 500));

        }
    });

//Login User

interface ILoginRequest {
    email: string;
    password: string;
}

export const loginUser = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email, password } = req.body as ILoginRequest;

            if (!email || !password) {
                return next(new ErrorHandler("Please enter email & password", 400));
            };

            const user = await userModel.findOne({ email }).select("+password");
            if (!user) {
                return next(new ErrorHandler("Invalid email or password", 400));
            };

            const isPasswordMatch = await user.comparePassword(password);
            if (!isPasswordMatch) {
                return next(new ErrorHandler("Invalid email or password", 400));
            };

            sendToken(user, 200, res);
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 500));
        }
    });

export const logoutUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none" as const,
        path: "/", // must match how cookies were set
      };

      // ✅ Properly clear cookies
      res.clearCookie("access_token", cookieOptions);
      res.clearCookie("refresh_token", cookieOptions);

      const userId = req.user?._id?.toString();
      if (userId) await redis.del(userId);

      return res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error: any) {
      console.error("Logout error:", error);
      return next(new ErrorHandler(error.message, 400));
    }
  }
);


export const updateAccessToken = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const refresh_token = req.cookies.refresh_token as string;
            
            if (!refresh_token) {
                return next(new ErrorHandler("Please login to access this resource", 401));
            }

            const decoded = jwt.verify(refresh_token, process.env.REFRESH_TOKEN as string) as JwtPayload;
            
            if (!decoded || !decoded._id) {
                return next(new ErrorHandler("Invalid refresh token", 401)); // Fixed this line
            }

            const session = await redis.get(decoded._id as string);
            if (!session) {
                return next(new ErrorHandler("Please login to access this resource", 401));
            }

            const user = JSON.parse(session);

            const accessToken = jwt.sign(
                { _id: user._id }, 
                process.env.ACCESS_TOKEN as string, 
                { expiresIn: "5m" }
            );

            const refreshToken = jwt.sign(
                { _id: user._id }, 
                process.env.REFRESH_TOKEN as string, 
                { expiresIn: "3d" }
            );

            req.user = user;

            res.cookie("access_token", accessToken, accessTokenOptions);
            res.cookie("refresh_token", refreshToken, refreshTokenOptions);

            await redis.set(user._id, JSON.stringify(user), "EX", 604800); // 7 days

            next();

        } catch (error: any) {
            console.error("Token refresh error:", error.message);
            
            if (error.name === 'TokenExpiredError') {
                return next(new ErrorHandler("Refresh token expired, please login again", 401));
            }
            
            if (error.name === 'JsonWebTokenError') {
                return next(new ErrorHandler("Invalid refresh token", 401));
            }
            
            return next(new ErrorHandler(error.message, 400));
        }
    }
);

export const getUserInfo = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?._id;
            getUserById(String(userId), res);
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
);

interface ISocialAuthBody {
    name: string;
    email: string;
    avatar: string;
}

export const socialAuth = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { name, email, avatar } = req.body as ISocialAuthBody;
            const user = await userModel.findOne({ email });
            if (!user) {
                const newUser = await userModel.create({ name, email, avatar, password: Math.random().toString(36).slice(-8) });
                sendToken(newUser, 201, res);
            } else {
                sendToken(user, 200, res);
            }
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
);

interface IUpdateUserInfo {
    name?: string;
    email?: string;
}

export const updateUserInfo = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?._id;
            const { name } = req.body as IUpdateUserInfo;
            const user = await userModel.findById(userId);
            if (name && user) {
                user.name = name;
            }
            await user?.save();
            await redis.set(String(userId), JSON.stringify(user));
            res.status(200).json({
                success: true,
                message: "User info updated successfully",
                user,
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
);

interface IUpdatePassword {
    oldPassword: string;
    newPassword: string;
}

export const updatePassword = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = await userModel.findById(req.user?._id).select("+password");
            const { oldPassword, newPassword } = req.body as IUpdatePassword;

            if (!oldPassword || !newPassword) {
                return next(new ErrorHandler("Please enter old & new password", 400));
            }

            if (user?.password === undefined) {
                return next(new ErrorHandler("Invalid user", 400));
            }

            const isPasswordMatch = await user?.comparePassword(oldPassword);
            if (!isPasswordMatch) {
                return next(new ErrorHandler("Old password is incorrect", 400));
            }

            user.password = newPassword;
            await user.save();

            await redis.set(String(user._id), JSON.stringify(user));

            res.status(200).json({
                success: true,
                message: "Password updated successfully",
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
);

interface IUpdateProfilePicture{
    avatar: string;
}

export const updateProfilePicture = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { avatar } = req.body;
            const userId = req.user?._id;

            const user = await userModel.findById(userId);

            if (avatar && user) {
                if (user?.avatar?.public_id) {
                    await cloudinary.v2.uploader.destroy(user?.avatar?.public_id);

                    const myCloud = await cloudinary.v2.uploader.upload(avatar, {
                        folder: "avatars",
                        width: 150,
                    });

                    user.avatar = {
                        public_id: myCloud.public_id,
                        url: myCloud.secure_url,
                    };
                } else {
                    const myCloud = await cloudinary.v2.uploader.upload(avatar, {
                        folder: "avatars",
                        width: 150,
                    });
                    user.avatar = {
                        public_id: myCloud.public_id,
                        url: myCloud.secure_url,
                    };
                }
            }
            await user?.save();

            await redis.set(String(user?._id), JSON.stringify(user));
            res.status(200).json({
                success: true,
                user,
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
);

export const getAllUsers = CatchAsyncError(
    async(req: Request , res: Response , next: NextFunction) => {
        try{
            getAllUsersService(res);
        }catch(error : any){
            return next(new ErrorHandler(error.message , 400))
        }
    }
);

export const updateUserRole = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, role } = req.body; // Should be userId, not id
    
    console.log("🔄 Updating user role:", { userId, role });
    
    if (!userId || !role) {
      return next(new ErrorHandler("User ID and role are required", 400));
    }

    // Find user
    const user = await userModel.findById(userId);
    
    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    // Update role
    user.role = role;
    await user.save();

    // ✅ CRITICAL: Update in Redis (for current sessions)
    await redis.set(userId, JSON.stringify(user));
    console.log("✅ Updated user in Redis:", user.role);

    // ✅ Generate NEW tokens with updated role
    const accessToken = jwt.sign(
      { _id: user._id },
      process.env.ACCESS_TOKEN as string,
      { expiresIn: "5m" }
    );

    const refreshToken = jwt.sign(
      { _id: user._id },
      process.env.REFRESH_TOKEN as string,
      { expiresIn: "3d" }
    );

    // ✅ Set new cookies (if API call is from browser)
    res.cookie("access_token", accessToken, {
      expires: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax"
    });

    res.cookie("refresh_token", refreshToken, {
      expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax"
    });

    // ✅ Return success response with new tokens
    res.status(200).json({
      success: true,
      message: `User role updated to ${role}`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        isVerified: user.isVerified
      },
      accessToken, // ✅ Send new tokens in response
      refreshToken
    });

  } catch (error: any) {
    console.error("❌ Update role error:", error);
    return next(new ErrorHandler(error.message, 400));
  }
});

export const deleteUser = CatchAsyncError(
    async (req: Request, res: Response , next :NextFunction) => {
        try{
            const {id} = req.params;

            const user = await userModel.findById(id);

            if(!user){
                return next (new ErrorHandler("User not found",404));
            }

            await user.deleteOne({ id });
            
            await redis.del(id);

            res.status(200).json({
                success: true,
                message: "User deleted successfully",
            });
        } catch (error: any){
            return next (new ErrorHandler (error.message, 400));
        }
    }
);
