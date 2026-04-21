'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [existingEmails, setExistingEmails] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setExistingEmails([]);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.existingEmails) {
          setExistingEmails(data.existingEmails);
        }
        throw new Error(data.error || 'Failed to process request');
      }

      setSuccess(true);
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
            Forgot Password
          </h1>
          <p className="text-gray-400 font-mono text-sm text-center mb-6">
            Enter your email to reset your password
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
            >
              <p className="text-red-400 font-mono text-sm">{error}</p>
              {existingEmails.length > 0 && (
                <div className="mt-3 pt-3 border-t border-red-500/20">
                  <p className="text-gray-400 font-mono text-xs mb-2">Registered accounts:</p>
                  <ul className="space-y-1">
                    {existingEmails.map((e, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => setEmail(e)}
                          className="text-blue-400 hover:text-blue-300 font-mono text-sm transition-colors"
                        >
                          {e}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}

          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-green-400 font-mono text-sm mb-2">
                  Check your email for a password reset link.
                </p>
                <p className="text-gray-400 font-mono text-xs">
                  If you have an account with that email, you will receive a reset code shortly. The code expires in 1 hour.
                </p>
              </div>

              <Link
                href="/login"
                className="block text-center text-gray-400 hover:text-blue-400 font-mono text-sm transition-colors"
              >
                Back to Login
              </Link>
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

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-mono py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  'Send Reset Link'
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
