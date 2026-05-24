'use client';

import { useState, useEffect, useRef } from 'react';
import { format, subMonths } from 'date-fns';
import { BudgetEntry, RecurringDeposit, CreditCard, MonthlyExpense } from '@/lib/api';
import { getDepositAmountForDate } from '@/lib/deposits';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  account: 'personal' | 'joint';
  focusField: 'deposit' | 'withdrawal';
  entries: BudgetEntry[];
  recurringDeposits: RecurringDeposit[];
  onAddEntry: (field: string, value: string) => Promise<void>;
  onDeleteEntry: (entryId: string) => void;
  onSkipRecurringDeposit: (deposit: RecurringDeposit) => void;
  onEditRecurringDeposit: (deposit: RecurringDeposit, newAmount: number) => void;
  getLinkedAmount: (entry: BudgetEntry) => number;
  isProjectedEntry: (entry: BudgetEntry) => boolean;
  formatCurrency: (amount: number) => string;
  creditCards: CreditCard[];
  monthlyExpenses: MonthlyExpense[];
}

export default function DayEditModal({
  isOpen,
  onClose,
  date,
  account,
  focusField,
  entries,
  recurringDeposits,
  onAddEntry,
  onDeleteEntry,
  onSkipRecurringDeposit,
  onEditRecurringDeposit,
  getLinkedAmount,
  isProjectedEntry,
  formatCurrency,
  creditCards,
  monthlyExpenses,
}: Props) {
  const [depositValue, setDepositValue] = useState('');
  const [withdrawalValue, setWithdrawalValue] = useState('');
  const [editingDepositIdx, setEditingDepositIdx] = useState<number | null>(null);
  const [editingDepositAmount, setEditingDepositAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingButton, setSubmittingButton] = useState<string | null>(null);
  const depositInputRef = useRef<HTMLInputElement>(null);
  const withdrawalInputRef = useRef<HTMLInputElement>(null);

  const depositField = account === 'personal' ? 'personal-checking' : 'joint-checking';
  const deductionField = account === 'personal' ? 'personal-deduction' : 'joint-deduction';

  const depositEntries = entries.filter(e => e.category === depositField);
  const withdrawalEntries = entries.filter(e => e.category === deductionField);

  // Build the string that saveEntry/lookupExpenseByNameAsync expects for a credit card
  const prevMonth = subMonths(date, 1);
  const prevMonthName = format(prevMonth, 'MMMM');

  const buildCardString = (card: CreditCard, isJoint: boolean) => {
    return isJoint
      ? `${card.name} ${prevMonthName} joint`
      : `${card.name} ${prevMonthName}`;
  };

  // Filter expenses relevant to this account
  const relevantExpenses = monthlyExpenses.filter(e => e.account === account);

  // Collect all linkedTo values from existing entries on this day/account to hide already-added buttons
  const allEntries = [...depositEntries, ...withdrawalEntries];
  const usedLinkedTos = new Set(
    allEntries.map(e => e.linkedTo).filter(Boolean)
  );
  // Check if a card has already been added (by linkedTo prefix match, e.g. "creditCard:Chase" or "creditCardJoint:Chase")
  const isCardUsed = (cardName: string, isJoint: boolean) => {
    const prefix = isJoint ? `creditCardJoint:${cardName}` : `creditCard:${cardName}`;
    return Array.from(usedLinkedTos).some(l => l!.startsWith(prefix));
  };
  const isExpenseUsed = (expenseName: string) => {
    return usedLinkedTos.has(`expense:${expenseName}`);
  };

  // Credit card button logic:
  // - Joint modal withdrawals: joint portion buttons (paying joint portion from joint account)
  // - Joint modal deposits: personal portion buttons (personal account paying into joint)
  // - Personal modal withdrawals: personal portion buttons (paying personal portion from personal account)
  // - Personal modal deposits: joint portion buttons (joint account paying into personal)
  const withdrawalCardButtons = creditCards
    .filter(card => !isCardUsed(card.name, account === 'joint'))
    .map(card => ({
      card,
      isJoint: account === 'joint',
      label: `${card.name} (${account === 'joint' ? 'joint' : 'personal'})`,
    }));
  const depositCardButtons = creditCards
    .filter(card => !isCardUsed(card.name, account !== 'joint'))
    .map(card => ({
      card,
      isJoint: account !== 'joint',
      label: `${card.name} (${account !== 'joint' ? 'joint' : 'personal'})`,
    }));
  const filteredDepositExpenses = relevantExpenses.filter(e => !isExpenseUsed(e.name));
  const filteredWithdrawalExpenses = relevantExpenses.filter(e => !isExpenseUsed(e.name));

  useEffect(() => {
    if (isOpen) {
      if (focusField === 'withdrawal' && withdrawalInputRef.current) {
        withdrawalInputRef.current.focus();
      } else if (depositInputRef.current) {
        depositInputRef.current.focus();
      }
    }
  }, [isOpen, focusField]);

  const handleAddDeposit = async () => {
    if (!depositValue.trim() || isSubmitting) return;
    setIsSubmitting(true);
    await onAddEntry(depositField, depositValue);
    setDepositValue('');
    setIsSubmitting(false);
  };

  const handleAddWithdrawal = async () => {
    if (!withdrawalValue.trim() || isSubmitting) return;
    setIsSubmitting(true);
    await onAddEntry(deductionField, withdrawalValue);
    setWithdrawalValue('');
    setIsSubmitting(false);
  };

  const handleQuickAdd = async (field: string, value: string, buttonKey: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmittingButton(buttonKey);
    await onAddEntry(field, value);
    setIsSubmitting(false);
    setSubmittingButton(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleEditRecurringDeposit = (idx: number, deposit: RecurringDeposit) => {
    setEditingDepositIdx(idx);
    setEditingDepositAmount(getDepositAmountForDate(deposit, date).toString());
  };

  const handleSaveRecurringDeposit = (deposit: RecurringDeposit) => {
    const amount = parseFloat(editingDepositAmount);
    if (!isNaN(amount) && amount >= 0) {
      onEditRecurringDeposit(deposit, amount);
    }
    setEditingDepositIdx(null);
    setEditingDepositAmount('');
  };

  if (!isOpen) return null;

  const isPersonal = account === 'personal';
  const hasDepositQuickActions = depositCardButtons.length > 0 || filteredDepositExpenses.length > 0;
  const hasWithdrawalQuickActions = withdrawalCardButtons.length > 0 || filteredWithdrawalExpenses.length > 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
            <div>
              <h2 className="text-lg font-bold text-white">
                {format(date, 'EEEE, MMMM d')}
              </h2>
              <span className={`text-sm ${account === 'personal' ? 'text-purple-400' : 'text-cyan-400'}`}>
                {account === 'personal' ? 'Personal Account' : 'Joint Account'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-700 transition-colors"
            >
              &times;
            </button>
          </div>

          {/* Clear All */}
          {(depositEntries.length > 0 || withdrawalEntries.length > 0) && (
            <div className="px-4 pt-3 pb-0 shrink-0">
              <button
                onClick={async () => {
                  if (isSubmitting) return;
                  setIsSubmitting(true);
                  for (const entry of [...depositEntries, ...withdrawalEntries]) {
                    if (entry._id) onDeleteEntry(entry._id);
                  }
                  setIsSubmitting(false);
                }}
                disabled={isSubmitting}
                className="w-full px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                Clear all transactions
              </button>
            </div>
          )}

          {/* Content */}
          <div className="p-4 space-y-6 overflow-y-auto">
            {/* Deposits Section */}
            <div>
              <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isPersonal ? 'text-green-400' : 'text-blue-400'}`}>
                <span className="text-lg">+</span> Deposits
              </h3>

              {/* Recurring Deposits */}
              {recurringDeposits.map((dep, idx) => (
                <div
                  key={`rec-${idx}`}
                  className={`flex items-center justify-between py-2 px-3 mb-1 rounded-lg ${isPersonal ? 'bg-green-500/10 border border-green-500/20' : 'bg-blue-500/10 border border-blue-500/20'}`}
                >
                  {editingDepositIdx === idx ? (
                    <input
                      type="number"
                      step="0.01"
                      value={editingDepositAmount}
                      onChange={(e) => setEditingDepositAmount(e.target.value)}
                      onBlur={() => handleSaveRecurringDeposit(dep)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveRecurringDeposit(dep)}
                      className={`w-24 bg-transparent outline-none border-b ${isPersonal ? 'text-green-400 border-green-400' : 'text-blue-400 border-blue-400'}`}
                      autoFocus
                    />
                  ) : (
                    <span
                      className={`cursor-pointer hover:underline ${isPersonal ? 'text-green-400' : 'text-blue-400'}`}
                      onClick={() => handleEditRecurringDeposit(idx, dep)}
                    >
                      +{formatCurrency(getDepositAmountForDate(dep, date))}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{dep.name} (recurring)</span>
                    <button
                      onClick={() => onSkipRecurringDeposit(dep)}
                      className="text-red-400 hover:text-red-300 text-sm px-2 py-0.5 rounded hover:bg-red-500/20 transition-colors"
                      title="Skip this week"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ))}

              {/* Manual Deposit Entries */}
              {depositEntries.map((entry) => {
                const projected = isProjectedEntry(entry);
                return (
                <div
                  key={entry._id}
                  className={`flex items-center justify-between py-2 px-3 mb-1 rounded-lg ${
                    projected
                      ? (isPersonal ? 'bg-green-500/5 border border-dashed border-green-400/50' : 'bg-blue-500/5 border border-dashed border-blue-400/50')
                      : (isPersonal ? 'bg-green-500/10 border border-green-500/20' : 'bg-blue-500/10 border border-blue-500/20')
                  }`}
                >
                  <span className={`flex items-center gap-1.5 ${isPersonal ? 'text-green-400' : 'text-blue-400'}`}>
                    +{formatCurrency(getLinkedAmount(entry))}
                    {projected && (
                      <span className="text-[10px] uppercase tracking-wide text-gray-400 border border-dashed border-gray-500/60 rounded px-1 leading-tight">
                        projected
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {entry.description && entry.description !== '+' && (
                      <span className="text-xs text-gray-500">{entry.description}</span>
                    )}
                    <button
                      onClick={() => entry._id && onDeleteEntry(entry._id)}
                      className="text-red-400 hover:text-red-300 text-sm px-2 py-0.5 rounded hover:bg-red-500/20 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                );
              })}

              {/* Quick Add Deposit Buttons */}
              {hasDepositQuickActions && (
                <div className="mt-2 mb-1">
                  <span className="text-xs text-gray-500 mb-1.5 block">Quick add</span>
                  <div className="flex flex-wrap gap-1.5">
                    {depositCardButtons.map(({ card, isJoint, label }) => (
                      <button
                        key={`dep-card-${card.name}`}
                        onClick={() => handleQuickAdd(depositField, buildCardString(card, isJoint), `dep-card-${card.name}`)}
                        disabled={isSubmitting}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${
                          submittingButton === `dep-card-${card.name}`
                            ? 'bg-gray-600 text-gray-300'
                            : isPersonal
                              ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/20'
                              : 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/20'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                    {filteredDepositExpenses.map((expense) => (
                      <button
                        key={`dep-exp-${expense.name}`}
                        onClick={() => handleQuickAdd(depositField, expense.name, `dep-exp-${expense.name}`)}
                        disabled={isSubmitting}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${
                          submittingButton === `dep-exp-${expense.name}`
                            ? 'bg-gray-600 text-gray-300'
                            : isPersonal
                              ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/20'
                              : 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/20'
                        }`}
                      >
                        {expense.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Deposit Input */}
              <div className="flex gap-2 mt-2">
                <input
                  ref={depositInputRef}
                  type="text"
                  value={depositValue}
                  onChange={(e) => setDepositValue(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, handleAddDeposit)}
                  placeholder="Amount or expense name..."
                  className={`flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none ${isPersonal ? 'focus:border-green-500 focus:ring-1 focus:ring-green-500' : 'focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}`}
                />
                <button
                  onClick={handleAddDeposit}
                  disabled={isSubmitting || !depositValue.trim()}
                  className={`px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium ${isPersonal ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'}`}
                >
                  Add
                </button>
              </div>
            </div>

            {/* Withdrawals Section */}
            <div>
              <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isPersonal ? 'text-red-400' : 'text-orange-400'}`}>
                <span className="text-lg">-</span> Withdrawals
              </h3>

              {/* Withdrawal Entries */}
              {withdrawalEntries.map((entry) => {
                const projected = isProjectedEntry(entry);
                return (
                <div
                  key={entry._id}
                  className={`flex items-center justify-between py-2 px-3 mb-1 rounded-lg ${
                    projected
                      ? (isPersonal ? 'bg-red-500/5 border border-dashed border-red-400/50' : 'bg-orange-500/5 border border-dashed border-orange-400/50')
                      : (isPersonal ? 'bg-red-500/10 border border-red-500/20' : 'bg-orange-500/10 border border-orange-500/20')
                  }`}
                >
                  <span className={`flex items-center gap-1.5 ${isPersonal ? 'text-red-400' : 'text-orange-400'}`}>
                    -{formatCurrency(getLinkedAmount(entry))}
                    {projected && (
                      <span className="text-[10px] uppercase tracking-wide text-gray-400 border border-dashed border-gray-500/60 rounded px-1 leading-tight">
                        projected
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {entry.description && entry.description !== '-' && entry.description !== '−' && (
                      <span className="text-xs text-gray-500">{entry.description}</span>
                    )}
                    <button
                      onClick={() => entry._id && onDeleteEntry(entry._id)}
                      className="text-red-400 hover:text-red-300 text-sm px-2 py-0.5 rounded hover:bg-red-500/20 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                );
              })}

              {/* Quick Add Withdrawal Buttons */}
              {hasWithdrawalQuickActions && (
                <div className="mt-2 mb-1">
                  <span className="text-xs text-gray-500 mb-1.5 block">Quick add</span>
                  <div className="flex flex-wrap gap-1.5">
                    {withdrawalCardButtons.map(({ card, isJoint, label }) => (
                      <button
                        key={`wd-card-${card.name}`}
                        onClick={() => handleQuickAdd(deductionField, buildCardString(card, isJoint), `wd-card-${card.name}`)}
                        disabled={isSubmitting}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${
                          submittingButton === `wd-card-${card.name}`
                            ? 'bg-gray-600 text-gray-300'
                            : isPersonal
                              ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20'
                              : 'bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 border border-orange-500/20'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                    {filteredWithdrawalExpenses.map((expense) => (
                      <button
                        key={`wd-exp-${expense.name}`}
                        onClick={() => handleQuickAdd(deductionField, expense.name, `wd-exp-${expense.name}`)}
                        disabled={isSubmitting}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${
                          submittingButton === `wd-exp-${expense.name}`
                            ? 'bg-gray-600 text-gray-300'
                            : isPersonal
                              ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20'
                              : 'bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 border border-orange-500/20'
                        }`}
                      >
                        {expense.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Withdrawal Input */}
              <div className="flex gap-2 mt-2">
                <input
                  ref={withdrawalInputRef}
                  type="text"
                  value={withdrawalValue}
                  onChange={(e) => setWithdrawalValue(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, handleAddWithdrawal)}
                  placeholder="Amount or expense name..."
                  className={`flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none ${isPersonal ? 'focus:border-red-500 focus:ring-1 focus:ring-red-500' : 'focus:border-orange-500 focus:ring-1 focus:ring-orange-500'}`}
                />
                <button
                  onClick={handleAddWithdrawal}
                  disabled={isSubmitting || !withdrawalValue.trim()}
                  className={`px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium ${isPersonal ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'}`}
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-700 shrink-0">
            <p className="text-xs text-gray-500 text-center">
              Use quick add buttons or type amounts and expense names manually
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
