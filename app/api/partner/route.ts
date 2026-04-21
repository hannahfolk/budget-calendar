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

    if (!user.partnerId) {
      return NextResponse.json({ partner: null });
    }

    const partner = await User.findById(user.partnerId).select('-password');
    if (!partner) {
      return NextResponse.json({ partner: null });
    }

    return NextResponse.json({
      partner: {
        id: partner._id,
        name: partner.name,
        email: partner.email,
        creditCards: partner.creditCards || [],
        personalCreditCards: partner.personalCreditCards || [],
      },
    });
  } catch (error) {
    console.error('Get partner error:', error);
    return NextResponse.json({ error: 'Failed to get partner info' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = getAuthPayload(req);
  if (!auth) return unauthorized('Invalid token');

  try {
    await dbConnect();
    const user = await User.findById(auth.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (!user.partnerId) {
      return NextResponse.json({ error: 'Not linked with any partner' }, { status: 400 });
    }

    const partner = await User.findById(user.partnerId);
    if (partner) {
      partner.partnerId = undefined;
      await partner.save();
    }

    user.partnerId = undefined;
    await user.save();

    return NextResponse.json({ message: 'Successfully unlinked from partner' });
  } catch (error) {
    console.error('Unlink partner error:', error);
    return NextResponse.json({ error: 'Failed to unlink from partner' }, { status: 500 });
  }
}
