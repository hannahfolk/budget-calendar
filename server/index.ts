import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import BudgetEntry from '../models/BudgetEntry';
import Category from '../models/Category';
import User from '../models/User';

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/budget-calendar';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || `http://localhost:${process.env.NEXT_PUBLIC_FRONTEND_PORT || 4000}`;

// Email transporter for password reset
const createEmailTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

const emailTransporter = createEmailTransporter();

// Extend Express Request to include user
interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Auth Middleware
const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// ==================== Auth Routes ====================

// Register
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const user = new User({ email, password, name });
    await user.save();

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        monthlyExpenses: user.monthlyExpenses,
        recurringDeposits: user.recurringDeposits || [],
        creditCards: user.creditCards || [],
        personalCreditCards: user.personalCreditCards || [],
        personalStartingBalance: user.personalStartingBalance || 0,
        jointStartingBalance: user.jointStartingBalance || 0,
        onboardingCompleted: user.onboardingCompleted || false,
        partnerId: user.partnerId,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to register' });
  }
});

// Login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Merge partner data (same as /api/auth/me)
    let partnerName: string | undefined;
    let partnerJointExpenses: any[] = [];
    let mergedDeposits = [...(user.recurringDeposits || [])];
    const userCreditCards = [...(user.creditCards || [])];

    if (user.partnerId) {
      const partner = await User.findById(user.partnerId);
      if (partner) {
        partnerName = partner.name;
        partnerJointExpenses = partner.monthlyExpenses.filter(
          (e: any) => e.account === 'joint'
        ).filter(
          (e: any) => !user.monthlyExpenses.find((ue: any) => ue.name === e.name && ue.account === 'joint')
        );
        const partnerJointDeposits = (partner.recurringDeposits || []).filter(
          (d: any) => d.account === 'joint'
        );
        for (const deposit of partnerJointDeposits) {
          if (!mergedDeposits.find((d: any) => d.name === deposit.name && d.account === 'joint')) {
            mergedDeposits.push(deposit);
          }
        }
        for (const card of (partner.creditCards || [])) {
          if (!userCreditCards.find((c: any) => c.name === card.name)) {
            userCreditCards.push(card);
          }
        }
      }
    }

    // Sort credit cards by user's per-user display order
    const creditCardOrder = user.creditCardOrder || [];
    if (creditCardOrder.length > 0) {
      userCreditCards.sort((a: any, b: any) => {
        const aIdx = creditCardOrder.indexOf(a.name);
        const bIdx = creditCardOrder.indexOf(b.name);
        if (aIdx === -1 && bIdx === -1) return 0;
        if (aIdx === -1) return 1;
        if (bIdx === -1) return 1;
        return aIdx - bIdx;
      });
    }

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        monthlyExpenses: user.monthlyExpenses,
        partnerJointExpenses,
        recurringDeposits: mergedDeposits,
        creditCards: userCreditCards,
        personalCreditCards: user.personalCreditCards || [],
        personalStartingBalance: user.personalStartingBalance || 0,
        jointStartingBalance: user.jointStartingBalance || 0,
        onboardingCompleted: user.onboardingCompleted || false,
        partnerId: user.partnerId,
        partnerName,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Forgot password - generate reset token
