import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthPayload, unauthorized } from '@/lib/auth-helpers';

export async function PUT(
  req: NextRequest,
  { params }: { params: { cardName: string } }
) {
  const auth = getAuthPayload(req);
  if (!auth) return unauthorized('Invalid token');

  try {
    await dbConnect();
    const cardName = decodeURIComponent(params.cardName);
    const body = await req.json();
    const { jointProjected, jointActual } = body;

    const user = await User.findById(auth.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (!user.partnerId) {
      return NextResponse.json({ error: 'Not linked with any partner' }, { status: 400 });
    }

    const partner = await User.findById(user.partnerId);
    if (!partner) return NextResponse.json({ error: 'Partner not found' }, { status: 404 });

    let cardFound = false;

    const personalCardIndex = partner.personalCreditCards.findIndex(
      (c: any) => c.name === cardName
    );

    if (personalCardIndex !== -1) {
      if (jointProjected !== undefined) {
        partner.personalCreditCards[personalCardIndex].jointProjected = jointProjected;
      }
      if (jointActual !== undefined) {
        partner.personalCreditCards[personalCardIndex].jointActual = jointActual;
      }
      if (body.projected !== undefined) {
        partner.personalCreditCards[personalCardIndex].projected = body.projected;
      }
      if (body.actual !== undefined) {
        partner.personalCreditCards[personalCardIndex].actual = body.actual;
      }
      cardFound = true;
    }

    if (!cardFound) {
      const cardIndex = partner.creditCards.findIndex((c: any) => c.name === cardName);

      if (cardIndex !== -1) {
        if (jointProjected !== undefined) {
          partner.creditCards[cardIndex].jointProjected = jointProjected;
        }
        if (jointActual !== undefined) {
          partner.creditCards[cardIndex].jointActual = jointActual;
        }
        cardFound = true;
      }
    }

    if (!cardFound) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    await partner.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update partner card joint error:', error);
    return NextResponse.json({ error: 'Failed to update partner card' }, { status: 500 });
  }
}
