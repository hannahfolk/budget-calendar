import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthPayload, unauthorized } from '@/lib/auth-helpers';
import { buildUserResponse } from '@/lib/user-response';

export async function GET(req: NextRequest) {
  const auth = getAuthPayload(req);
  if (!auth) return unauthorized('Invalid token');

  try {
    await dbConnect();
    const user = await User.findById(auth.userId).select('-password');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const payload = await buildUserResponse(user);
    return NextResponse.json(payload);
  } catch (error) {
    console.error('Get me error:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}
