import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthPayload, unauthorized } from '@/lib/auth-helpers';

export async function GET(req: NextRequest) {
  const auth = getAuthPayload(req);
  if (!auth) return unauthorized('Invalid token');

  try {
    await dbConnect();
    const user = await User.findById(auth.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const deposits = [...user.recurringDeposits];

    if (user.partnerId) {
      const partner = await User.findById(user.partnerId);
      if (partner) {
        const partnerJointDeposits = partner.recurringDeposits.filter(
          (d: any) => d.account === 'joint'
        );
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

    return NextResponse.json(deposits);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch recurring deposits' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = getAuthPayload(req);
  if (!auth) return unauthorized('Invalid token');

  try {
    await dbConnect();
    const { deposits } = await req.json();

    const user = await User.findById(auth.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const stamped = deposits.map((d: any) => ({
      ...d,
      addedBy: d.addedBy || auth.userId,
    }));

    user.recurringDeposits = stamped;
    user.markModified('recurringDeposits');
    await user.save();

    if (user.partnerId) {
      const partner = await User.findById(user.partnerId);
      if (partner) {
        const userJointDeposits = deposits.filter((d: any) => d.account === 'joint');
        const partnerPersonalDeposits = partner.recurringDeposits.filter(
          (d: any) => d.account === 'personal'
        );
        partner.recurringDeposits = [...partnerPersonalDeposits, ...userJointDeposits];
        partner.markModified('recurringDeposits');
        await partner.save();
      }
    }

    return NextResponse.json(user.recurringDeposits);
  } catch (error) {
    console.error('Error updating recurring deposits:', error);
    return NextResponse.json({ error: 'Failed to update recurring deposits' }, { status: 500 });
  }
}
