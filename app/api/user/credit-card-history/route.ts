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
