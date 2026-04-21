import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import BudgetEntry from '@/models/BudgetEntry';
import { getAuthPayload, unauthorized } from '@/lib/auth-helpers';

export async function DELETE(req: NextRequest) {
  const auth = getAuthPayload(req);
  if (!auth) return unauthorized('Invalid token');

  try {
    await dbConnect();
    const { password } = await req.json();

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required to delete account' },
        { status: 400 }
      );
    }

    const user = await User.findById(auth.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return NextResponse.json({ error: 'Password is incorrect' }, { status: 401 });
    }

    if (user.partnerId) {
      const partner = await User.findById(user.partnerId);
      if (partner) {
        partner.partnerId = undefined;
        await partner.save();
      }
    }

    await BudgetEntry.deleteMany({ userId: user._id });
    await User.findByIdAndDelete(user._id);

    return NextResponse.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