app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal whether the email exists - return same success message
      return res.json({
        message: 'If an account exists with that email, a password reset link has been sent.',
      });
    }

    // Generate a random reset token (6 characters)
    const resetToken = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Set expiry to 1 hour from now
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);

    user.passwordResetToken = resetToken;
    user.passwordResetExpiry = resetExpiry;
    await user.save();

    const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    if (emailTransporter) {
      try {
        await emailTransporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: email,
          subject: 'Password Reset - Budget Calendar',
          html: `
            <h2>Password Reset Request</h2>
            <p>You requested a password reset for your Budget Calendar account.</p>
            <p>Your reset code is: <strong>${resetToken}</strong></p>
            <p>Or click the link below to reset your password:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <p>This code expires in 1 hour.</p>
            <p>If you did not request this, please ignore this email.</p>
          `,
        });
        console.log(`Password reset email sent to ${email}`);
      } catch (emailError) {
        console.error('Failed to send reset email:', emailError);
        return res.status(500).json({ error: 'Failed to send reset email. Please check SMTP configuration.' });
      }
    } else {
      console.warn('No SMTP configured. Reset token logged to console only.');
      console.log(`Password reset token for ${email}: ${resetToken}`);
    }

    res.json({
      message: 'If an account exists with that email, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Reset password - validate token and update password
app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: 'Email, token, and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      passwordResetToken: token.toUpperCase(),
      passwordResetExpiry: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpiry = undefined;
    await user.save();

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Get current user
app.get('/api/auth/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get partner info if linked
    let partnerName: string | undefined;
    let partnerJointExpenses: any[] = [];
    let mergedDeposits = [...(user.recurringDeposits || [])];
    const userCreditCards = [...(user.creditCards || [])];

    if (user.partnerId) {
      const partner = await User.findById(user.partnerId);
      if (partner) {
        partnerName = partner.name;

        // Collect partner's joint expenses separately (not merged into user's array)
        partnerJointExpenses = partner.monthlyExpenses.filter(
          (e: any) => e.account === 'joint'
        ).filter(
          // Exclude any that the user already has (by name + account)
          (e: any) => !user.monthlyExpenses.find((ue: any) => ue.name === e.name && ue.account === 'joint')
        );

        // Merge partner's joint deposits (avoid duplicates by name)
        const partnerJointDeposits = (partner.recurringDeposits || []).filter(
          (d: any) => d.account === 'joint'
        );
        for (const deposit of partnerJointDeposits) {
          if (!mergedDeposits.find((d: any) => d.name === deposit.name && d.account === 'joint')) {
            mergedDeposits.push(deposit);
          }
        }

        // Merge partner's credit cards dynamically (not stored on user, fetched at read time)
        for (const card of (partner.creditCards || [])) {
          if (!userCreditCards.find((c: any) => c.name === card.name)) {
            userCreditCards.push(card);
          }
        }
      }
    }

    // Sort credit cards by user's per-user display order
    const creditCardOrder = user.creditCardOrder || [];
    if (creditCardOrder.length > 0) {
      userCreditCards.sort((a: any, b: any) => {
        const aIdx = creditCardOrder.indexOf(a.name);
        const bIdx = creditCardOrder.indexOf(b.name);
        // Cards not in order array go to the end
        if (aIdx === -1 && bIdx === -1) return 0;
        if (aIdx === -1) return 1;
        if (bIdx === -1) return 1;
        return aIdx - bIdx;
      });
    }

    res.json({
      id: user._id,
      email: user.email,
      name: user.name,
      monthlyExpenses: user.monthlyExpenses,
      partnerJointExpenses,
      recurringDeposits: mergedDeposits,
      creditCards: userCreditCards,
      personalCreditCards: user.personalCreditCards || [],
      personalStartingBalance: user.personalStartingBalance || 0,
      jointStartingBalance: user.jointStartingBalance || 0,
      onboardingCompleted: user.onboardingCompleted || false,
      partnerId: user.partnerId,
      partnerName,
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ==================== Profile Routes ====================

// Update profile (name, email)
app.put('/api/user/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, email } = req.body;
    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if email is being changed and if it's already taken
    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      user.email = email.toLowerCase();
    }

    if (name) {
      user.name = name;
    }

    await user.save();

    // Generate new token with updated email
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
app.put('/api/user/password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Delete account
app.delete('/api/user/account', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required to delete account' });
    }

    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Password is incorrect' });
    }

    // If user has a partner, unlink them first
    if (user.partnerId) {
      const partner = await User.findById(user.partnerId);
      if (partner) {
        partner.partnerId = undefined;
        await partner.save();
      }
    }

    // Delete all budget entries for this user
    await BudgetEntry.deleteMany({ userId: user._id });

    // Delete the user
    await User.findByIdAndDelete(user._id);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// ==================== Monthly Expenses Routes ====================

// Get user's monthly expenses (own only — partner's joint expenses are returned separately via /api/auth/me)
app.get('/api/user/expenses', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user.monthlyExpenses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// Update all monthly expenses (user's own only — partner sees joint expenses dynamically via /api/auth/me)
app.put('/api/user/expenses', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { expenses } = req.body;
    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Stamp addedBy on new expenses that don't have it yet
    const stamped = expenses.map((e: any) => ({
      ...e,
      addedBy: e.addedBy || req.user!.userId,
    }));

    // Save only the current user's expenses
    user.monthlyExpenses = stamped;
    await user.save();

    res.json(user.monthlyExpenses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update expenses' });
  }
});

// Add a monthly expense
app.post('/api/user/expenses', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, amount, account = 'joint' } = req.body;
    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    user.monthlyExpenses.push({ name, amount, account, addedBy: req.user!.userId });
    await user.save();
    res.status(201).json(user.monthlyExpenses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

// Delete a monthly expense by name
app.delete('/api/user/expenses/:name', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    user.monthlyExpenses = user.monthlyExpenses.filter(
      (e) => e.name !== req.params.name
    );
    await user.save();
    res.json(user.monthlyExpenses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// ==================== Starting Balance Routes ====================

// Update starting balances (sync joint balance to partner)
app.put('/api/user/starting-balances', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { personalStartingBalance, jointStartingBalance } = req.body;

    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (typeof personalStartingBalance === 'number') {
      user.personalStartingBalance = personalStartingBalance;
    }
    if (typeof jointStartingBalance === 'number') {
      user.jointStartingBalance = jointStartingBalance;

      // Sync joint starting balance to partner if they have one
      if (user.partnerId) {
        const partner = await User.findById(user.partnerId);
        if (partner) {
          partner.jointStartingBalance = jointStartingBalance;
          await partner.save();
          console.log('Synced joint starting balance to partner');
        }
      }
    }

    await user.save();

    res.json({
      personalStartingBalance: user.personalStartingBalance,
      jointStartingBalance: user.jointStartingBalance,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update starting balances' });
  }
});

// ==================== Recurring Deposits Routes ====================

// Get user's recurring deposits (own personal + own joint + partner's joint)
app.get('/api/user/recurring-deposits', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Start with user's own deposits (both personal and joint)
    let deposits = [...user.recurringDeposits];

    // If user has a partner, also include partner's joint deposits
    if (user.partnerId) {
      const partner = await User.findById(user.partnerId);
      if (partner) {
        const partnerJointDeposits = partner.recurringDeposits.filter(
          (d: any) => d.account === 'joint'
        );
        // Add partner's joint deposits (avoid duplicates by name)
        for (const deposit of partnerJointDeposits) {
          const existingJoint = deposits.find(
            (d: any) => d.name === deposit.name && d.account === 'joint'
          );
          if (!existingJoint) {
            deposits.push(deposit);
          }
        }
      }
    }

    res.json(deposits);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recurring deposits' });
  }
});

// Update all recurring deposits (and sync joint deposits to partner)
app.put('/api/user/recurring-deposits', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { deposits } = req.body;
    console.log('=== Recurring Deposits Update ===');
    console.log('Received deposits:', JSON.stringify(deposits, null, 2));

    // Use findById and save() to ensure subdocuments are properly handled
    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Stamp addedBy on new deposits that don't have it yet
    const stamped = deposits.map((d: any) => ({
      ...d,
      addedBy: d.addedBy || req.user!.userId,
    }));

    // Replace the entire recurringDeposits array
    user.recurringDeposits = stamped;
    user.markModified('recurringDeposits');

    await user.save();

    // Sync joint deposits to partner if they have one
    if (user.partnerId) {
      const partner = await User.findById(user.partnerId);
      if (partner) {
        const userJointDeposits = deposits.filter((d: any) => d.account === 'joint');
        const partnerPersonalDeposits = partner.recurringDeposits.filter((d: any) => d.account === 'personal');
        partner.recurringDeposits = [...partnerPersonalDeposits, ...userJointDeposits];
        partner.markModified('recurringDeposits');
        await partner.save();
        console.log('Synced joint deposits to partner');
      }
    }

    console.log('Saved deposits:', JSON.stringify(user.recurringDeposits, null, 2));
    console.log('=== End Recurring Deposits Update ===');
    res.json(user.recurringDeposits);
  } catch (error) {
    console.error('Error updating recurring deposits:', error);
    res.status(500).json({ error: 'Failed to update recurring deposits' });
  }
});

// ==================== Credit Card Budgets Routes ====================

// Update all credit cards (Joint)
app.put('/api/user/credit-cards', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { cards } = req.body;
    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Stamp addedBy on new cards that don't have it yet
    const stamped = cards.map((card: any) => ({
      ...card,
      addedBy: card.addedBy || req.user!.userId,
    }));

    // Update user's credit cards (each user stores only their own cards)
    user.creditCards = stamped;
    await user.save();

    res.json(user.creditCards);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update credit cards' });
  }
});

// Update all personal credit card budgets
app.put('/api/user/personal-credit-cards', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { cards } = req.body;
    const stamped = cards.map((card: any) => ({
      ...card,
      addedBy: card.addedBy || req.user!.userId,
    }));
    const user = await User.findByIdAndUpdate(
      req.user!.userId,
      { personalCreditCards: stamped },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user.personalCreditCards);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update personal credit card budgets' });
  }
});

