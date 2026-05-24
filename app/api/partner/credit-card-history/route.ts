import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthPayload, unauthorized } from '@/lib/auth-helpers';

// Update the JOINT portion of a partner's credit-card history for a given month.
// The user may only touch the shared joint fields (joint, jointProjected) of the
// partner's joint cards — never the partner's personal/overall actual or projected.
export async function PUT(req: NextRequest) {
  const auth = getAuthPayload(req);
  if (!auth) return unauthorized('Invalid token');

  try {
    await dbConnect();
    const { cardName, year, month, joint, jointProjected } = await req.json();

    const user = await User.findById(auth.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!user.partnerId) {
      return NextResponse.json({ error: 'Not linked with any partner' }, { status: 400 });
    }

    const partner = await User.findById(user.partnerId);
    if (!partner) return NextResponse.json({ error: 'Partner not found' }, { status: 404 });

    // Only allow editing the partner's joint (shared) cards.
    const isJointCard = (partner.creditCards || []).some((c: any) => c.name === cardName);
    if (!isJointCard) {
      return NextResponse.json({ error: 'Card is not a shared joint card' }, { status: 403 });
    }

    const existingIndex = partner.creditCardHistory.findIndex(
      (h: any) => h.cardName === cardName && h.year === year && h.month === month
    );

    if (existingIndex >= 0) {
      if (typeof joint === 'number') {
        partner.creditCardHistory[existingIndex].joint = joint;
      }
      if (typeof jointProjected === 'number') {
        (partner.creditCardHistory[existingIndex] as any).jointProjected = jointProjected;
      }
      partner.markModified('creditCardHistory');
    } else {
      const newEntry: any = {
        cardName,
        year,
        month,
        actual: 0,
        joint: typeof joint === 'number' ? joint : 0,
      };
      if (typeof jointProjected === 'number') newEntry.jointProjected = jointProjected;
      partner.creditCardHistory.push(newEntry);
    }

    await partner.save();
    const result = partner.creditCardHistory.filter(
      (h: any) => h.year === year && h.month === month
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating partner credit card history:', error);
    return NextResponse.json(
      { error: 'Failed to update partner credit card history' },
      { status: 500 }
    );
  }
}
