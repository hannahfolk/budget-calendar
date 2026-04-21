import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthPayload, unauthorized } from '@/lib/auth-helpers';

export async function POST(req: NextRequest) {
  const auth = getAuthPayload(req);
  if (!auth) return unauthorized('Invalid token');

  try {
    await dbConnect();
    const user = await User.findById(auth.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    user.partnerInviteCode = code;
    user.partnerInviteCodeExpiry = expiry;
    await user.save();

    return NextResponse.json({ code, expiry });
  } catch (error) {
    console.error('Generate invite error:', error);
    return NextResponse.json({ error: 'Failed to generate invite code' }, { status: 500 });
  }
}
