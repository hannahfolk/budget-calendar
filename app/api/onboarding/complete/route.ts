import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthPayload, unauthorized } from '@/lib/auth-helpers';

export async function POST(req: NextRequest) {
  const auth = getAuthPayload(req);
  if (!auth) return unauthorized('Invalid token');

  try {
    await dbConnect();
    const {
      personalStartingBalance,
      jointStartingBalance,
      creditCards,
      personalCreditCards,
      creditCardHistory,
    } = await req.json();

    const user = await User.findById(auth.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

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
      for (const entry of creditCardHistory) {
        const existingIndex = user.creditCardHistory.findIndex(
          (h: any) =>
            h.cardName === entry.cardName && h.year === entry.year && h.month === entry.month
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

    return NextResponse.json({
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
    return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 });
  }
}
