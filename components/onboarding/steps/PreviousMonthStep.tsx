'use client';

import { useEffect } from 'react';
import { CreditCard, CreditCardMonthlyHistory } from '@/lib/api';
import { subMonths } from 'date-fns';

interface PreviousMonthStepProps {
  cards: CreditCard[];
  creditCardHistory: CreditCardMonthlyHistory[];
  onUpdateHistory: (history: CreditCardMonthlyHistory[]) => void;
}

export default function PreviousMonthStep({
  cards,
  creditCardHistory,
  onUpdateHistory,
}: PreviousMonthStepProps) {
  const prevMonth = subMonths(new Date(), 1);
  const year = prevMonth.getFullYear();
  const month = prevMonth.getMonth();
  const monthName = prevMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Initialize history entries for all cards
  useEffect(() => {
    const existingHistory = [...creditCardHistory];
    let updated = false;

    cards.forEach(card => {
      if (!card.name) return;
      const existing = existingHistory.find(
        h => h.cardName === card.name && h.year === year && h.month === month
      );
      if (!existing) {
        existingHistory.push({
          cardName: card.name,
          year,
          month,
          actual: 0,
          joint: 0,
        });
        updated = true;
      }
    });

    if (updated) {
      onUpdateHistory(existingHistory);
    }
  }, [cards.length]);

  const getHistoryEntry = (cardName: string) => {
    return creditCardHistory.find(
      h => h.cardName === cardName && h.year === year && h.month === month
    );
  };

  const updateHistoryEntry = (cardName: string, field: 'actual' | 'joint', value: number) => {
    const updated = [...creditCardHistory];
    const index = updated.findIndex(
      h => h.cardName === cardName && h.year === year && h.month === month
    );

    if (index >= 0) {
      updated[index] = { ...updated[index], [field]: value };
    } else {
      updated.push({
        cardName,
        year,
        month,
        actual: field === 'actual' ? value : 0,
        joint: field === 'joint' ? value : 0,
      });
    }

    onUpdateHistory(updated);
  };

  const namedCards = cards.filter(c => c.name);

  if (namedCards.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-display font-bold mb-2">Previous Month Amounts</h2>
        <p className="text-gray-400 font-mono text-sm mb-8">
          No credit cards have been added yet.
        </p>
        <div className="p-8 text-center bg-gray-800/30 rounded-lg border border-gray-700">
          <p className="text-gray-400 font-mono">
            Go back and add credit cards first, then you can enter their previous month amounts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-display font-bold mb-2">Previous Month Amounts</h2>
      <p className="text-gray-400 font-mono text-sm mb-6">
        Enter actual amounts spent on each card in <span className="text-blue-400">{monthName}</span>
      </p>

      <div className="space-y-4">
        {namedCards.map((card, index) => {
          const history = getHistoryEntry(card.name);
          const jointActual = history?.joint || 0;
          const overallActual = history?.actual || 0;
          const personalPortion = Math.max(0, overallActual - jointActual);

          return (
            <div key={index} className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
              {/* Card header */}
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-white text-lg">{card.name}</span>
                <span className="text-xs font-mono text-gray-500">
                  Closes: {card.closingDay === 0 ? 'Last day' : card.closingDay}
                </span>
              </div>

              {/* Joint Actual */}
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-cyan-400">Joint Spending</span>
                  <span className="text-xs font-mono text-gray-500">Shared expenses</span>
                </div>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={history?.joint || ''}
                    onChange={(e) => updateHistoryEntry(card.name, 'joint', parseFloat(e.target.value) || 0)}
                    className="w-full bg-gray-800/50 border border-gray-700 rounded pl-6 pr-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Overall Actual */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-blue-400">Overall Spending</span>
                  <span className="text-xs font-mono text-gray-500">Total on card</span>
                </div>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={history?.actual || ''}
                    onChange={(e) => updateHistoryEntry(card.name, 'actual', parseFloat(e.target.value) || 0)}
                    className="w-full bg-gray-800/50 border border-gray-700 rounded pl-6 pr-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
                {overallActual > 0 && jointActual > 0 && (
                  <p className="mt-2 text-xs text-gray-500 font-mono">
                    Personal portion: ${personalPortion.toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-gray-800/30 border border-gray-700 rounded-lg">
        <p className="text-gray-400 font-mono text-sm">
          <strong className="text-cyan-400">Joint Actual:</strong> How much was spent on shared expenses<br />
          <strong className="text-blue-400">Overall Actual:</strong> Total amount spent on the card
        </p>
      </div>
    </div>
  );
}
