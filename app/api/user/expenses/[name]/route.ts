import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthPayload, unauthorized } from '@/lib/auth-helpers';

export async function DELETE(req: NextRequest, { params }: { params: { name: string } }) {
  const auth = getAuthPayload(req);
  if (!auth) return unauthorized('Invalid token');

  try {
    await dbConnect();
    const user = await User.findById(auth.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const name = decodeURIComponent(params.name);
    user.monthlyExpenses = user.monthlyExpenses.filter((e) => e.name !== name);
    await user.save();
    return NextResponse.json(user.monthlyExpenses);
  } catch {
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
