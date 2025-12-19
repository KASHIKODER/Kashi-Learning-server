import mongoose, { Document, Schema, Model } from "mongoose";

export interface INotification extends Document {
  title: string;
  message: string;
  status: string;
  userId: string;
}

const notificationSchema = new Schema<INotification>(
  {
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      default: "unread",
    },
    userId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// ✅ FIX: Use model<T>() (less complex type), correct name, no union error
const NotificationModel = mongoose.model<INotification>(
  "Notification",
  notificationSchema
);

export default NotificationModel;
