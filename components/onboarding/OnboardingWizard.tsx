'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/components/AuthProvider';
import { onboardingAPI, CreditCard, CreditCardMonthlyHistory } from '@/lib/api';
import OnboardingProgress from './OnboardingProgress';
import BalancesStep from './steps/BalancesStep';
import CreditCardsStep from './steps/CreditCardsStep';
import PreviousMonthStep from './steps/PreviousMonthStep';
import PartnerStep from './steps/PartnerStep';
import PartnerCardsStep from './steps/PartnerCardsStep';
import ReviewStep from './steps/ReviewStep';

export interface OnboardingData {
  personalStartingBalance: number;
  jointStartingBalance: number;
  creditCards: CreditCard[]; // User's own credit cards
  creditCardHistory: CreditCardMonthlyHistory[];
  hasPartner: boolean;
  partnerLinked: boolean;
  partnerName?: string;
}

const STEPS = [
  { id: 'balances', title: 'Account Balances' },
  { id: 'cards', title: 'Credit Cards' },
  { id: 'previous', title: 'Previous Month' },
  { id: 'partner', title: 'Partner Connection' },
  { id: 'partner-cards', title: 'Partner Cards' },
  { id: 'review', title: 'Review & Complete' },
];

export default function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardValidationError, setCardValidationError] = useState(false);
  const { user, setUser, refreshUser } = useAuth();
  const router = useRouter();

  // Combine existing cards from user profile
  const existingCards = [
    ...(user?.creditCards || []),
    ...(user?.personalCreditCards || []),
  ];

  const [data, setData] = useState<OnboardingData>({
    personalStartingBalance: user?.personalStartingBalance || 0,
    jointStartingBalance: user?.jointStartingBalance || 0,
    creditCards: existingCards,
    creditCardHistory: [],
    hasPartner: false,
    partnerLinked: !!user?.partnerId,
    partnerName: user?.partnerName,
  });

  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const getVisibleSteps = () => {
    // Partner cards step is only visible if partner is linked
    if (!data.partnerLinked) {
      return STEPS.filter(s => s.id !== 'partner-cards');
    }
    return STEPS;
  };

  const visibleSteps = getVisibleSteps();
  const currentStepData = visibleSteps[currentStep];

  const handleNext = () => {
    if (currentStep < visibleSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    setError(null);

    try {
      // Store all cards in creditCards (the user's cards)
      const updatedUser = await onboardingAPI.complete({
        personalStartingBalance: data.personalStartingBalance,
        jointStartingBalance: data.jointStartingBalance,
        creditCards: data.creditCards,
        personalCreditCards: [], // We're using a single array now
        creditCardHistory: data.creditCardHistory,
      });

      // Update user in context
      setUser(updatedUser);

      // Navigate to main app
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Failed to complete onboarding');
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    switch (currentStepData?.id) {
      case 'balances':
        return (
          <BalancesStep
            personalBalance={data.personalStartingBalance}
            jointBalance={data.jointStartingBalance}
            onUpdate={(personal, joint) => updateData({
              personalStartingBalance: personal,
              jointStartingBalance: joint,
            })}
          />
        );
      case 'cards':
        return (
          <CreditCardsStep
            cards={data.creditCards}
            onUpdateCards={(cards) => updateData({ creditCards: cards })}
            onValidationChange={setCardValidationError}
          />
        );
      case 'previous':
        return (
          <PreviousMonthStep
            cards={data.creditCards}
            creditCardHistory={data.creditCardHistory}
            onUpdateHistory={(history) => updateData({ creditCardHistory: history })}
          />
        );
      case 'partner':
        return (
          <PartnerStep
            partnerLinked={data.partnerLinked}
            partnerName={data.partnerName}
            onPartnerLinked={(linked, name) => {
              updateData({ partnerLinked: linked, partnerName: name });
              if (linked) {
                refreshUser();
              }
            }}
          />
        );
      case 'partner-cards':
        return (
          <PartnerCardsStep partnerName={data.partnerName} />
        );
      case 'review':
        return (
          <ReviewStep data={data} />
        );
      default:
        return null;
    }
  };

  return (
    <div className="glass-panel rounded-xl p-8">
      <OnboardingProgress
        steps={visibleSteps}
        currentStep={currentStep}
      />

      <div className="min-h-[400px] py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStepData?.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 font-mono text-sm">{error}</p>
        </div>
      )}

      <div className="flex justify-between pt-4 border-t border-gray-700">
        <button
          onClick={handleBack}
          disabled={currentStep === 0}
          className={`px-6 py-2 rounded-lg font-mono transition-colors ${
            currentStep === 0
              ? 'text-gray-500 cursor-not-allowed'
              : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          Back
        </button>

        {currentStep === visibleSteps.length - 1 ? (
          <button
            onClick={handleComplete}
            disabled={saving}
            className="px-8 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded-lg font-mono transition-colors"
          >
            {saving ? 'Saving...' : 'Complete Setup'}
          </button>
        ) : (
          <button
            onClick={handleNext}
            disabled={currentStepData?.id === 'cards' && cardValidationError}
            className={`px-8 py-2 rounded-lg font-mono transition-colors ${
              currentStepData?.id === 'cards' && cardValidationError
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {currentStepData?.id === 'partner' && !data.partnerLinked ? 'Skip' : 'Next'}
          </button>
        )}
      </div>
    </div>
  );
}
