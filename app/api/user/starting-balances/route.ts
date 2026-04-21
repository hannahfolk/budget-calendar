import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthPayload, unauthorized } from '@/lib/auth-helpers';

export async function PUT(req: NextRequest) {
  const auth = getAuthPayload(req);
  if (!auth) return unauthorized('Invalid token');

  try {
    await dbConnect();
    const { personalStartingBalance, jointStartingBalance } = await req.json();

    const user = await User.findById(auth.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (typeof personalStartingBalance === 'number') {
      user.personalStartingBalance = personalStartingBalance;
    }
    if (typeof jointStartingBalance === 'number') {
      user.jointStartingBalance = jointStartingBalance;

      if (user.partnerId) {
        const partner = await User.findById(user.partnerId);
        if (partner) {
          partner.jointStartingBalance = jointStartingBalance;
          await partner.save();
        }
      }
    }

    await user.save();

    return NextResponse.json({
      personalStartingBalance: user.personalStartingBalance,
      jointStartingBalance: user.jointStartingBalance,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to update starting balances' }, { status: 500 });
  }
}