// Update credit card display order (per-user, no partner sync)
app.put('/api/user/credit-card-order', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { order } = req.body; // array of card names
    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    user.creditCardOrder = order;
    user.markModified('creditCardOrder');
    await user.save();
    res.json(user.creditCardOrder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update credit card order' });
  }
});

// ==================== Credit Card History Routes ====================

// Get credit card history for a specific month
app.get('/api/user/credit-card-history/:year/:month', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { year, month } = req.params;
    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const history = user.creditCardHistory.filter(
      (h: any) => h.year === parseInt(year) && h.month === parseInt(month)
    );
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch credit card history' });
  }
});

// Update credit card history for a specific month
app.put('/api/user/credit-card-history', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { cardName, year, month, actual, joint, projected, jointProjected } = req.body;
    console.log('Credit card history update:', { cardName, year, month, actual, joint, projected, jointProjected });

    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find existing entry or create new one
    const existingIndex = user.creditCardHistory.findIndex(
      (h: any) => h.cardName === cardName && h.year === year && h.month === month
    );

    console.log('Existing index:', existingIndex);

    if (existingIndex >= 0) {
      // Get existing values and update with new ones
      const existingDoc = user.creditCardHistory[existingIndex] as any;
      const existing = existingDoc.toObject ? existingDoc.toObject() : existingDoc;
      console.log('Existing entry:', existing);

      // Update the fields directly on the subdocument
      user.creditCardHistory[existingIndex].actual = typeof actual === 'number' ? actual : (existing.actual ?? 0);
      user.creditCardHistory[existingIndex].joint = typeof joint === 'number' ? joint : (existing.joint ?? 0);
      if (typeof projected === 'number') (user.creditCardHistory[existingIndex] as any).projected = projected;
      if (typeof jointProjected === 'number') (user.creditCardHistory[existingIndex] as any).jointProjected = jointProjected;

      console.log('Updated entry:', user.creditCardHistory[existingIndex]);
      user.markModified('creditCardHistory');
    } else {
      const newEntry: any = {
        cardName,
        year,
        month,
        actual: actual ?? 0,
        joint: joint ?? 0,
      };
      if (typeof projected === 'number') newEntry.projected = projected;
      if (typeof jointProjected === 'number') newEntry.jointProjected = jointProjected;
      console.log('New entry:', newEntry);
      user.creditCardHistory.push(newEntry);
    }

    await user.save();
    const result = user.creditCardHistory.filter(
      (h: any) => h.year === year && h.month === month
    );
    console.log('Returning:', result);
    res.json(result);
  } catch (error) {
    console.error('Error updating credit card history:', error);
    res.status(500).json({ error: 'Failed to update credit card history' });
  }
});

