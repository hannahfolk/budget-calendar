'use client';

import { useState, useMemo } from 'react';
import { expensesAPI, depositsAPI, MonthlyExpense, RecurringDeposit } from '@/lib/api';
import { formatFrequency } from '@/lib/deposits';
import { useAuth } from './AuthProvider';
import { startOfMonth, addDays, getDay, format } from 'date-fns';
import ProfileModal from './ProfileModal';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  expenses: MonthlyExpense[];
  partnerJointExpenses?: MonthlyExpense[];
  recurringDeposits: RecurringDeposit[];
  onExpensesUpdate: (expenses: MonthlyExpense[]) => void;
  onDepositsUpdate: (deposits: RecurringDeposit[]) => void;
  hasPartner?: boolean;
  partnerName?: string;
  onPartnerLinked?: () => void;
}

// Sortable wrapper component
function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export default function ExpensesSidebar({
  expenses,
  partnerJointExpenses = [],
  recurringDeposits,
  onExpensesUpdate,
  onDepositsUpdate,
  hasPartner,
  partnerName,
  onPartnerLinked,
}: Props) {
  const [editingExpense, setEditingExpense] = useState<number | null>(null);
  const [editingDeposit, setEditingDeposit] = useState<number | null>(null);
  const [editingDepositField, setEditingDepositField] = useState<{ index: number; field: 'account' | 'frequency' } | null>(null);
  const [editValue, setEditValue] = useState('');

  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false);

  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isAddingDeposit, setIsAddingDeposit] = useState(false);

  const [newExpenseName, setNewExpenseName] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseAccount, setNewExpenseAccount] = useState<'personal' | 'joint'>('personal');
  const [editingExpenseAccount, setEditingExpenseAccount] = useState<number | null>(null);

  const [newDepositName, setNewDepositName] = useState('');
  const [newDepositAmount, setNewDepositAmount] = useState('');
  const [newDepositAccount, setNewDepositAccount] = useState<'personal' | 'joint'>('personal');
  const [newDepositFrequency, setNewDepositFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('biweekly');

  // Calculate first Friday of current month
  const getFirstFridayOfMonth = () => {
    const monthStart = startOfMonth(new Date());
    const dayOfWeek = getDay(monthStart);
    // Friday is 5. Calculate days until first Friday
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    const firstFriday = addDays(monthStart, daysUntilFriday);
    return format(firstFriday, 'yyyy-MM-dd');
  };

  const defaultStartDate = useMemo(() => getFirstFridayOfMonth(), []);
  const [newDepositStartDate, setNewDepositStartDate] = useState(defaultStartDate);

  const { user, logout } = useAuth();

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before starting drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Drag end handlers
  const handleExpensesDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = expenses.findIndex((e) => `expense-${e.name}` === active.id);
      const newIndex = expenses.findIndex((e) => `expense-${e.name}` === over.id);
      const reordered = arrayMove(expenses, oldIndex, newIndex);
      try {
        await expensesAPI.updateExpenses(reordered);
        onExpensesUpdate(reordered);
      } catch (error) {
        console.error('Failed to reorder expenses:', error);
      }
    }
  };

  const handleDepositsDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = recurringDeposits.findIndex((_, i) => `deposit-${i}` === active.id);
      const newIndex = recurringDeposits.findIndex((_, i) => `deposit-${i}` === over.id);
      const reordered = arrayMove(recurringDeposits, oldIndex, newIndex);
      try {
        await depositsAPI.updateDeposits(reordered);
        onDepositsUpdate(reordered);
      } catch (error) {
        console.error('Failed to reorder deposits:', error);
      }
    }
  };

  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0) + partnerJointExpenses.reduce((sum, e) => sum + e.amount, 0);
  const depositTotal = recurringDeposits.reduce((sum, d) => sum + d.amount, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Expense handlers
  const handleExpenseEditStart = (index: number, amount: number) => {
    setEditingExpense(index);
    setEditValue(amount.toString());
  };

  const handleExpenseEditSave = async (index: number) => {
    const amount = parseFloat(editValue);
    if (isNaN(amount) || amount < 0) {
      setEditingExpense(null);
      return;
    }
    const updated = [...expenses];
    updated[index] = { ...updated[index], amount };
    try {
      await expensesAPI.updateExpenses(updated);
      onExpensesUpdate(updated);
    } catch (error) {
      console.error('Failed to update expense:', error);
    }
    setEditingExpense(null);
  };

  const handleExpenseDelete = async (name: string) => {
    try {
      const updated = await expensesAPI.deleteExpense(name);
      onExpensesUpdate(updated);
    } catch (error) {
      console.error('Failed to delete expense:', error);
    }
  };

  const handleExpenseAdd = async () => {
    if (!newExpenseName.trim() || !newExpenseAmount) return;
    const amount = parseFloat(newExpenseAmount);
    if (isNaN(amount) || amount < 0) return;
    try {
      const updated = await expensesAPI.addExpense(newExpenseName.trim(), amount, newExpenseAccount);
      onExpensesUpdate(updated);
      setNewExpenseName('');
      setNewExpenseAmount('');
      setNewExpenseAccount('personal');
      setIsAddingExpense(false);
    } catch (error) {
      console.error('Failed to add expense:', error);
    }
  };

  const handleExpenseAccountChange = async (index: number, newAccount: 'personal' | 'joint') => {
    const updated = [...expenses];
    updated[index] = { ...updated[index], account: newAccount };
    try {
      await expensesAPI.updateExpenses(updated);
      onExpensesUpdate(updated);
    } catch (error) {
      console.error('Failed to update expense account:', error);
    }
    setEditingExpenseAccount(null);
  };

  // Deposit handlers
  const handleDepositEditStart = (index: number, amount: number) => {
    setEditingDeposit(index);
    setEditValue(amount.toString());
  };

  const handleDepositEditSave = async (index: number) => {
    const newAmount = parseFloat(editValue);
    if (isNaN(newAmount) || newAmount < 0) {
      setEditingDeposit(null);
      return;
    }
    const updated = [...recurringDeposits];
    const deposit = updated[index];
    if (deposit.amount !== newAmount) {
      const today = format(new Date(), 'yyyy-MM-dd');
      const history = deposit.amountHistory ? [...deposit.amountHistory] : [];
      // If first edit, record the original amount with startDate
      if (history.length === 0) {
        history.push({ amount: deposit.amount, effectiveDate: deposit.startDate });
      }
      // Record the new amount with today's date
      history.push({ amount: newAmount, effectiveDate: today });
      updated[index] = { ...deposit, amount: newAmount, amountHistory: history };
    }
    try {
      await depositsAPI.updateDeposits(updated);
      onDepositsUpdate(updated);
    } catch (error) {
      console.error('Failed to update deposit:', error);
    }
    setEditingDeposit(null);
  };

  const handleDepositFieldChange = async (index: number, field: 'account' | 'frequency', value: string) => {
    const updated = [...recurringDeposits];
    if (field === 'account') {
      updated[index] = { ...updated[index], account: value as 'personal' | 'joint' };
    } else {
      updated[index] = { ...updated[index], frequency: value as 'weekly' | 'biweekly' | 'monthly' };
    }
    try {
      await depositsAPI.updateDeposits(updated);
      onDepositsUpdate(updated);
    } catch (error) {
      console.error('Failed to update deposit:', error);
    }
    setEditingDepositField(null);
  };

  const handleDepositDelete = async (index: number) => {
    const updated = recurringDeposits.filter((_, i) => i !== index);
    try {
      await depositsAPI.updateDeposits(updated);
      onDepositsUpdate(updated);
    } catch (error) {
      console.error('Failed to delete deposit:', error);
    }
  };

  const handleDepositAdd = async () => {
    if (!newDepositName.trim() || !newDepositAmount) return;
    const amount = parseFloat(newDepositAmount);
    if (isNaN(amount) || amount < 0) return;
    const updated = [...recurringDeposits, {
      name: newDepositName.trim(),
      amount,
      account: newDepositAccount,
      frequency: newDepositFrequency,
      startDate: newDepositStartDate,
    }];
    try {
      await depositsAPI.updateDeposits(updated);
      onDepositsUpdate(updated);
      setNewDepositName('');
      setNewDepositAmount('');
      setNewDepositAccount('personal');
      setNewDepositFrequency('biweekly');
      setNewDepositStartDate(getFirstFridayOfMonth());
      setIsAddingDeposit(false);
    } catch (error) {
      console.error('Failed to add deposit:', error);
    }
  };

  return (
    <>
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        hasPartner={hasPartner || false}
        onPartnerLinked={onPartnerLinked || (() => window.location.reload())}
      />
      <div className="glass-panel rounded-xl p-6 h-fit space-y-6">
      {/* User Info */}
      <div className="pb-4 border-b border-gray-700/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-mono text-gray-400">Signed in as</p>
            <p className="text-white font-semibold">{user?.name}</p>
            {user?.partnerName && (
              <p className="text-sm font-mono text-gray-500">Partner: <span className="text-cyan-400">{user.partnerName}</span></p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={logout}
              className="text-xs font-mono text-gray-400 hover:text-red-400 transition-colors"
            >
              Sign out
            </button>
            <button
              onClick={() => setShowProfileModal(true)}
              className="text-xs font-mono text-blue-400 hover:text-blue-300 transition-colors"
            >
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* Recurring Deposits Section */}
      <div>
        <h3 className="text-lg font-display font-bold mb-3 text-green-400">
          Recurring Deposits
        </h3>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDepositsDragEnd}>
          <SortableContext items={recurringDeposits.map((_, i) => `deposit-${i}`)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 mb-3">
              {recurringDeposits.map((deposit, index) => (
                <SortableItem key={`deposit-${index}`} id={`deposit-${index}`}>
                  <div className="flex items-center justify-between group bg-gray-800/20 rounded-lg p-2 hover:bg-gray-800/40 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 cursor-grab">⋮⋮</span>
                      <div className="flex flex-col">
                        <span className="text-gray-300 font-mono text-sm">{deposit.name}</span>
                        <div className="flex gap-2">
                          {editingDepositField?.index === index && editingDepositField.field === 'account' ? (
                            <select
                              value={deposit.account}
                              onChange={(e) => handleDepositFieldChange(index, 'account', e.target.value)}
                              onBlur={() => setEditingDepositField(null)}
                              className="text-[10px] font-mono bg-gray-800 border border-cyan-500 rounded px-1 text-white focus:outline-none"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              <option value="personal">personal</option>
                              <option value="joint">joint</option>
                            </select>
                          ) : (
                            <span
                              onClick={(e) => { e.stopPropagation(); setEditingDepositField({ index, field: 'account' }); }}
                              onPointerDown={(e) => e.stopPropagation()}
                              className={`text-[10px] font-mono cursor-pointer hover:underline ${deposit.account === 'personal' ? 'text-purple-400' : 'text-cyan-400'}`}
                            >
                              {deposit.account}
                            </span>
                          )}
                          {editingDepositField?.index === index && editingDepositField.field === 'frequency' ? (
                            <select
                              value={deposit.frequency}
                              onChange={(e) => handleDepositFieldChange(index, 'frequency', e.target.value)}
                              onBlur={() => setEditingDepositField(null)}
                              className="text-[10px] font-mono bg-gray-800 border border-gray-500 rounded px-1 text-white focus:outline-none"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              <option value="weekly">weekly</option>
                              <option value="biweekly">biweekly</option>
                              <option value="monthly">monthly</option>
                            </select>
                          ) : (
                            <span
                              onClick={(e) => { e.stopPropagation(); setEditingDepositField({ index, field: 'frequency' }); }}
                              onPointerDown={(e) => e.stopPropagation()}
                              className="text-[10px] font-mono text-gray-500 cursor-pointer hover:underline"
                            >
                              {formatFrequency(deposit.frequency)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {editingDeposit === index ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleDepositEditSave(index)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleDepositEditSave(index);
                            if (e.key === 'Escape') setEditingDeposit(null);
                          }}
                          className="w-24 bg-gray-800 border border-green-500 rounded px-2 py-1 text-right text-sm font-mono text-white focus:outline-none"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          onClick={(e) => { e.stopPropagation(); handleDepositEditStart(index, deposit.amount); }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="text-green-400 font-mono text-sm cursor-pointer hover:bg-green-500/20 px-2 py-1 rounded transition-colors"
                        >
                          {formatCurrency(deposit.amount)}
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDepositDelete(index); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all text-xs"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {isAddingDeposit ? (
          <div className="space-y-2 p-3 bg-gray-800/50 rounded-lg">
            <input
              type="text"
              value={newDepositName}
              onChange={(e) => setNewDepositName(e.target.value)}
              placeholder="Deposit name"
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm font-mono text-white focus:outline-none focus:border-green-500"
              autoFocus
            />
            <input
              type="number"
              step="0.01"
              value={newDepositAmount}
              onChange={(e) => setNewDepositAmount(e.target.value)}
              placeholder="Amount"
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm font-mono text-white focus:outline-none focus:border-green-500"
            />
            <div className="flex gap-2">
              <select
                value={newDepositAccount}
                onChange={(e) => setNewDepositAccount(e.target.value as 'personal' | 'joint')}
                className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm font-mono text-white focus:outline-none focus:border-green-500"
              >
                <option value="personal">Personal</option>
                <option value="joint">Joint</option>
              </select>
              <select
                value={newDepositFrequency}
                onChange={(e) => setNewDepositFrequency(e.target.value as 'weekly' | 'biweekly' | 'monthly')}
                className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm font-mono text-white focus:outline-none focus:border-green-500"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-mono block mb-1">
                {newDepositFrequency === 'monthly' ? 'Day of month' : 'Start Friday'}
              </label>
              <input
                type="date"
                value={newDepositStartDate}
                onChange={(e) => setNewDepositStartDate(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm font-mono text-white focus:outline-none focus:border-green-500"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleDepositAdd} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-mono py-1 rounded transition-colors">Add</button>
              <button onClick={() => { setIsAddingDeposit(false); setNewDepositName(''); setNewDepositAmount(''); setNewDepositFrequency('biweekly'); setNewDepositStartDate(getFirstFridayOfMonth()); }} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-mono py-1 rounded transition-colors">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setIsAddingDeposit(true)} className="w-full text-sm font-mono text-gray-400 hover:text-green-400 py-2 border border-dashed border-gray-700 hover:border-green-500 rounded-lg transition-colors">+ Add deposit</button>
        )}

        <div className="mt-3 pt-2 border-t border-gray-700/30 flex justify-between">
          <span className="text-gray-400 font-mono text-xs">Total</span>
          <span className="text-green-400 font-mono text-sm font-bold">{formatCurrency(depositTotal)}</span>
        </div>
      </div>

      {/* Monthly Expenses Section */}
      <div>
        <h3 className="text-lg font-display font-bold mb-3 text-orange-400">
          Monthly Expenses
        </h3>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleExpensesDragEnd}>
          <SortableContext items={expenses.map((e) => `expense-${e.name}`)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 mb-3">
              {expenses.map((expense, index) => (
                <SortableItem key={`expense-${expense.name}`} id={`expense-${expense.name}`}>
                  <div className="flex items-center justify-between group bg-gray-800/20 rounded-lg p-2 hover:bg-gray-800/40 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 cursor-grab">⋮⋮</span>
                      <div className="flex flex-col">
                        <span className="text-gray-300 font-mono text-sm">{expense.name}</span>
                        {editingExpenseAccount === index ? (
                          <select
                            value={expense.account || 'joint'}
                            onChange={(e) => handleExpenseAccountChange(index, e.target.value as 'personal' | 'joint')}
                            onBlur={() => setEditingExpenseAccount(null)}
                            className="text-[10px] font-mono bg-gray-800 border border-orange-500 rounded px-1 text-white focus:outline-none"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            <option value="personal">personal</option>
                            <option value="joint">joint</option>
                          </select>
                        ) : (
                          <span
                            onClick={(e) => { e.stopPropagation(); setEditingExpenseAccount(index); }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className={`text-[10px] font-mono cursor-pointer hover:underline ${(expense.account || 'joint') === 'personal' ? 'text-purple-400' : 'text-cyan-400'}`}
                          >
                            {expense.account || 'joint'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {editingExpense === index ? (
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleExpenseEditSave(index)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleExpenseEditSave(index);
                            if (e.key === 'Escape') setEditingExpense(null);
                          }}
                          className="w-20 bg-gray-800 border border-orange-500 rounded px-2 py-1 text-right text-sm font-mono text-white focus:outline-none"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          onClick={(e) => { e.stopPropagation(); handleExpenseEditStart(index, expense.amount); }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="text-orange-400 font-mono text-sm cursor-pointer hover:bg-orange-500/20 px-2 py-1 rounded transition-colors"
                        >
                          {formatCurrency(expense.amount)}
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleExpenseDelete(expense.name); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all text-xs"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {isAddingExpense ? (
          <div className="space-y-2 p-3 bg-gray-800/50 rounded-lg">
            <input
              type="text"
              value={newExpenseName}
              onChange={(e) => setNewExpenseName(e.target.value)}
              placeholder="Expense name"
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm font-mono text-white focus:outline-none focus:border-orange-500"
              autoFocus
            />
            <input
              type="number"
              value={newExpenseAmount}
              onChange={(e) => setNewExpenseAmount(e.target.value)}
              placeholder="Amount"
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm font-mono text-white focus:outline-none focus:border-orange-500"
            />
            <select
              value={newExpenseAccount}
              onChange={(e) => setNewExpenseAccount(e.target.value as 'personal' | 'joint')}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm font-mono text-white focus:outline-none focus:border-orange-500"
            >
              <option value="personal">Personal</option>
              <option value="joint">Joint</option>
            </select>
            <div className="flex gap-2">
              <button onClick={handleExpenseAdd} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-mono py-1 rounded transition-colors">Add</button>
              <button onClick={() => { setIsAddingExpense(false); setNewExpenseName(''); setNewExpenseAmount(''); setNewExpenseAccount('personal'); }} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-mono py-1 rounded transition-colors">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setIsAddingExpense(true)} className="w-full text-sm font-mono text-gray-400 hover:text-orange-400 py-2 border border-dashed border-gray-700 hover:border-orange-500 rounded-lg transition-colors">+ Add expense</button>
        )}

        {/* Partner's Joint Expenses (read-only) */}
        {partnerJointExpenses.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-700/30">
            <p className="text-xs font-mono text-gray-500 mb-2">{partnerName ? `${partnerName}'s` : "Partner's"} joint expenses</p>
            <div className="space-y-2">
              {partnerJointExpenses.map((expense) => (
                <div key={`partner-expense-${expense.name}`} className="flex items-center justify-between bg-gray-800/10 rounded-lg p-2 opacity-70">
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400/50 text-xs">~</span>
                    <span className="text-gray-400 font-mono text-sm">{expense.name}</span>
                  </div>
                  <span className="text-orange-400/70 font-mono text-sm">{formatCurrency(expense.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 pt-2 border-t border-gray-700/30 flex justify-between">
          <span className="text-gray-400 font-mono text-xs">Total</span>
          <span className="text-orange-400 font-mono text-sm font-bold">{formatCurrency(expenseTotal)}</span>
        </div>
      </div>
    </div>
    </>
  );
}
