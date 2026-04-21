import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthPayload, unauthorized } from '@/lib/auth-helpers';

export async function GET(
  req: NextRequest,
  { params }: { params: { year: string; month: string } }
) {
  const auth = getAuthPayload(req);
  if (!auth) return unauthorized('Invalid token');

  try {
    await dbConnect();
    const user = await User.findById(auth.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const year = parseInt(params.year);
    const month = parseInt(params.month);
    const history = user.creditCardHistory.filter(
      (h: any) => h.year === year && h.month === month
    );
    return NextResponse.json(history);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch credit card history' }, { status: 500 });
  }
}
