'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import { motion } from 'framer-motion';

export default function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.onboardingCompleted) {
        router.push('/');
      }
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 font-mono">Loading...</p>
        </div>
      </main>
    );
  }

  if (!user || user.onboardingCompleted) {
    return null;
  }

  return (
    <main className="min-h-screen p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-display font-bold mb-2 glow-text">
            Welcome, {user.name}!
          </h1>
          <p className="text-gray-400 font-mono text-sm">
            Let&apos;s set up your budget calendar
          </p>
        </div>

        <OnboardingWizard />
      </motion.div>
    </main>
  );
}
