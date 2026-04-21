'use client';

import { OnboardingData } from '../OnboardingWizard';
import { subMonths } from 'date-fns';

interface ReviewStepProps {
  data: OnboardingData;
}

export default function ReviewStep({ data }: ReviewStepProps) {
  const prevMonth = subMonths(new Date(), 1);
  const monthName = prevMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div>
      <h2 className="text-2xl font-display font-bold mb-2">Review & Complete</h2>
      <p className="text-gray-400 font-mono text-sm mb-8">
        Review your setup before completing
      </p>

      <div className="space-y-6">
        {/* Account Balances */}
        <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
          <h3 className="font-mono text-gray-300 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-500/20 rounded flex items-center justify-center text-xs text-blue-400">1</span>
            Account Balances
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm font-mono">
            <div>
              <span className="text-gray-500">Personal:</span>
              <span className="ml-2 text-white">${data.personalStartingBalance.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-500">Joint:</span>
              <span className="ml-2 text-white">${data.jointStartingBalance.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Credit Cards */}
        <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
          <h3 className="font-mono text-gray-300 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-500/20 rounded flex items-center justify-center text-xs text-blue-400">2</span>
            Credit Card Budgets
          </h3>
          <div className="text-sm font-mono">
            <span className="text-gray-500">Cards:</span>
            <span className="ml-2 text-white">{data.creditCards.filter(c => c.name).length}</span>
            {data.creditCards.filter(c => c.name).length > 0 && (
              <ul className="mt-2 space-y-2 text-xs">
                {data.creditCards.filter(c => c.name).map((card, i) => (
                  <li key={i} className="text-gray-400">
                    <div className="flex items-center gap-2">
                      <span className="text-white">{card.name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        card.account === 'joint'
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        {card.account === 'joint' ? "Partner's" : 'Personal'}
                      </span>
                    </div>
                    <div className="ml-2 mt-1">
                      <span className="text-cyan-400">Joint: ${(card.jointProjected || 0).toFixed(2)}</span>
                      <span className="mx-2 text-gray-600">|</span>
                      <span className="text-blue-400">Overall: ${(card.projected || 0).toFixed(2)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Previous Month */}
        <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
          <h3 className="font-mono text-gray-300 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-500/20 rounded flex items-center justify-center text-xs text-blue-400">3</span>
            {monthName} Amounts
          </h3>
          {data.creditCardHistory.length > 0 ? (
            <div className="text-sm font-mono space-y-2">
              {data.creditCardHistory.map((h, i) => {
                const personalPortion = Math.max(0, h.actual - h.joint);
                return (
                  <div key={i} className="text-gray-400">
                    <span className="text-white">{h.cardName}</span>
                    <div className="ml-2 mt-1 text-xs">
                      <span>Joint: ${h.joint.toFixed(2)}</span>
                      <span className="mx-2">|</span>
                      <span>Overall: ${h.actual.toFixed(2)}</span>
                      <span className="mx-2">|</span>
                      <span className="text-gray-500">Personal: ${personalPortion.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm font-mono text-gray-500">No history entered</p>
          )}
        </div>

        {/* Partner */}
        <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
          <h3 className="font-mono text-gray-300 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-500/20 rounded flex items-center justify-center text-xs text-blue-400">4</span>
            Partner Connection
          </h3>
          <div className="text-sm font-mono">
            {data.partnerLinked ? (
              <span className="text-green-400">
                Linked with {data.partnerName}
              </span>
            ) : (
              <span className="text-gray-500">Not linked (can add later)</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
        <p className="text-green-300 font-mono text-sm text-center">
          Click "Complete Setup" to save your settings and start using your budget calendar
        </p>
      </div>
    </div>
  );
}