// ==================== Partner Routes ====================

// Generate partner invite code
app.post('/api/partner/generate-invite', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate 6-character alphanumeric code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    user.partnerInviteCode = code;
    user.partnerInviteCodeExpiry = expiry;
    await user.save();

    res.json({ code, expiry });
  } catch (error) {
    console.error('Generate invite error:', error);
    res.status(500).json({ error: 'Failed to generate invite code' });
  }
});

// Link with partner using invite code
app.post('/api/partner/link', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Invite code is required' });
    }

    const currentUser = await User.findById(req.user!.userId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (currentUser.partnerId) {
      return res.status(400).json({ error: 'Already linked with a partner' });
    }

    // Find user with matching invite code
    const partner = await User.findOne({
      partnerInviteCode: code.toUpperCase(),
      partnerInviteCodeExpiry: { $gt: new Date() },
    });

    if (!partner) {
      return res.status(400).json({ error: 'Invalid or expired invite code' });
    }

    if (partner._id.toString() === currentUser._id!.toString()) {
      return res.status(400).json({ error: 'Cannot link with yourself' });
    }

    if (partner.partnerId) {
      return res.status(400).json({ error: 'Partner is already linked with someone else' });
    }

    // Link both users
    currentUser.partnerId = partner._id as unknown as mongoose.Types.ObjectId;
    partner.partnerId = currentUser._id as unknown as mongoose.Types.ObjectId;

    // Clear invite code
    partner.partnerInviteCode = undefined;
    partner.partnerInviteCodeExpiry = undefined;

    // Sync joint data between partners
    // 1. Expenses: each user keeps their own — joint expenses are shared dynamically via /api/auth/me

    // 2. Merge joint recurring deposits (avoid duplicates by name + account)
    const currentUserJointDeposits = currentUser.recurringDeposits.filter((d: any) => d.account === 'joint');
    const partnerJointDeposits = partner.recurringDeposits.filter((d: any) => d.account === 'joint');
    const mergedJointDeposits: any[] = [...currentUserJointDeposits];
    for (const deposit of partnerJointDeposits) {
      if (!mergedJointDeposits.find((d: any) => d.name === deposit.name)) {
        mergedJointDeposits.push(deposit);
      }
    }
    // Update both users' deposits
    const currentUserPersonalDeposits = currentUser.recurringDeposits.filter((d: any) => d.account === 'personal');
    const partnerPersonalDeposits = partner.recurringDeposits.filter((d: any) => d.account === 'personal');
    currentUser.recurringDeposits = [...currentUserPersonalDeposits, ...mergedJointDeposits];
    partner.recurringDeposits = [...partnerPersonalDeposits, ...mergedJointDeposits];

    // 3. Credit cards: each user keeps their own cards (no merging)
    // Partner's cards are fetched dynamically via /api/partner

    // 4. Sync joint starting balance (use the higher of the two, or sum if both have values)
    const mergedJointBalance = Math.max(currentUser.jointStartingBalance || 0, partner.jointStartingBalance || 0);
    currentUser.jointStartingBalance = mergedJointBalance;
    partner.jointStartingBalance = mergedJointBalance;

    await currentUser.save();
    await partner.save();

    console.log('Partners linked and joint data synced:', {
      currentUser: currentUser.email,
      partner: partner.email,
      jointDeposits: mergedJointDeposits.length,
    });

    res.json({
      partnerId: partner._id,
      partnerName: partner.name,
      partnerEmail: partner.email,
    });
  } catch (error) {
    console.error('Link partner error:', error);
    res.status(500).json({ error: 'Failed to link with partner' });
  }
});

