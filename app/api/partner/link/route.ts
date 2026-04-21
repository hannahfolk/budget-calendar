import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthPayload, unauthorized } from '@/lib/auth-helpers';

export async function POST(req: NextRequest) {
  const auth = getAuthPayload(req);
  if (!auth) return unauthorized('Invalid token');

  try {
    await dbConnect();
    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
    }

    const currentUser = await User.findById(auth.userId);
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (currentUser.partnerId) {
      return NextResponse.json({ error: 'Already linked with a partner' }, { status: 400 });
    }

    const partner = await User.findOne({
      partnerInviteCode: code.toUpperCase(),
      partnerInviteCodeExpiry: { $gt: new Date() },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Invalid or expired invite code' }, { status: 400 });
    }

    if (partner._id!.toString() === currentUser._id!.toString()) {
      return NextResponse.json({ error: 'Cannot link with yourself' }, { status: 400 });
    }

    if (partner.partnerId) {
      return NextResponse.json(
        { error: 'Partner is already linked with someone else' },
        { status: 400 }
      );
    }

    currentUser.partnerId = partner._id as unknown as mongoose.Types.ObjectId;
    partner.partnerId = currentUser._id as unknown as mongoose.Types.ObjectId;

    partner.partnerInviteCode = undefined;
    partner.partnerInviteCodeExpiry = undefined;

    const currentUserJointDeposits = currentUser.recurringDeposits.filter(
      (d: any) => d.account === 'joint'
    );
    const partnerJointDeposits = partner.recurringDeposits.filter(
      (d: any) => d.account === 'joint'
    );
    const mergedJointDeposits: any[] = [...currentUserJointDeposits];
    for (const deposit of partnerJointDeposits) {
      if (!mergedJointDeposits.find((d: any) => d.name === deposit.name)) {
        mergedJointDeposits.push(deposit);
      }
    }
    const currentUserPersonalDeposits = currentUser.recurringDeposits.filter(
      (d: any) => d.account === 'personal'
    );
    const partnerPersonalDeposits = partner.recurringDeposits.filter(
      (d: any) => d.account === 'personal'
    );
    currentUser.recurringDeposits = [...currentUserPersonalDeposits, ...mergedJointDeposits];
    partner.recurringDeposits = [...partnerPersonalDeposits, ...mergedJointDeposits];

    const mergedJointBalance = Math.max(
      currentUser.jointStartingBalance || 0,
      partner.jointStartingBalance || 0
    );
    currentUser.jointStartingBalance = mergedJointBalance;
    partner.jointStartingBalance = mergedJointBalance;

    await currentUser.save();
    await partner.save();

    return NextResponse.json({
      partnerId: partner._id,
      partnerName: partner.name,
      partnerEmail: partner.email,
    });
  } catch (error) {
    console.error('Link partner error:', error);
    return NextResponse.json({ error: 'Failed to link with partner' }, { status: 500 });
  }
}
