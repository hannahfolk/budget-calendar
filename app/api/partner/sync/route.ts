import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthPayload, unauthorized } from '@/lib/auth-helpers';

export async function POST(req: NextRequest) {
  const auth = getAuthPayload(req);
  if (!auth) return unauthorized('Invalid token');

  try {
    await dbConnect();
    const user = await User.findById(auth.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (!user.partnerId) {
      return NextResponse.json({ error: 'Not linked with any partner' }, { status: 400 });
    }

    const partner = await User.findById(user.partnerId);
    if (!partner) return NextResponse.json({ error: 'Partner not found' }, { status: 404 });

    const userJointDeposits = user.recurringDeposits.filter((d: any) => d.account === 'joint');
    const partnerJointDeposits = partner.recurringDeposits.filter(
      (d: any) => d.account === 'joint'
    );
    const mergedJointDeposits: any[] = [...userJointDeposits];
    for (const deposit of partnerJointDeposits) {
      if (!mergedJointDeposits.find((d: any) => d.name === deposit.name)) {
        mergedJointDeposits.push(deposit);
      }
    }
    const userPersonalDeposits = user.recurringDeposits.filter(
      (d: any) => d.account === 'personal'
    );
    const partnerPersonalDeposits = partner.recurringDeposits.filter(
      (d: any) => d.account === 'personal'
    );
    user.recurringDeposits = [...userPersonalDeposits, ...mergedJointDeposits];
    partner.recurringDeposits = [...partnerPersonalDeposits, ...mergedJointDeposits];

    const mergedJointBalance = Math.max(
      user.jointStartingBalance || 0,
      partner.jointStartingBalance || 0
    );
    user.jointStartingBalance = mergedJointBalance;
    partner.jointStartingBalance = mergedJointBalance;

    user.markModified('recurringDeposits');
    partner.markModified('recurringDeposits');

    await user.save();
    await partner.save();

    return NextResponse.json({
      message: 'Successfully synced joint data with partner',
      synced: {
        jointDeposits: mergedJointDeposits.length,
        jointBalance: mergedJointBalance,
      },
    });
  } catch (error) {
    console.error('Sync partner error:', error);
    return NextResponse.json({ error: 'Failed to sync with partner' }, { status: 500 });
  }
}
