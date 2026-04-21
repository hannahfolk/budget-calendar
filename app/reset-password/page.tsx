'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const emailParam = searchParams.get('email');
    const tokenParam = searchParams.get('token');

    if (emailParam) setEmail(emailParam);
    if (tokenParam) setToken(tokenParam);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setSuccess(true);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="glass-panel rounded-2xl p-8">
          <h1 className="text-3xl font-display font-bold mb-2 glow-text text-center">
            Reset Password
          </h1>
          <p className="text-gray-400 font-mono text-sm text-center mb-6">
            Enter your new password
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
            >
              <p className="text-red-400 font-mono text-sm">{error}</p>
            </motion.div>
          )}

          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg"
            >
              <p className="text-green-400 font-mono text-sm text-center">
                Password reset successfully! Redirecting to login...
              </p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-mono text-gray-400 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-mono text-gray-400 mb-2">
                  Reset Token
                </label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value.toUpperCase())}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:border-blue-500 transition-colors uppercase"
                  placeholder="XXXXXX"
                  maxLength={6}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-mono text-gray-400 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Min 6 characters"
                  minLength={6}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-mono text-gray-400 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Confirm new password"
                  minLength={6}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-mono py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Resetting...
                  </>
                ) : (
                  'Reset Password'
                )}
              </button>

              <Link
                href="/login"
                className="block text-center text-gray-400 hover:text-blue-400 font-mono text-sm transition-colors"
              >
                Back to Login
              </Link>
            </form>
          )}
        </div>
      </motion.div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 font-mono">Loading...</p>
        </div>
      </main>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
