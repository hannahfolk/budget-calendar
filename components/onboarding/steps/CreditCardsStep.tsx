'use client';

import { useEffect } from 'react';
import { CreditCard } from '@/lib/api';

interface CreditCardsStepProps {
  cards: CreditCard[];
  onUpdateCards: (cards: CreditCard[]) => void;
  onValidationChange?: (hasErrors: boolean) => void;
}

// Helper to check if a card has validation errors
const hasCardError = (card: CreditCard): boolean => {
  return (card.jointProjected || 0) > (card.projected || 0);
};

export default function CreditCardsStep({
  cards,
  onUpdateCards,
  onValidationChange,
}: CreditCardsStepProps) {
  // Notify parent when validation state changes
  useEffect(() => {
    const hasErrors = cards.some(hasCardError);
    onValidationChange?.(hasErrors);
  }, [cards, onValidationChange]);

  const addCard = () => {
    const newCard: CreditCard = {
      name: '',
      projected: 0,
      actual: 0,
      jointProjected: 0,
      jointActual: 0,
      closingDay: 1,
      account: 'personal', // Default to personal (your card)
    };
    onUpdateCards([...cards, newCard]);
  };

  const updateCard = (index: number, updates: Partial<CreditCard>) => {
    const updated = [...cards];
    updated[index] = { ...updated[index], ...updates };
    onUpdateCards(updated);
  };

  const removeCard = (index: number) => {
    onUpdateCards(cards.filter((_, i) => i !== index));
  };

  return (
    <div>
      <h2 className="text-2xl font-display font-bold mb-2">Your Credit Cards</h2>
      <p className="text-gray-400 font-mono text-sm mb-6">
        Add your own credit cards with joint and overall monthly budgets.
      </p>

      <div className="space-y-4">
        {cards.map((card, index) => (
          <div key={index} className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
            <div className="flex items-start gap-4">
              <div className="flex-1 space-y-4">
                {/* Card name */}
                <div>
                  <label className="block text-xs font-mono text-gray-400 mb-1">Card Name</label>
                  <input
                    type="text"
                    value={card.name}
                    onChange={(e) => updateCard(index, { name: e.target.value })}
                    className="w-full bg-gray-800/50 border border-gray-700 rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                    placeholder="e.g., Chase Sapphire Preferred"
                  />
                </div>

                {/* Closing day */}
                <div className="w-48">
                  <label className="block text-xs font-mono text-gray-400 mb-1">Closing Day</label>
                  <select
                    value={card.closingDay}
                    onChange={(e) => updateCard(index, { closingDay: parseInt(e.target.value) })}
                    className="w-full bg-gray-800/50 border border-gray-700 rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value={0}>Last day of month</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>

                {/* Joint Budget Bar */}
                <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-cyan-400">Joint Budget</span>
                    <span className="text-xs font-mono text-gray-500">Shared expenses on this card</span>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-mono text-gray-500 mb-1">Projected</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-sm">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={card.jointProjected || ''}
                          onChange={(e) => updateCard(index, { jointProjected: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-gray-800/50 border border-gray-700 rounded pl-6 pr-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Overall Budget Bar */}
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-blue-400">Overall Budget</span>
                    <span className="text-xs font-mono text-gray-500">Total card spending</span>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-mono text-gray-500 mb-1">Projected</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-sm">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={card.projected || ''}
                          onChange={(e) => updateCard(index, { projected: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-gray-800/50 border border-gray-700 rounded pl-6 pr-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                  {(card.projected || 0) > 0 && (card.jointProjected || 0) > 0 && (
                    <p className="mt-2 text-xs text-gray-500 font-mono">
                      Personal portion: ${Math.max(0, (card.projected || 0) - (card.jointProjected || 0)).toFixed(2)}
                    </p>
                  )}
                </div>

                {/* Validation Error */}
                {hasCardError(card) && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-red-400 font-mono text-sm">
                      Joint budget (${(card.jointProjected || 0).toFixed(2)}) cannot exceed overall budget (${(card.projected || 0).toFixed(2)})
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={() => removeCard(index)}
                className="text-gray-500 hover:text-red-400 transition-colors p-1"
                title="Remove card"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={addCard}
          className="w-full p-4 border-2 border-dashed border-gray-700 rounded-lg text-gray-400 hover:border-blue-500 hover:text-blue-400 transition-colors font-mono text-sm"
        >
          + Add Credit Card
        </button>
      </div>

      <div className="mt-6 p-4 bg-gray-800/30 border border-gray-700 rounded-lg">
        <p className="text-gray-400 font-mono text-sm">
          <strong className="text-cyan-400">Joint Budget:</strong> Expected shared expenses (groceries, utilities, etc.)<br />
          <strong className="text-blue-400">Overall Budget:</strong> Total expected spending on the card
        </p>
      </div>
    </div>
  );
}
