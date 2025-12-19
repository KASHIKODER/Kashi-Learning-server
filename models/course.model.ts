import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { IUser } from "./user.model";

interface IComment extends Document {
  user: IUser;
  question: string;
  questionReplies?: IComment[];
}

interface IReview extends Document {
  user: IUser;
  rating: number;
  comment: string;
  commentReplies: IComment[];
}

interface ILink extends Document {
  title: string;
  url: string;
}

interface ICourseData extends Document {
  title: string;
  description: string;
  videoUrl: string;
  videoThumbnail: string;
  videoSection: string;
  videoLength: number;
  videoPlayer: string;
  links: ILink[];
  suggestion: string;
  questions: IComment[];
}

interface IThumbnail {
  public_id: string;
  url: string;
}

interface ICourse extends Document {
  name: string;
  description: string;
  categories: string;
  price: number;
  estimatePrice?: number;
  thumbnail: IThumbnail;
  tags: string;
  level: string;
  demoUrl: string;
  benefits: { title: string }[];
  prerequisites: { title: string }[];
  reviews: IReview[];
  courseData: ICourseData[];
  ratings?: number;
  purchased?: number;
}

// Helper interfaces for schema definitions
interface ReviewSchemaDef {
  user: IUser;
  rating: number;
  comment: string;
  commentReplies: IComment[];
}

interface CommentSchemaDef {
  user: IUser;
  question: string;
  questionReplies: IComment[];
}

const reviewSchema = new Schema<ReviewSchemaDef>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  comment: {
    type: String,
    required: true,
  },
  commentReplies: [{
    type: Schema.Types.ObjectId,
    ref: 'Comment',
    default: [],
  }],
});

const linkSchema = new Schema<ILink>({
  title: {
    type: String,
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
});

const commentSchema = new Schema<CommentSchemaDef>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  question: {
    type: String,
    required: true,
  },
  questionReplies: [{
    type: Schema.Types.ObjectId,
    ref: 'Comment',
    default: [],
  }],
});

const courseDataSchema = new Schema<ICourseData>({
  videoUrl: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  videoSection: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  videoLength: {
    type: Number,
    required: true,
    min: 0,
  },
  videoPlayer: {
    type: String,
    required: true,
  },
  links: [linkSchema],
  suggestion: {
    type: String,
    required: true,
  },
  questions: [commentSchema],
});

const courseSchema = new Schema<ICourse>({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  categories: {
    type: String,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  estimatePrice: {
    type: Number,
    min: 0,
  },
  thumbnail: {
    public_id: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
  },
  tags: {
    type: String,
    required: true,
    trim: true,
  },
  level: {
    type: String,
    required: true,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
  },
  demoUrl: {
    type: String,
    required: true,
  },
  benefits: [{
    title: {
      type: String,
      required: true,
      trim: true,
    }
  }],
  prerequisites: [{
    title: {
      type: String,
      required: true,
      trim: true,
    }
  }],
  reviews: [reviewSchema],
  courseData: [courseDataSchema],
  ratings: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  purchased: {
    type: Number,
    default: 0,
    min: 0,
  },
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

const CourseModel = mongoose.model<ICourse>("Course", courseSchema);

export default CourseModel;