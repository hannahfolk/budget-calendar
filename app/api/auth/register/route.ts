import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { signToken } from '@/lib/auth-helpers';

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const { email, password, name } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400 });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    const user = new User({ email, password, name });
    await user.save();

    const token = signToken({ userId: user._id!.toString(), email: user.email });

    return NextResponse.json(
      {
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
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Failed to register' }, { status: 500 });
  }
}
