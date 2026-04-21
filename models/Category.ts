import mongoose, { Schema, Model } from 'mongoose';

export interface ICategory {
  _id?: string;
  name: string;
  color: string;
  icon?: string;
  type: 'income' | 'expense' | 'both';
  budget?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    color: {
      type: String,
      required: true,
    },
    icon: {
      type: String,
    },
    type: {
      type: String,
      enum: ['income', 'expense', 'both'],
      required: true,
    },
    budget: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

const Category: Model<ICategory> = 
  mongoose.models.Category || mongoose.model<ICategory>('Category', CategorySchema);

export default Category;
