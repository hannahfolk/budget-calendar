import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import BudgetEntry from '@/models/BudgetEntry';
import { getAuthPayload, unauthorized } from '@/lib/auth-helpers';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthPayload(req);
  if (!auth) return unauthorized('Invalid token');

  try {
    await dbConnect();
    const entry = await BudgetEntry.findById(params.id);
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

    const isOwn = entry.userId.toString() === auth.userId;
    if (!isOwn) {
      const user = await User.findById(auth.userId);
      const isPartnerJoint =
        user?.partnerId &&
        entry.userId.toString() === user.partnerId.toString() &&
        (entry.category === 'joint-checking' || entry.category === 'joint-deduction');
      if (!isPartnerJoint) {
        return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
      }
    }

    return NextResponse.json(entry);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch entry' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthPayload(req);
  if (!auth) return unauthorized('Invalid token');

  try {
    await dbConnect();
    const user = await User.findById(auth.userId);
    const allowedUserIds = [auth.userId];
    if (user?.partnerId) {
      allowedUserIds.push(user.partnerId.toString());
    }

    const existing = await BudgetEntry.findById(params.id);
    if (!existing) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

    const isOwn = existing.userId.toString() === auth.userId;
    const isPartnerJoint =
      !isOwn &&
      allowedUserIds.includes(existing.userId.toString()) &&
      (existing.category === 'joint-checking' || existing.category === 'joint-deduction');

    if (!isOwn && !isPartnerJoint) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    const body = await req.json();
    const entry = await BudgetEntry.findByIdAndUpdate(params.id, body, {
      new: true,
      runValidators: true,
    });
    return NextResponse.json(entry);
  } catch {
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthPayload(req);
  if (!auth) return unauthorized('Invalid token');

  try {
    await dbConnect();
    const user = await User.findById(auth.userId);
    const allowedUserIds = [auth.userId];
    if (user?.partnerId) {
      allowedUserIds.push(user.partnerId.toString());
    }

    const existing = await BudgetEntry.findById(params.id);
    if (!existing) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

    const isOwn = existing.userId.toString() === auth.userId;
    const isPartnerJoint =
      !isOwn &&
      allowedUserIds.includes(existing.userId.toString()) &&
      (existing.category === 'joint-checking' || existing.category === 'joint-deduction');

    if (!isOwn && !isPartnerJoint) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    await BudgetEntry.findByIdAndDelete(params.id);
    return NextResponse.json({ message: 'Entry deleted successfully' });
  } catch {
    return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 });
  }
}
