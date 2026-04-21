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
    const user = await User.findById(auth.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const stamped = cards.map((card: any) => ({
      ...card,
      addedBy: card.addedBy || auth.userId,
    }));

    user.creditCards = stamped;
    await user.save();

    return NextResponse.json(user.creditCards);
  } catch {
    return NextResponse.json({ error: 'Failed to update credit cards' }, { status: 500 });
  }
}