// Get partner info and their cards
app.get('/api/partner', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.partnerId) {
      return res.json({ partner: null });
    }

    const partner = await User.findById(user.partnerId).select('-password');
    if (!partner) {
      return res.json({ partner: null });
    }

    res.json({
      partner: {
        id: partner._id,
        name: partner.name,
        email: partner.email,
        creditCards: partner.creditCards || [],
        personalCreditCards: partner.personalCreditCards || [],
      },
    });
  } catch (error) {
    console.error('Get partner error:', error);
    res.status(500).json({ error: 'Failed to get partner info' });
  }
});

// Unlink from partner
app.delete('/api/partner', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.partnerId) {
      return res.status(400).json({ error: 'Not linked with any partner' });
    }

    // Unlink both users
    const partner = await User.findById(user.partnerId);
    if (partner) {
      partner.partnerId = undefined;
      await partner.save();
    }

    user.partnerId = undefined;
    await user.save();

    res.json({ message: 'Successfully unlinked from partner' });
  } catch (error) {
    console.error('Unlink partner error:', error);
    res.status(500).json({ error: 'Failed to unlink from partner' });
  }
});

// Update joint amounts on partner's card
app.put('/api/partner/cards/:cardName/joint', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { cardName } = req.params;
    const { jointProjected, jointActual } = req.body;

    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.partnerId) {
      return res.status(400).json({ error: 'Not linked with any partner' });
    }

    const partner = await User.findById(user.partnerId);
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    // Find the card in partner's credit card budgets
    let cardFound = false;

    // Check personalCreditCards first
    const personalCardIndex = partner.personalCreditCards.findIndex(
      (c: any) => c.name === cardName
    );

    if (personalCardIndex !== -1) {
      if (jointProjected !== undefined) {
        partner.personalCreditCards[personalCardIndex].jointProjected = jointProjected;
      }
      if (jointActual !== undefined) {
        partner.personalCreditCards[personalCardIndex].jointActual = jointActual;
      }
      if (req.body.projected !== undefined) {
        partner.personalCreditCards[personalCardIndex].projected = req.body.projected;
      }
      if (req.body.actual !== undefined) {
        partner.personalCreditCards[personalCardIndex].actual = req.body.actual;
      }
      cardFound = true;
    }

    // Also check creditCards
    if (!cardFound) {
      const cardIndex = partner.creditCards.findIndex(
        (c: any) => c.name === cardName
      );

      if (cardIndex !== -1) {
        if (jointProjected !== undefined) {
          partner.creditCards[cardIndex].jointProjected = jointProjected;
        }
        if (jointActual !== undefined) {
          partner.creditCards[cardIndex].jointActual = jointActual;
        }
        cardFound = true;
      }
    }

    if (!cardFound) {
      return res.status(404).json({ error: 'Card not found' });
    }

    await partner.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Update partner card joint error:', error);
    res.status(500).json({ error: 'Failed to update partner card' });
  }
});

