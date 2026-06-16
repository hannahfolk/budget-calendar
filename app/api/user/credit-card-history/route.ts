import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthPayload, unauthorized } from '@/lib/auth-helpers';

export async function PUT(req: NextRequest) {
  const auth = getAuthPayload(req);
  if (!auth) return unauthorized('Invalid token');

  try {
    await dbConnect();
    const { cardName, year, month, actual, joint, projected, jointProjected } = await req.json();

    const user = await User.findById(auth.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Reject writes for cards the user doesn't own. Joint cards owned by the
    // partner must be edited through /api/partner/credit-card-history so the
    // canonical owner's record stays the single source of truth.
    const ownsCard =
      user.creditCards.some((c: any) => c.name === cardName) ||
      user.personalCreditCards.some((c: any) => c.name === cardName);
    if (!ownsCard) {
      return NextResponse.json(
        { error: 'Card is not owned by this user' },
        { status: 403 }
      );
    }

    const existingIndex = user.creditCardHistory.findIndex(
      (h: any) => h.cardName === cardName && h.year === year && h.month === month
    );

    if (existingIndex >= 0) {
      const existingDoc = user.creditCardHistory[existingIndex] as any;
      const existing = existingDoc.toObject ? existingDoc.toObject() : existingDoc;

      user.creditCardHistory[existingIndex].actual =
        typeof actual === 'number' ? actual : existing.actual ?? 0;
      user.creditCardHistory[existingIndex].joint =
        typeof joint === 'number' ? joint : existing.joint ?? 0;
      if (typeof projected === 'number')
        (user.creditCardHistory[existingIndex] as any).projected = projected;
      if (typeof jointProjected === 'number')
        (user.creditCardHistory[existingIndex] as any).jointProjected = jointProjected;

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
      user.creditCardHistory.push(newEntry);
    }

    // Keep the card object's joint fields in sync with the joint history values
    // so partner sessions (which read partner.creditCards via buildUserResponse)
    // see up-to-date joint amounts instead of stale onboarding defaults.
    if (typeof joint === 'number' || typeof jointProjected === 'number') {
      const jointIdx = user.creditCards.findIndex((c: any) => c.name === cardName);
      const personalIdx = user.personalCreditCards.findIndex((c: any) => c.name === cardName);
      if (jointIdx >= 0) {
        if (typeof joint === 'number') user.creditCards[jointIdx].jointActual = joint;
        if (typeof jointProjected === 'number') user.creditCards[jointIdx].jointProjected = jointProjected;
        user.markModified('creditCards');
      } else if (personalIdx >= 0) {
        if (typeof joint === 'number') user.personalCreditCards[personalIdx].jointActual = joint;
        if (typeof jointProjected === 'number') user.personalCreditCards[personalIdx].jointProjected = jointProjected;
        user.markModified('personalCreditCards');
      }
    }

    await user.save();
    const result = user.creditCardHistory.filter(
      (h: any) => h.year === year && h.month === month
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating credit card history:', error);
    return NextResponse.json(
      { error: 'Failed to update credit card history' },
      { status: 500 }
    );
  }
}
