import mongoose, { Schema, Model } from 'mongoose';

export interface IBudgetEntry {
  _id?: string;
  userId: mongoose.Types.ObjectId | string;
  date: Date;
  category: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  recurring?: boolean;
  recurringFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  tags?: string[];
  notes?: string;
  linkedTo?: string; // Format: "expense:Name" or "creditCard:Name"
  createdAt?: Date;
  updatedAt?: Date;
}

const BudgetEntrySchema = new Schema<IBudgetEntry>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ['income', 'expense'],
      required: true,
      index: true,
    },
    recurring: {
      type: Boolean,
      default: false,
    },
    recurringFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly'],
    },
    tags: [{
      type: String,
    }],
    notes: {
      type: String,
    },
    linkedTo: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes for efficient querying
BudgetEntrySchema.index({ userId: 1, date: 1 });
BudgetEntrySchema.index({ userId: 1, date: 1, type: 1 });
BudgetEntrySchema.index({ userId: 1, category: 1, date: 1 });

const BudgetEntry: Model<IBudgetEntry> = 
  mongoose.models.BudgetEntry || mongoose.model<IBudgetEntry>('BudgetEntry', BudgetEntrySchema);

export default BudgetEntry;
