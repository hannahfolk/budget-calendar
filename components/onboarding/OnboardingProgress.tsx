'use client';

import { motion } from 'framer-motion';

interface Step {
  id: string;
  title: string;
}

interface OnboardingProgressProps {
  steps: Step[];
  currentStep: number;
}

export default function OnboardingProgress({ steps, currentStep }: OnboardingProgressProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <motion.div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-mono text-sm transition-colors ${
                  index < currentStep
                    ? 'bg-green-500 text-white'
                    : index === currentStep
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-400'
                }`}
                animate={{
                  scale: index === currentStep ? 1.1 : 1,
                }}
                transition={{ duration: 0.2 }}
              >
                {index < currentStep ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </motion.div>
              <span
                className={`mt-2 text-xs font-mono text-center max-w-[80px] ${
                  index <= currentStep ? 'text-gray-300' : 'text-gray-500'
                }`}
              >
                {step.title}
              </span>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 mb-6">
                <motion.div
                  className={`h-full ${
                    index < currentStep ? 'bg-green-500' : 'bg-gray-700'
                  }`}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.3 }}
                  style={{ transformOrigin: 'left' }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
