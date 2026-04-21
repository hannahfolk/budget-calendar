import mongoose, { Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IMonthlyExpense {
  name: string;
  amount: number;
  account: 'personal' | 'joint';
  addedBy?: string; // User ID of who created this item
}

export interface IRecurringDeposit {
  name: string;
  amount: number;
  account: 'personal' | 'joint';
  frequency: 'weekly' | 'biweekly' | 'monthly';
  startDate: Date;
  skippedDates?: string[];
  amountHistory?: { amount: number; effectiveDate: string }[];
  addedBy?: string; // User ID of who created this item
}

export interface ICreditCard {
  name: string;
  projected: number;        // Overall monthly budget
  actual: number;           // Overall actual (current month)
  jointProjected: number;   // Joint portion of monthly budget
  jointActual: number;      // Joint actual (current month)
  closingDay: number;       // Day of month when statement closes (1-31)
  account: 'personal' | 'joint';
  addedBy?: string; // User ID of who created this item
}

export interface ICreditCardMonthlyHistory {
  cardName: string;
  year: number;
  month: number; // 0-11
  actual: number; // Personal total
  joint: number;  // Joint subtotal
  projected?: number;      // Overall projected budget for this month
  jointProjected?: number; // Joint projected budget for this month
}

export interface IUser {
  _id?: string;
  email: string;
  password: string;
  name: string;
  monthlyExpenses: IMonthlyExpense[];
  recurringDeposits: IRecurringDeposit[];
  creditCards: ICreditCard[]; // Joint credit card budgets
  creditCardOrder: string[]; // Per-user display order for joint credit cards (array of card names)
  personalCreditCards: ICreditCard[]; // Personal credit card budgets
  creditCardHistory: ICreditCardMonthlyHistory[];
  personalStartingBalance: number;
  jointStartingBalance: number;
  // Partner relationship
  partnerId?: mongoose.Types.ObjectId;
  partnerInviteCode?: string;        // 6-char code, expires in 24h
  partnerInviteCodeExpiry?: Date;
  // Password reset
  passwordResetToken?: string;
  passwordResetExpiry?: Date;
  // Onboarding tracking
  onboardingCompleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

type UserModel = Model<IUser, {}, IUserMethods>;

const MonthlyExpenseSchema = new Schema<IMonthlyExpense>({
  name: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    default: 0,
  },
  account: {
    type: String,
    enum: ['personal', 'joint'],
    required: true,
    default: 'joint',
  },
  addedBy: {
    type: String,
  },
});

const RecurringDepositSchema = new Schema<IRecurringDeposit>({
  name: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    default: 0,
  },
  account: {
    type: String,
    enum: ['personal', 'joint'],
    required: true,
  },
  frequency: {
    type: String,
    enum: ['weekly', 'biweekly', 'monthly'],
    required: true,
    default: 'biweekly',
  },
  startDate: {
    type: Date,
    required: true,
    default: () => new Date('2025-01-03'), // A known Friday
  },
  skippedDates: {
    type: [String],
    default: [],
  },
  amountHistory: {
    type: [{ amount: Number, effectiveDate: String }],
    default: [],
  },
  addedBy: {
    type: String,
  },
});

const CreditCardSchema = new Schema<ICreditCard>({
  name: {
    type: String,
    required: true,
  },
  projected: {
    type: Number,
    required: true,
    default: 0,
  },
  actual: {
    type: Number,
    required: true,
    default: 0,
  },
  jointProjected: {
    type: Number,
    default: 0,
  },
  jointActual: {
    type: Number,
    default: 0,
  },
  closingDay: {
    type: Number,
    required: true,
    min: 1,
    max: 31,
    default: 15,
  },
  account: {
    type: String,
    enum: ['personal', 'joint'],
    required: true,
    default: 'personal',
  },
  addedBy: {
    type: String,
  },
});

const CreditCardMonthlyHistorySchema = new Schema<ICreditCardMonthlyHistory>({
  cardName: {
    type: String,
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  month: {
    type: Number,
    required: true,
    min: 0,
    max: 11,
  },
  actual: {
    type: Number,
    required: true,
    default: 0,
  },
  joint: {
    type: Number,
    default: 0,
  },
  projected: {
    type: Number,
  },
  jointProjected: {
    type: Number,
  },
});

const UserSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    monthlyExpenses: {
      type: [MonthlyExpenseSchema],
      default: [
        { name: 'Rent', amount: 2000, account: 'joint' },
        { name: 'Acting', amount: 250, account: 'personal' },
        { name: 'Singing', amount: 175, account: 'personal' },
      ],
    },
    recurringDeposits: {
      type: [RecurringDepositSchema],
      default: [
        { name: 'Paycheck', amount: 625, account: 'joint', frequency: 'biweekly', startDate: new Date('2025-01-03') },
        { name: 'Paycheck', amount: 473.93, account: 'personal', frequency: 'biweekly', startDate: new Date('2025-01-03') },
      ],
    },
    creditCards: {
      type: [CreditCardSchema],
      default: [],
    },
    creditCardOrder: {
      type: [String],
      default: [],
    },
    personalCreditCards: {
      type: [CreditCardSchema],
      default: [],
    },
    creditCardHistory: {
      type: [CreditCardMonthlyHistorySchema],
      default: [],
    },
    personalStartingBalance: {
      type: Number,
      default: 0,
    },
    jointStartingBalance: {
      type: Number,
      default: 0,
    },
    // Partner relationship
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    partnerInviteCode: {
      type: String,
    },
    partnerInviteCodeExpiry: {
      type: Date,
    },
    // Password reset
    passwordResetToken: {
      type: String,
    },
    passwordResetExpiry: {
      type: Date,
    },
    // Onboarding tracking
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

const User: UserModel = mongoose.models.User || mongoose.model<IUser, UserModel>('User', UserSchema);

export default User;
