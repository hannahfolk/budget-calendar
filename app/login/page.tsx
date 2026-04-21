'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await register(email, password, name);
        // Redirect to onboarding after registration
        router.push('/onboarding');
      } else {
        await login(email, password);
        // Login will redirect based on onboarding status from main page
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="glass-panel rounded-xl p-8">
          <h1 className="text-3xl font-display font-bold mb-2 glow-text text-center">
            Budget Calendar
          </h1>
          <p className="text-gray-400 font-mono text-sm text-center mb-8">
            {isRegister ? 'Create your account' : 'Sign in to continue'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-sm font-mono text-gray-400 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Your name"
                  required={isRegister}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-mono text-gray-400 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-mono text-gray-400 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="••••••••"
                required
                minLength={6}
              />
              {!isRegister && (
                <div className="mt-1 text-right">
                  <Link
                    href="/forgot-password"
                    className="text-gray-500 hover:text-blue-400 font-mono text-xs transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 font-mono text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-mono py-2 px-4 rounded-lg transition-colors"
            >
              {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              className="text-blue-400 hover:text-blue-300 font-mono text-sm transition-colors"
            >
              {isRegister
                ? 'Already have an account? Sign in'
                : "Don't have an account? Register"}
            </button>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
