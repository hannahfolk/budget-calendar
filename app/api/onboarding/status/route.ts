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
    return NextResponse.json({ completed: user.onboardingCompleted || false });
  } catch (error) {
    console.error('Get onboarding status error:', error);
    return NextResponse.json({ error: 'Failed to get onboarding status' }, { status: 500 });
  }
}
