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
    return NextResponse.json(user.monthlyExpenses);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = getAuthPayload(req);
  if (!auth) return unauthorized('Invalid token');

  try {
    await dbConnect();
    const { expenses } = await req.json();
    const user = await User.findById(auth.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const stamped = expenses.map((e: any) => ({
      ...e,
      addedBy: e.addedBy || auth.userId,
    }));

    user.monthlyExpenses = stamped;
    await user.save();

    return NextResponse.json(user.monthlyExpenses);
  } catch {
    return NextResponse.json({ error: 'Failed to update expenses' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = getAuthPayload(req);
  if (!auth) return unauthorized('Invalid token');

  try {
    await dbConnect();
    const { name, amount, account = 'joint' } = await req.json();
    const user = await User.findById(auth.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    user.monthlyExpenses.push({ name, amount, account, addedBy: auth.userId });
    await user.save();
    return NextResponse.json(user.monthlyExpenses, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to add expense' }, { status: 500 });
  }
}