// Get partner's credit card history for a specific month
app.get('/api/partner/credit-card-history/:year/:month', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { year, month } = req.params;
    const user = await User.findById(req.user!.userId);
    if (!user || !user.partnerId) {
      return res.json([]);
    }
    const partner = await User.findById(user.partnerId);
    if (!partner) {
      return res.json([]);
    }
    const history = partner.creditCardHistory.filter(
      (h: any) => h.year === parseInt(year) && h.month === parseInt(month)
    );
    res.json(history);
  } catch (error) {
    console.error('Get partner history error:', error);
    res.status(500).json({ error: 'Failed to fetch partner history' });
  }
});

// Sync joint data with partner (for existing partners who need to sync)
app.post('/api/partner/sync', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.partnerId) {
      return res.status(400).json({ error: 'Not linked with any partner' });
    }

    const partner = await User.findById(user.partnerId);
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    // Sync joint data - merge from both and give to both
    // 1. Expenses: each user keeps their own — joint expenses are shared dynamically via /api/auth/me

    // 2. Merge joint recurring deposits
    const userJointDeposits = user.recurringDeposits.filter((d: any) => d.account === 'joint');
    const partnerJointDeposits = partner.recurringDeposits.filter((d: any) => d.account === 'joint');
    const mergedJointDeposits: any[] = [...userJointDeposits];
    for (const deposit of partnerJointDeposits) {
      if (!mergedJointDeposits.find((d: any) => d.name === deposit.name)) {
        mergedJointDeposits.push(deposit);
      }
    }
    const userPersonalDeposits = user.recurringDeposits.filter((d: any) => d.account === 'personal');
    const partnerPersonalDeposits = partner.recurringDeposits.filter((d: any) => d.account === 'personal');
    user.recurringDeposits = [...userPersonalDeposits, ...mergedJointDeposits];
    partner.recurringDeposits = [...partnerPersonalDeposits, ...mergedJointDeposits];

    // 3. Credit cards: each user keeps their own cards (no merging)
    // Partner's cards are fetched dynamically via /api/partner

    // 4. Sync joint starting balance (use the higher of the two)
    const mergedJointBalance = Math.max(user.jointStartingBalance || 0, partner.jointStartingBalance || 0);
    user.jointStartingBalance = mergedJointBalance;
    partner.jointStartingBalance = mergedJointBalance;

    user.markModified('recurringDeposits');
    partner.markModified('recurringDeposits');

    await user.save();
    await partner.save();

    console.log('Partners synced:', {
      user: user.email,
      partner: partner.email,
      jointDeposits: mergedJointDeposits.length,
      jointBalance: mergedJointBalance,
    });

    res.json({
      message: 'Successfully synced joint data with partner',
      synced: {
        jointDeposits: mergedJointDeposits.length,
        jointBalance: mergedJointBalance,
      },
    });
  } catch (error) {
    console.error('Sync partner error:', error);
    res.status(500).json({ error: 'Failed to sync with partner' });
  }
});

