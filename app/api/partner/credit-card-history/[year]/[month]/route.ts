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
    if (!user || !user.partnerId) {
      return NextResponse.json([]);
    }
    const partner = await User.findById(user.partnerId);
    if (!partner) {
      return NextResponse.json([]);
    }
    const year = parseInt(params.year);
    const month = parseInt(params.month);
    const history = partner.creditCardHistory.filter(
      (h: any) => h.year === year && h.month === month
    );
    return NextResponse.json(history);
  } catch (error) {
    console.error('Get partner history error:', error);
    return NextResponse.json({ error: 'Failed to fetch partner history' }, { status: 500 });
  }
}
