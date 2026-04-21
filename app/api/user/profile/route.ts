import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthPayload, signToken, unauthorized } from '@/lib/auth-helpers';

export async function PUT(req: NextRequest) {
  const auth = getAuthPayload(req);
  if (!auth) return unauthorized('Invalid token');

  try {
    await dbConnect();
    const { name, email } = await req.json();

    const user = await User.findById(auth.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
      }
      user.email = email.toLowerCase();
    }

    if (name) {
      user.name = name;
    }

    await user.save();

    const token = signToken({ userId: user._id!.toString(), email: user.email });

    return NextResponse.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
