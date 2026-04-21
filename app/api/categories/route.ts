import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Category from '@/models/Category';

export async function GET() {
  try {
    await dbConnect();
    const categories = await Category.find().sort({ name: 1 });
    return NextResponse.json(categories);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const category = new Category(body);
    await category.save();
    return NextResponse.json(category, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create category' }, { status: 400 });
  }
}
