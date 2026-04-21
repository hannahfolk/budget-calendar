import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthPayload, unauthorized } from '@/lib/auth-helpers';

export async function PUT(req: NextRequest) {
  const auth = getAuthPayload(req);
  if (!auth) return unauthorized('Invalid token');

  try {
    await dbConnect();
    const { cards } = await req.json();
    const stamped = cards.map((card: any) => ({
      ...card,
      addedBy: card.addedBy || auth.userId,
    }));
    const user = await User.findByIdAndUpdate(
      auth.userId,
      { personalCreditCards: stamped },
      { new: true }
    );
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    return NextResponse.json(user.personalCreditCards);
  } catch {
    return NextResponse.json(
      { error: 'Failed to update personal credit card budgets' },
      { status: 500 }
    );
  }
}
