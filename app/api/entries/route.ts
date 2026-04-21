import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import BudgetEntry from '@/models/BudgetEntry';
import { getAuthPayload, unauthorized } from '@/lib/auth-helpers';

export async function GET(req: NextRequest) {
  const auth = getAuthPayload(req);
  if (!auth) return unauthorized('Invalid token');

  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const type = searchParams.get('type');
    const category = searchParams.get('category');

    const user = await User.findById(auth.userId);
    const userIds = [auth.userId];
    if (user?.partnerId) {
      userIds.push(user.partnerId.toString());
    }

    const dateTypeFilters: any = {};
    if (startDate || endDate) {
      dateTypeFilters.date = {};
      if (startDate) dateTypeFilters.date.$gte = new Date(startDate);
      if (endDate) dateTypeFilters.date.$lte = new Date(endDate);
    }
    if (type) dateTypeFilters.type = type;

    const userQuery: any = { userId: auth.userId, ...dateTypeFilters };
    if (category) userQuery.category = category;

    const jointCategories = ['joint-checking', 'joint-deduction'];
    const partnerQuery: any =
      userIds.length > 1
        ? {
            userId: userIds[1],
            category: category
              ? jointCategories.includes(category)
                ? category
                : '__none__'
              : { $in: jointCategories },
            ...dateTypeFilters,
          }
        : null;

    const query: any = {
      $or: [userQuery, ...(partnerQuery ? [partnerQuery] : [])],
    };

    const entries = await BudgetEntry.find(query).sort({ date: -1 });
    return NextResponse.json(entries);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = getAuthPayload(req);
  if (!auth) return unauthorized('Invalid token');

  try {
    await dbConnect();
    const body = await req.json();
    const entry = new BudgetEntry({
      ...body,
      userId: auth.userId,
    });
    await entry.save();
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('Create entry error:', error);
    return NextResponse.json({ error: 'Failed to create entry' }, { status: 400 });
  }
}
