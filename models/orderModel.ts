import mongoose, { Document, Schema } from "mongoose";

export interface IOrder extends Document {
  courseId: string;
  userId: string;
  payment_info: object;
}

const orderSchema = new Schema<IOrder>(
  {
    courseId: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    payment_info: {
      type: Object,
      required: true,
    },
  },
  { timestamps: true }
);

// ✅ FIX: remove explicit Model<IOrder> to avoid TS2590
const OrderModel = mongoose.model<IOrder>("Order", orderSchema);

export default OrderModel;
