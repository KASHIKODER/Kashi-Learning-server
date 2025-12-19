import express from "express";
import { registrationUser , activateUser , loginUser , logoutUser , updateAccessToken, getUserInfo, socialAuth, updateUserInfo, updatePassword, updateProfilePicture, getAllUsers, updateUserRole, deleteUser} from "../controllers/user.controller";
import { authorizeRoles , isAuthenticated } from "../middleware/auth";
const userRouter = express.Router();

userRouter.post('/register',registrationUser);
userRouter.post('/activate-user',activateUser); // TODO: add activate controller
userRouter.post('/login',loginUser);
userRouter.get('/logout', updateAccessToken , isAuthenticated,logoutUser);
userRouter.get("/refresh", updateAccessToken);
userRouter.get("/me", updateAccessToken ,isAuthenticated,getUserInfo);
userRouter.post("/social-auth", socialAuth); // TODO: add social auth controller
userRouter.put("/update-user-info",updateAccessToken ,isAuthenticated, updateUserInfo);
userRouter.put("/update-user-password",updateAccessToken , isAuthenticated, updatePassword);
userRouter.put("/update-user-avatar",updateAccessToken , isAuthenticated, updateProfilePicture);

userRouter.get(
    "/get-users",
    updateAccessToken ,
    isAuthenticated,
    authorizeRoles("admin"),
    getAllUsers
);

userRouter.put(
    "/update-user",
    updateAccessToken ,
    isAuthenticated,
    authorizeRoles("admin"),
    updateUserRole
);

userRouter.delete(
    "/delete-user/:id",
    updateAccessToken ,
    isAuthenticated,
    authorizeRoles("admin"),
    deleteUser
)

export default userRouter;