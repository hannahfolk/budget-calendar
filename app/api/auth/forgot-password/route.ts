import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { createEmailTransporter } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const FRONTEND_URL =
      process.env.NEXT_PUBLIC_FRONTEND_URL ||
      process.env.URL ||
      `http://localhost:${process.env.NEXT_PUBLIC_FRONTEND_PORT || 4000}`;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return NextResponse.json({
        message: 'If an account exists with that email, a password reset link has been sent.',
      });
    }

    const resetToken = Math.random().toString(36).substring(2, 8).toUpperCase();
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);

    user.passwordResetToken = resetToken;
    user.passwordResetExpiry = resetExpiry;
    await user.save();

    const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    const transporter = createEmailTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: email,
          subject: 'Password Reset - Budget Calendar',
          html: `
            <h2>Password Reset Request</h2>
            <p>You requested a password reset for your Budget Calendar account.</p>
            <p>Your reset code is: <strong>${resetToken}</strong></p>
            <p>Or click the link below to reset your password:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <p>This code expires in 1 hour.</p>
            <p>If you did not request this, please ignore this email.</p>
          `,
        });
      } catch (emailError) {
        console.error('Failed to send reset email:', emailError);
        return NextResponse.json(
          { error: 'Failed to send reset email. Please check SMTP configuration.' },
          { status: 500 }
        );
      }
    } else {
      console.warn('No SMTP configured. Reset token logged to console only.');
      console.log(`Password reset token for ${email}: ${resetToken}`);
    }

    return NextResponse.json({
      message: 'If an account exists with that email, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