// ==================== Onboarding Routes ====================

// Get onboarding status
app.get('/api/onboarding/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ completed: user.onboardingCompleted || false });
  } catch (error) {
    console.error('Get onboarding status error:', error);
    res.status(500).json({ error: 'Failed to get onboarding status' });
  }
});

// Complete onboarding and save all data
app.post('/api/onboarding/complete', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      personalStartingBalance,
      jointStartingBalance,
      creditCards,
      personalCreditCards,
      creditCardHistory,
    } = req.body;

    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update all onboarding data
    if (typeof personalStartingBalance === 'number') {
      user.personalStartingBalance = personalStartingBalance;
    }
    if (typeof jointStartingBalance === 'number') {
      user.jointStartingBalance = jointStartingBalance;
    }
    if (Array.isArray(creditCards)) {
      user.creditCards = creditCards;
    }
    if (Array.isArray(personalCreditCards)) {
      user.personalCreditCards = personalCreditCards;
    }
    if (Array.isArray(creditCardHistory)) {
      // Merge with existing history
      for (const entry of creditCardHistory) {
        const existingIndex = user.creditCardHistory.findIndex(
          (h: any) => h.cardName === entry.cardName && h.year === entry.year && h.month === entry.month
        );
        if (existingIndex >= 0) {
          user.creditCardHistory[existingIndex] = entry;
        } else {
          user.creditCardHistory.push(entry);
        }
      }
      user.markModified('creditCardHistory');
    }

    user.onboardingCompleted = true;
    await user.save();

    res.json({
      id: user._id,
      email: user.email,
      name: user.name,
      monthlyExpenses: user.monthlyExpenses,
      recurringDeposits: user.recurringDeposits || [],
      creditCards: user.creditCards || [],
      personalCreditCards: user.personalCreditCards || [],
      personalStartingBalance: user.personalStartingBalance || 0,
      jointStartingBalance: user.jointStartingBalance || 0,
      onboardingCompleted: user.onboardingCompleted,
      partnerId: user.partnerId,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Complete onboarding error:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

// ==================== Budget Entry Routes ====================

// Get all budget entries with optional filters (requires auth)
// Also includes partner's joint entries so they appear on both calendars
app.get('/api/entries', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, type, category } = req.query;

    const user = await User.findById(req.user!.userId);
    const userIds = [req.user!.userId];
    if (user?.partnerId) {
      userIds.push(user.partnerId.toString());
    }

    // Build shared date/type filters
    const dateTypeFilters: any = {};
    if (startDate || endDate) {
      dateTypeFilters.date = {};
      if (startDate) dateTypeFilters.date.$gte = new Date(startDate as string);
      if (endDate) dateTypeFilters.date.$lte = new Date(endDate as string);
    }
    if (type) dateTypeFilters.type = type;

    // Build user's own query (includes category filter if specified)
    const userQuery: any = { userId: req.user!.userId, ...dateTypeFilters };
    if (category) userQuery.category = category;

    // Build partner's joint query (only joint categories, intersected with category filter if specified)
    const jointCategories = ['joint-checking', 'joint-deduction'];
    const partnerQuery: any = userIds.length > 1
      ? {
          userId: userIds[1],
          category: category
            ? (jointCategories.includes(category as string) ? category : '__none__')
            : { $in: jointCategories },
          ...dateTypeFilters,
        }
      : null;

    // Query: user's own entries + partner's joint entries
    const query: any = {
      $or: [
        userQuery,
        ...(partnerQuery ? [partnerQuery] : []),
      ],
    };

    const entries = await BudgetEntry.find(query).sort({ date: -1 });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

// Get single budget entry (requires auth)
// Allows fetching own entries + partner's joint entries
app.get('/api/entries/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const entry = await BudgetEntry.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    const isOwn = entry.userId.toString() === req.user!.userId;
    if (!isOwn) {
      const user = await User.findById(req.user!.userId);
      const isPartnerJoint = user?.partnerId &&
        entry.userId.toString() === user.partnerId.toString() &&
        (entry.category === 'joint-checking' || entry.category === 'joint-deduction');
      if (!isPartnerJoint) {
        return res.status(404).json({ error: 'Entry not found' });
      }
    }

    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

// Create budget entry (requires auth)
app.post('/api/entries', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const entry = new BudgetEntry({
      ...req.body,
      userId: req.user!.userId,
    });
    await entry.save();
    res.status(201).json(entry);
  } catch (error) {
    console.error('Create entry error:', error);
    res.status(400).json({ error: 'Failed to create entry' });
  }
});

// Update budget entry (requires auth)
// Allows updating own entries + partner's joint entries
app.put('/api/entries/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId);
    const allowedUserIds = [req.user!.userId];
    if (user?.partnerId) {
      allowedUserIds.push(user.partnerId.toString());
    }

    // First find the entry to check permissions
    const existing = await BudgetEntry.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    const isOwn = existing.userId.toString() === req.user!.userId;
    const isPartnerJoint = !isOwn &&
      allowedUserIds.includes(existing.userId.toString()) &&
      (existing.category === 'joint-checking' || existing.category === 'joint-deduction');

    if (!isOwn && !isPartnerJoint) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    const entry = await BudgetEntry.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    res.json(entry);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update entry' });
  }
});

// Delete budget entry (requires auth)
// Allows deleting own entries + partner's joint entries
app.delete('/api/entries/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId);
    const allowedUserIds = [req.user!.userId];
    if (user?.partnerId) {
      allowedUserIds.push(user.partnerId.toString());
    }

    const existing = await BudgetEntry.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    const isOwn = existing.userId.toString() === req.user!.userId;
    const isPartnerJoint = !isOwn &&
      allowedUserIds.includes(existing.userId.toString()) &&
      (existing.category === 'joint-checking' || existing.category === 'joint-deduction');

    if (!isOwn && !isPartnerJoint) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    await BudgetEntry.findByIdAndDelete(req.params.id);
    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

// ==================== Category Routes ====================

// Get all categories
app.get('/api/categories', async (req: Request, res: Response) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create category
app.post('/api/categories', async (req: Request, res: Response) => {
  try {
    const category = new Category(req.body);
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create category' });
  }
});

// Update category
app.put('/api/categories/:id', async (req: Request, res: Response) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update category' });
  }
});

// Delete category
app.delete('/api/categories/:id', async (req: Request, res: Response) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export default app;
