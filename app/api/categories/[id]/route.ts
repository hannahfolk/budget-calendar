import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Category from '@/models/Category';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await dbConnect();
    const body = await req.json();
    const category = await Category.findByIdAndUpdate(params.id, body, {
      new: true,
      runValidators: true,
    });
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    return NextResponse.json(category);
  } catch {
    return NextResponse.json({ error: 'Failed to update category' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await dbConnect();
    const category = await Category.findByIdAndDelete(params.id);
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch {
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
