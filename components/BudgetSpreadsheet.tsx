'use client';

import { useState, useEffect, useRef } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  isToday
} from 'date-fns';
import { budgetAPI, BudgetEntry, balancesAPI, RecurringDeposit, MonthlyExpense, CreditCard, creditCardHistoryAPI, CreditCardMonthlyHistory, partnerAPI } from '@/lib/api';
import { getDepositsForDate, getDepositAmountForDate } from '@/lib/deposits';
import DayEditModal from './DayEditModal';

interface Props {
  currentMonth: Date;
  entries: BudgetEntry[];
  previousMonthEntries: BudgetEntry[];
  nextMonthEntries: BudgetEntry[];
  onEntryUpdate: () => void;
  personalStartingBalance: number;
  jointStartingBalance: number;
  onStartingBalancesUpdate: (personal: number, joint: number) => void;
  recurringDeposits: RecurringDeposit[];
  onRecurringDepositUpdate: (deposits: RecurringDeposit[]) => void;
  monthlyExpenses: MonthlyExpense[];
  creditCards: CreditCard[];
  userCreatedAt?: string;
  hasPartner?: boolean;
  partnerJointCardNames?: string[];
  onMonthChange?: (newMonth: Date) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type AccountField = 'personal-checking' | 'joint-checking' | 'personal-deduction' | 'joint-deduction';

interface AccountLine {
  field: AccountField;
  label: string;
  color: string;
  hoverBg: string;
  type: 'income' | 'expense';
}

const PERSONAL_LINES: AccountLine[] = [
  { field: 'personal-checking', label: '+', color: 'text-green-400', hoverBg: 'hover:bg-green-500/20', type: 'income' },
  { field: 'personal-deduction', label: '−', color: 'text-red-400', hoverBg: 'hover:bg-red-500/20', type: 'expense' },
];

const JOINT_LINES: AccountLine[] = [
  { field: 'joint-checking', label: '+', color: 'text-blue-400', hoverBg: 'hover:bg-blue-500/20', type: 'income' },
  { field: 'joint-deduction', label: '−', color: 'text-orange-400', hoverBg: 'hover:bg-orange-500/20', type: 'expense' },
];

export default function BudgetSpreadsheet({
  currentMonth,
  entries,
  previousMonthEntries,
  nextMonthEntries,
  onEntryUpdate,
  personalStartingBalance,
  jointStartingBalance,
  onStartingBalancesUpdate,
  recurringDeposits,
  onRecurringDepositUpdate,
  monthlyExpenses,
  creditCards,
  userCreatedAt,
  hasPartner,
  partnerJointCardNames = [],
  onMonthChange,
}: Props) {
  const [editingCell, setEditingCell] = useState<{ dateKey: string; field: AccountField } | null>(null);
  const [editingBalance, setEditingBalance] = useState<'personal' | 'joint' | null>(null);
  const [editingRecurringDeposit, setEditingRecurringDeposit] = useState<number | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [showingEntries, setShowingEntries] = useState<{ dateKey: string; field: AccountField } | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [creditCardHistory, setCreditCardHistory] = useState<CreditCardMonthlyHistory[]>([]);
  const [ccHistoryLoaded, setCcHistoryLoaded] = useState(false);
  const [historyCache, setHistoryCache] = useState<Map<string, CreditCardMonthlyHistory[]>>(new Map());
  const [modalOpen, setModalOpen] = useState<{ date: Date; account: 'personal' | 'joint'; focusField: 'deposit' | 'withdrawal' } | null>(null);

  // Month name mapping
  const MONTH_NAMES: Record<string, number> = {
    'january': 0, 'jan': 0,
    'february': 1, 'feb': 1,
    'march': 2, 'mar': 2,
    'april': 3, 'apr': 3,
    'may': 4,
    'june': 5, 'jun': 5,
    'july': 6, 'jul': 6,
    'august': 7, 'aug': 7,
    'september': 8, 'sep': 8, 'sept': 8,
    'october': 9, 'oct': 9,
    'november': 10, 'nov': 10,
    'december': 11, 'dec': 11,
  };

  // Fetch credit card history for a specific month (with caching)
  // Merges partner history for partner cards
  const fetchHistoryForMonth = async (year: number, month: number): Promise<CreditCardMonthlyHistory[]> => {
    const cacheKey = `${year}-${month}`;
    if (historyCache.has(cacheKey)) {
      return historyCache.get(cacheKey)!;
    }
    try {
      const data = await creditCardHistoryAPI.getHistory(year, month);
      let merged = [...data];
      if (hasPartner) {
        try {
          const partnerData = await partnerAPI.getPartnerHistory(year, month);
          for (const ph of partnerData) {
            if (partnerJointCardNames.includes(ph.cardName)) {
              const idx = merged.findIndex(h => h.cardName === ph.cardName);
              if (idx >= 0) merged[idx] = ph;
              else merged.push(ph);
            }
          }
        } catch (err) {
          console.error('Failed to fetch partner history:', err);
        }
      }
      setHistoryCache(prev => new Map(prev).set(cacheKey, merged));
      return merged;
    } catch (error) {
      console.error('Failed to fetch credit card history:', error);
      return [];
    }
  };

  // Calculate last day of previous month
  const lastDayOfPrevMonth = endOfMonth(subMonths(currentMonth, 1));
  const previousMonth = subMonths(currentMonth, 1);
  const prevYear = previousMonth.getFullYear();
  const prevMonthNum = previousMonth.getMonth();

  // Calculate next month for preview
  const nextMonth = addMonths(currentMonth, 1);

  // Determine if this is the user's start month based on createdAt
  const userStartDate = userCreatedAt ? new Date(userCreatedAt) : null;
  const userStartYear = userStartDate?.getFullYear() ?? 2026;
  const userStartMonth = userStartDate?.getMonth() ?? 0; // 0-indexed
  const isStartMonth = currentMonth.getFullYear() === userStartYear && currentMonth.getMonth() === userStartMonth;

  // Check if we're viewing a month after the start month (to show previous month ending balances)
  const isAfterStartMonth = userStartDate
    ? new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1) > new Date(userStartYear, userStartMonth, 1)
    : false;

  // previousMonthEndingBalances and previousMonthDayBalances are calculated further below

  // Fetch credit card history for all months needed:
  // - Previous month (for current month's getLinkedAmount)
  // - All months from (startMonth - 1) through (previousMonth - 1) for chaining previous month balances
  useEffect(() => {
    setCcHistoryLoaded(false);
    const fetchHistories = async () => {
      try {
        // Build list of all months we need credit card history for
        const monthsToFetch: { year: number; month: number }[] = [
          { year: prevYear, month: prevMonthNum }, // for current month's entries
        ];

        // For chaining: each month M in the chain needs history for (M - 1)
        // Chain goes from startMonth through previousMonth
        if (userStartDate) {
          let m = new Date(userStartYear, userStartMonth, 1);
          const prevMonthDate = new Date(prevYear, prevMonthNum, 1);
          while (m <= prevMonthDate) {
            const historyMonth = subMonths(m, 1);
            monthsToFetch.push({ year: historyMonth.getFullYear(), month: historyMonth.getMonth() });
            m = addMonths(m, 1);
          }
        }

        // Deduplicate
        const unique = monthsToFetch.filter((f, i, arr) =>
          arr.findIndex(x => x.year === f.year && x.month === f.month) === i
        );

        const results = await Promise.all(
          unique.map(f => creditCardHistoryAPI.getHistory(f.year, f.month))
        );

        // Also fetch partner history and merge for partner cards
        let partnerResults: CreditCardMonthlyHistory[][] = [];
        if (hasPartner) {
          try {
            partnerResults = await Promise.all(
              unique.map(f => partnerAPI.getPartnerHistory(f.year, f.month))
            );
          } catch (err) {
            console.error('Failed to fetch partner history:', err);
            partnerResults = unique.map(() => []);
          }
        }

        // Store all in historyCache, merging partner history for partner cards
        const newCache = new Map(historyCache);
        unique.forEach((f, i) => {
          let merged = [...results[i]];
          if (hasPartner && partnerResults[i]) {
            // For partner cards, use partner's history (it has the real values)
            for (const partnerHist of partnerResults[i]) {
              if (partnerJointCardNames.includes(partnerHist.cardName)) {
                // Replace user's entry with partner's for this card
                const existingIdx = merged.findIndex(h => h.cardName === partnerHist.cardName);
                if (existingIdx >= 0) {
                  merged[existingIdx] = partnerHist;
                } else {
                  merged.push(partnerHist);
                }
              }
            }
          }
          newCache.set(`${f.year}-${f.month}`, merged);
        });
        setHistoryCache(newCache);

        // Set the primary creditCardHistory (for current month's getLinkedAmount)
        const primaryIdx = unique.findIndex(f => f.year === prevYear && f.month === prevMonthNum);
        setCreditCardHistory(results[primaryIdx] ?? []);

        setCcHistoryLoaded(true);
      } catch (error) {
        console.error('Failed to fetch credit card history:', error);
        setCcHistoryLoaded(true);
      }
    };
    fetchHistories();
  }, [prevYear, prevMonthNum, userStartYear, userStartMonth]);



  // Generate calendar grid (6 weeks = 42 days)
  // Always include at least one week from the previous month to show ending balances
  const generateCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    let calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });

    // If the month starts on a Monday, go back one week to show previous month's last week
    if (isSameDay(calendarStart, monthStart)) {
      calendarStart = addDays(calendarStart, -7);
    }

    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: Date[] = [];
    let day = calendarStart;

    while (day <= calendarEnd) {
      days.push(day);
      day = addDays(day, 1);
    }

    // Ensure we always have at least 6 weeks (42 days) for consistent layout
    while (days.length < 42) {
      days.push(addDays(days[days.length - 1], 1));
    }

    return days;
  };

  const calendarDays = generateCalendarDays();

  const getEntriesForDay = (day: Date) => {
    return entries.filter(entry =>
      isSameDay(new Date(entry.date), day)
    );
  };

  // Get entries for next month days (for preview)
  const getNextMonthEntriesForDay = (day: Date) => {
    return nextMonthEntries.filter(entry =>
      isSameDay(new Date(entry.date), day)
    );
  };

  // Check if a day is in the next month
  const isNextMonth = (day: Date) => isSameMonth(day, nextMonth);

  const getAmountForField = (day: Date, field: AccountField) => {
    return getEntriesForDay(day)
      .filter(e => e.category === field)
      .reduce((sum, e) => sum + getLinkedAmount(e), 0);
  };

  const getEntriesForField = (day: Date, field: AccountField) => {
    return getEntriesForDay(day).filter(e => e.category === field);
  };

  // Get recurring deposits for a specific day and account
  const getRecurringDepositsForDay = (day: Date, account: 'personal' | 'joint') => {
    const deposits = getDepositsForDate(recurringDeposits, day);
    return deposits.filter(d => d.account === account);
  };

  const getRecurringDepositAmountForDay = (day: Date, account: 'personal' | 'joint') => {
    return getRecurringDepositsForDay(day, account).reduce((sum, d) => sum + getDepositAmountForDate(d, day), 0);
  };

  // Find the index of a recurring deposit in the main array
  const findRecurringDepositIndex = (deposit: RecurringDeposit) => {
    return recurringDeposits.findIndex(d =>
      d.name === deposit.name && d.account === deposit.account && d.amount === deposit.amount
    );
  };

  const handleRecurringDepositEdit = (deposit: RecurringDeposit) => {
    const index = findRecurringDepositIndex(deposit);
    if (index !== -1) {
      setEditingRecurringDeposit(index);
      setTempValue(deposit.amount.toString());
    }
  };

  const handleRecurringDepositSave = async () => {
    if (editingRecurringDeposit === null) return;
    const newAmount = parseFloat(tempValue);
    if (isNaN(newAmount) || newAmount < 0) {
      setEditingRecurringDeposit(null);
      setTempValue('');
      return;
    }
    const updated = [...recurringDeposits];
    const deposit = updated[editingRecurringDeposit];
    if (deposit.amount !== newAmount) {
      const today = format(new Date(), 'yyyy-MM-dd');
      const history = deposit.amountHistory ? [...deposit.amountHistory] : [];
      // If first edit, record the original amount with startDate
      if (history.length === 0) {
        history.push({ amount: deposit.amount, effectiveDate: deposit.startDate });
      }
      // Record the new amount with today's date
      history.push({ amount: newAmount, effectiveDate: today });
      updated[editingRecurringDeposit] = { ...deposit, amount: newAmount, amountHistory: history };
    }
    onRecurringDepositUpdate(updated);
    setEditingRecurringDeposit(null);
    setTempValue('');
  };

  const handleSkipRecurringDeposit = (deposit: RecurringDeposit, dateKey: string) => {
    console.log('handleSkipRecurringDeposit called:', { deposit, dateKey });
    const index = findRecurringDepositIndex(deposit);
    console.log('Found deposit at index:', index);
    if (index === -1) return;

    const updated = [...recurringDeposits];
    const currentSkipped = updated[index].skippedDates || [];
    updated[index] = {
      ...updated[index],
      skippedDates: [...currentSkipped, dateKey],
    };
    console.log('Calling onRecurringDepositUpdate with:', updated);
    onRecurringDepositUpdate(updated);
    setShowingEntries(null);
  };

  // Modal handlers
  const openModal = (date: Date, account: 'personal' | 'joint', focusField: 'deposit' | 'withdrawal') => {
    setModalOpen({ date, account, focusField });
    setShowingEntries(null);
    setEditingCell(null);
  };

  const closeModal = () => {
    setModalOpen(null);
  };

  const handleModalAddEntry = async (field: string, value: string) => {
    if (!modalOpen) return;
    const dateKey = format(modalOpen.date, 'yyyy-MM-dd');
    await saveEntry({ dateKey, field: field as AccountField }, value);
  };

  const handleModalDeleteEntry = (entryId: string) => {
    deleteEntry(entryId);
  };

  const handleModalSkipRecurringDeposit = (deposit: RecurringDeposit) => {
    if (!modalOpen) return;
    const dateKey = format(modalOpen.date, 'yyyy-MM-dd');
    handleSkipRecurringDeposit(deposit, dateKey);
  };

  const handleModalEditRecurringDeposit = (deposit: RecurringDeposit, newAmount: number) => {
    const index = findRecurringDepositIndex(deposit);
    if (index === -1) return;
    const updated = [...recurringDeposits];
    const current = updated[index];
    if (current.amount !== newAmount) {
      const today = format(new Date(), 'yyyy-MM-dd');
      const history = current.amountHistory ? [...current.amountHistory] : [];
      // If first edit, record the original amount with startDate
      if (history.length === 0) {
        history.push({ amount: current.amount, effectiveDate: current.startDate });
      }
      // Record the new amount with today's date
      history.push({ amount: newAmount, effectiveDate: today });
      updated[index] = { ...current, amount: newAmount, amountHistory: history };
    } else {
      updated[index] = { ...current, amount: newAmount };
    }
    onRecurringDepositUpdate(updated);
  };

  const deleteEntry = async (entryId: string) => {
    try {
      await budgetAPI.deleteEntry(entryId);
      onEntryUpdate();
      setShowingEntries(null);
    } catch (error) {
      console.error('Failed to delete entry:', error);
    }
  };

  // Calculate total of all credit cards for a month
  const calculateMonthTotal = (history: CreditCardMonthlyHistory[], isJoint: boolean): number => {
    return history.reduce((sum, h) => sum + (isJoint ? (h.joint || 0) : (h.actual || 0)), 0);
  };

  // Get the current amount for a linked entry
  // ccHistory parameter allows overriding which credit card history is used for resolution
  // (needed for previous month balance calculation, which must use prev-prev month's history)
  const getLinkedAmount = (entry: BudgetEntry, ccHistory?: CreditCardMonthlyHistory[]): number => {
    const effectiveHistory = ccHistory ?? creditCardHistory;

    // If linkedTo is set, use it
    if (entry.linkedTo) {
      const parts = entry.linkedTo.split(':');
      const type = parts[0];
      const name = parts[1];
      const year = parts[2] ? parseInt(parts[2]) : null;
      const month = parts[3] ? parseInt(parts[3]) : null;

      if (type === 'expense') {
        const expense = monthlyExpenses.find(e => e.name === name);
        return expense?.amount ?? entry.amount;
      }

      if (type === 'creditCard') {
        if (year !== null && month !== null) {
          const cacheKey = `${year}-${month}`;
          const cachedHistory = historyCache.get(cacheKey);
          if (cachedHistory) {
            const history = cachedHistory.find(h => h.cardName === name);
            return history?.actual ?? entry.amount;
          }
        }
        const history = effectiveHistory.find(h => h.cardName === name);
        return history?.actual ?? entry.amount;
      }

      if (type === 'creditCardJoint') {
        if (year !== null && month !== null) {
          const cacheKey = `${year}-${month}`;
          const cachedHistory = historyCache.get(cacheKey);
          if (cachedHistory) {
            const history = cachedHistory.find(h => h.cardName === name);
            return history?.joint ?? entry.amount;
          }
        }
        const history = effectiveHistory.find(h => h.cardName === name);
        return history?.joint ?? entry.amount;
      }

      if (type === 'monthTotal') {
        // parts: ["monthTotal", year, month, "personal"|"joint"]
        const totalYear = parts[1] ? parseInt(parts[1]) : null;
        const totalMonth = parts[2] ? parseInt(parts[2]) : null;
        const isJoint = parts[3] === 'joint';

        if (totalYear !== null && totalMonth !== null) {
          const cacheKey = `${totalYear}-${totalMonth}`;
          const cachedHistory = historyCache.get(cacheKey);
          if (cachedHistory) {
            return calculateMonthTotal(cachedHistory, isJoint);
          }
          // If not in cache, use previous month's history if it matches
          if (totalYear === prevYear && totalMonth === prevMonthNum) {
            return calculateMonthTotal(creditCardHistory, isJoint);
          }
        }
        return entry.amount;
      }

      if (type === 'projectedTotal') {
        // Sum of all projected amounts
        return calculateProjectedTotal();
      }

      if (type === 'projected') {
        // Specific card's projected amount
        const cardName = parts[1];
        const card = creditCards.find(c => c.name === cardName);
        return card?.projected ?? entry.amount;
      }

      return entry.amount;
    }

    // Fallback: check if description matches an expense name (for legacy entries without linkedTo)
    if (entry.description) {
      const expense = monthlyExpenses.find(e => e.name.toLowerCase() === entry.description.toLowerCase());
      if (expense) {
        return expense.amount;
      }

      // Check credit card names
      const card = creditCards.find(c => c.name.toLowerCase() === entry.description.toLowerCase());
      if (card) {
        const history = effectiveHistory.find(h => h.cardName === card.name);
        return history?.actual ?? entry.amount;
      }

      // Check for "(joint)" suffix in description
      if (entry.description.toLowerCase().endsWith('(joint)')) {
        const cardName = entry.description.replace(/\s*\(joint\)\s*$/i, '').trim();
        const cardForJoint = creditCards.find(c => c.name.toLowerCase() === cardName.toLowerCase());
        if (cardForJoint) {
          const history = effectiveHistory.find(h => h.cardName === cardForJoint.name);
          return history?.joint ?? entry.amount;
        }
      }
    }

    return entry.amount;
  };

  // Check if abbreviated input matches a card name
  // e.g., "hannah sapph" matches "Hannah Sapphire Preferred"
  const matchesCardName = (input: string, cardName: string): boolean => {
    const inputWords = input.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const cardWords = cardName.toLowerCase().split(/\s+/).filter(w => w.length > 0);

    if (inputWords.length === 0) return false;

    // Each input word must match the start of a card word, in order
    let cardIndex = 0;
    for (const inputWord of inputWords) {
      let found = false;
      // Look for a matching card word starting from current position
      while (cardIndex < cardWords.length) {
        if (cardWords[cardIndex].startsWith(inputWord)) {
          found = true;
          cardIndex++;
          break;
        }
        cardIndex++;
      }
      if (!found) return false;
    }
    return true;
  };

  // Find a card by abbreviated name
  const findCardByAbbreviation = (input: string): CreditCard | undefined => {
    const normalizedInput = input.toLowerCase().replace(/\s+/g, ' ').trim();

    // First try exact match
    const exactMatch = creditCards.find(c =>
      c.name.toLowerCase().replace(/\s+/g, ' ').trim() === normalizedInput
    );
    if (exactMatch) return exactMatch;

    // Then try abbreviation match
    return creditCards.find(c => matchesCardName(normalizedInput, c.name));
  };

  // Find an expense by abbreviated name
  const findExpenseByAbbreviation = (input: string): MonthlyExpense | undefined => {
    const normalizedInput = input.toLowerCase().replace(/\s+/g, ' ').trim();

    // First try exact match
    const exactMatch = monthlyExpenses.find(e =>
      e.name.toLowerCase().replace(/\s+/g, ' ').trim() === normalizedInput
    );
    if (exactMatch) return exactMatch;

    // Then try abbreviation match (reuse the same matching logic)
    return monthlyExpenses.find(e => matchesCardName(normalizedInput, e.name));
  };

  // Parse credit card input: "CardName Month Joint" or "CardName Month" or just "CardName"
  const parseCreditCardInput = (input: string): { cardName: string; monthNum: number | null; isJoint: boolean } | null => {
    const lowerInput = input.toLowerCase().trim();
    const words = lowerInput.split(/\s+/);

    // Check if last word is "joint" or "personal"
    let isJoint = false;
    if (words[words.length - 1] === 'joint') {
      isJoint = true;
      words.pop();
    } else if (words[words.length - 1] === 'personal') {
      words.pop();
    }

    // Check if last remaining word is a month name or abbreviation
    let monthNum: number | null = null;
    if (words.length > 0 && MONTH_NAMES[words[words.length - 1]] !== undefined) {
      monthNum = MONTH_NAMES[words[words.length - 1]];
      words.pop();
    }

    // The remaining words are the card name
    const cardName = words.join(' ');
    if (!cardName) return null;

    return { cardName, monthNum, isJoint };
  };

  // Parse projected amount input (e.g., "projected total", "apple projected total")
  const parseProjectedInput = (input: string): { cardName: string | null; isTotal: boolean } | null => {
    const lowerInput = input.toLowerCase().trim();
    const words = lowerInput.split(/\s+/);

    // Must end with "total" or just be "projected"
    if (words[words.length - 1] === 'total') {
      words.pop();
    }

    // Must have "projected"
    const projectedIndex = words.indexOf('projected');
    if (projectedIndex === -1) return null;

    // Remove "projected" and get the card name (if any)
    words.splice(projectedIndex, 1);

    if (words.length === 0) {
      // Just "projected" or "projected total" - get total of all projected
      return { cardName: null, isTotal: true };
    }

    // Remaining words are the card name
    const cardName = words.join(' ');
    return { cardName, isTotal: false };
  };

  // Calculate total projected amount from all credit cards
  const calculateProjectedTotal = (): number => {
    return creditCards.reduce((sum, card) => sum + (card.projected || 0), 0);
  };

  // Cache the previous month balance result so we don't flash stale values while history loads
  const prevMonthBalanceRef = useRef<{ dayBalances: Map<string, { personal: number; joint: number }>; ending: { personal: number; joint: number } }>({
    dayBalances: new Map(), ending: { personal: 0, joint: 0 }
  });

  // Calculate previous month's ending balance by chaining from the user's start month
  // through the previous month, using the correct credit card history for each month.
  const calculatePreviousMonthBalances = () => {
    const emptyResult = { dayBalances: new Map<string, { personal: number; joint: number }>(), ending: { personal: 0, joint: 0 } };

    if (!isAfterStartMonth && !isStartMonth) return emptyResult;

    // Don't compute with stale history — return cached result until fresh data is loaded
    if (!ccHistoryLoaded) return prevMonthBalanceRef.current;

    let personalBalance = personalStartingBalance;
    let jointBalance = jointStartingBalance;

    // Chain from start month through previous month
    const chainStart = userStartDate
      ? startOfMonth(new Date(userStartYear, userStartMonth, 1))
      : startOfMonth(previousMonth);
    const chainEnd = endOfMonth(previousMonth);
    const dayBalances: Map<string, { personal: number; joint: number }> = new Map();

    let day = chainStart;
    let currentChainMonth = -1;
    let currentCcHistory: CreditCardMonthlyHistory[] = [];

    while (day <= chainEnd) {
      const dayMonth = day.getMonth();
      const dayYear = day.getFullYear();

      // When we enter a new month, look up the correct credit card history
      if (dayMonth !== currentChainMonth || day.getDate() === 1) {
        currentChainMonth = dayMonth;
        const historyMonth = subMonths(new Date(dayYear, dayMonth, 1), 1);
        const cacheKey = `${historyMonth.getFullYear()}-${historyMonth.getMonth()}`;
        currentCcHistory = historyCache.get(cacheKey) ?? [];
      }

      const dateKey = format(day, 'yyyy-MM-dd');
      const dayEntries = previousMonthEntries.filter(entry =>
        isSameDay(new Date(entry.date), day)
      );

      const personalDeposits = dayEntries
        .filter(e => e.category === 'personal-checking')
        .reduce((sum, e) => sum + getLinkedAmount(e, currentCcHistory), 0);
      const personalExpenses = dayEntries
        .filter(e => e.category === 'personal-deduction')
        .reduce((sum, e) => sum + getLinkedAmount(e, currentCcHistory), 0);
      const jointDeposits = dayEntries
        .filter(e => e.category === 'joint-checking')
        .reduce((sum, e) => sum + getLinkedAmount(e, currentCcHistory), 0);
      const jointExpenses = dayEntries
        .filter(e => e.category === 'joint-deduction')
        .reduce((sum, e) => sum + getLinkedAmount(e, currentCcHistory), 0);

      const personalRecurring = getRecurringDepositAmountForDay(day, 'personal');
      const jointRecurring = getRecurringDepositAmountForDay(day, 'joint');

      personalBalance = personalBalance + personalDeposits + personalRecurring - personalExpenses;
      jointBalance = jointBalance + jointDeposits + jointRecurring - jointExpenses;

      dayBalances.set(dateKey, { personal: personalBalance, joint: jointBalance });

      day = addDays(day, 1);
    }

    const result = { dayBalances, ending: { personal: personalBalance, joint: jointBalance } };
    prevMonthBalanceRef.current = result;
    return result;
  };

  const { dayBalances: previousMonthDayBalances, ending: previousMonthEndingBalances } = calculatePreviousMonthBalances();

  // Parse "previous month" or month name for total lookups
  const parseMonthTotalInput = (input: string): { monthNum: number; year: number; isJoint: boolean } | null => {
    const lowerInput = input.toLowerCase().trim();
    const words = lowerInput.split(/\s+/);

    // Check for "total" at the end
    if (words[words.length - 1] !== 'total') return null;
    words.pop();

    // Check for "personal" or "joint"
    let isJoint = false;
    if (words[words.length - 1] === 'joint') {
      isJoint = true;
      words.pop();
    } else if (words[words.length - 1] === 'personal') {
      words.pop();
    } else {
      return null; // Must specify personal or joint
    }

    // Check for "previous month" or a specific month name
    const remaining = words.join(' ');
    let monthNum: number;
    let year: number;

    if (remaining === 'previous month' || remaining === 'prev month' || remaining === 'last month') {
      monthNum = prevMonthNum;
      year = prevYear;
    } else if (MONTH_NAMES[remaining] !== undefined) {
      monthNum = MONTH_NAMES[remaining];
      year = currentMonth.getFullYear();
      // If the specified month is after the current month, use previous year
      if (monthNum > currentMonth.getMonth()) {
        year -= 1;
      }
    } else {
      return null;
    }

    return { monthNum, year, isJoint };
  };

  // Look up an expense or credit card by name (async for fetching history)
  const lookupExpenseByNameAsync = async (name: string, entryDate?: Date): Promise<{ amount: number; description: string; linkedTo?: string } | null> => {
    const lowerName = name.toLowerCase().trim();

    // Check for projected amounts (only for future dates)
    const isFutureDate = entryDate && entryDate > new Date();
    const projectedParsed = parseProjectedInput(lowerName);
    if (projectedParsed && isFutureDate) {
      if (projectedParsed.isTotal) {
        // "projected total" - sum of all projected amounts
        const total = calculateProjectedTotal();
        return {
          amount: total,
          description: 'Projected Total',
          linkedTo: 'projectedTotal',
        };
      } else if (projectedParsed.cardName) {
        // "cardname projected" - specific card's projected amount
        const card = findCardByAbbreviation(projectedParsed.cardName);
        if (card) {
          return {
            amount: card.projected,
            description: `${card.name} Projected`,
            linkedTo: `projected:${card.name}`,
          };
        }
      }
    }

    // Check for month total (e.g., "previous month personal total", "dec joint total")
    const monthTotalParsed = parseMonthTotalInput(lowerName);
    if (monthTotalParsed) {
      const historyData = await fetchHistoryForMonth(monthTotalParsed.year, monthTotalParsed.monthNum);
      const total = calculateMonthTotal(historyData, monthTotalParsed.isJoint);
      const monthName = new Date(monthTotalParsed.year, monthTotalParsed.monthNum).toLocaleString('default', { month: 'long' });
      const accountType = monthTotalParsed.isJoint ? 'Joint' : 'Personal';
      return {
        amount: total,
        description: `${monthName} ${accountType} Total`,
        linkedTo: `monthTotal:${monthTotalParsed.year}:${monthTotalParsed.monthNum}:${monthTotalParsed.isJoint ? 'joint' : 'personal'}`,
      };
    }

    // Check monthly expenses first (with abbreviation support)
    const expense = findExpenseByAbbreviation(lowerName);
    if (expense) {
      return { amount: expense.amount, description: expense.name, linkedTo: `expense:${expense.name}` };
    }

    // Try to parse as credit card input with optional month and joint modifier
    const parsed = parseCreditCardInput(name);
    if (parsed) {
      // Find card using abbreviation matching
      const card = findCardByAbbreviation(parsed.cardName);

      console.log('Credit card lookup:', {
        input: name,
        parsed,
        availableCards: creditCards.map(c => c.name),
        foundCard: card?.name
      });
      if (card) {
        // Determine which month's history to use
        let historyToUse: CreditCardMonthlyHistory[] = creditCardHistory;
        let year = prevYear;
        let month = prevMonthNum;

        if (parsed.monthNum !== null) {
          // User specified a month - determine the year
          // If the specified month is after the current month, use previous year
          const currentMonthNum = currentMonth.getMonth();
          year = currentMonth.getFullYear();
          if (parsed.monthNum > currentMonthNum) {
            year -= 1;
          }
          month = parsed.monthNum;
          historyToUse = await fetchHistoryForMonth(year, month);
        }

        const history = historyToUse.find(h => h.cardName === card.name);
        const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });

        if (parsed.isJoint) {
          if (history && history.joint > 0) {
            return {
              amount: history.joint,
              description: `${card.name} ${monthName} (joint)`,
              linkedTo: `creditCardJoint:${card.name}:${year}:${month}`,
            };
          }
          // Fall back to joint projected amount if no history
          return {
            amount: card.jointProjected ?? card.projected,
            description: `${card.name} (joint)`,
            linkedTo: `creditCardJoint:${card.name}`,
          };
        } else {
          if (history) {
            return {
              amount: history.actual,
              description: `${card.name} ${monthName}`,
              linkedTo: `creditCard:${card.name}:${year}:${month}`,
            };
          }
          // Fall back to projected amount if no history
          return { amount: card.projected, description: card.name, linkedTo: `creditCard:${card.name}` };
        }
      }
    }

    // Check for simple credit card name match with abbreviation support (backward compatibility)
    const simpleCard = findCardByAbbreviation(lowerName);
    if (simpleCard) {
      const history = creditCardHistory.find(h => h.cardName === simpleCard.name);
      if (history) {
        return { amount: history.actual, description: simpleCard.name, linkedTo: `creditCard:${simpleCard.name}` };
      }
      return { amount: simpleCard.projected, description: simpleCard.name, linkedTo: `creditCard:${simpleCard.name}` };
    }

    // Check for simple "-joint" or " joint" suffix (backward compatibility)
    if (lowerName.endsWith('-joint') || lowerName.endsWith(' joint')) {
      const cardName = lowerName.replace(/-joint$/, '').replace(/ joint$/, '').trim();
      const cardForJoint = findCardByAbbreviation(cardName);
      if (cardForJoint) {
        const history = creditCardHistory.find(h => h.cardName === cardForJoint.name);
        if (history && history.joint > 0) {
          return { amount: history.joint, description: `${cardForJoint.name} (joint)`, linkedTo: `creditCardJoint:${cardForJoint.name}` };
        }
      }
    }

    return null;
  };

  // Synchronous version for non-async contexts (uses cached history only)
  const lookupExpenseByName = (name: string): { amount: number; description: string; linkedTo?: string } | null => {
    const lowerName = name.toLowerCase().trim();

    // Check monthly expenses first (with abbreviation support)
    const expense = findExpenseByAbbreviation(lowerName);
    if (expense) {
      return { amount: expense.amount, description: expense.name, linkedTo: `expense:${expense.name}` };
    }

    // Check credit card names with abbreviation support - look up in previous month's history
    const card = findCardByAbbreviation(lowerName);
    if (card) {
      const history = creditCardHistory.find(h => h.cardName === card.name);
      if (history) {
        return { amount: history.actual, description: card.name, linkedTo: `creditCard:${card.name}` };
      }
      return { amount: card.projected, description: card.name, linkedTo: `creditCard:${card.name}` };
    }

    // Check for "-joint" or " joint" suffix with abbreviation support
    if (lowerName.endsWith('-joint') || lowerName.endsWith(' joint')) {
      const cardName = lowerName.replace(/-joint$/, '').replace(/ joint$/, '').trim();
      const cardForJoint = findCardByAbbreviation(cardName);
      if (cardForJoint) {
        const history = creditCardHistory.find(h => h.cardName === cardForJoint.name);
        if (history && history.joint > 0) {
          return { amount: history.joint, description: `${cardForJoint.name} (joint)`, linkedTo: `creditCardJoint:${cardForJoint.name}` };
        }
      }
    }

    return null;
  };

  // Calculate running balances for each day of the month
  const calculateRunningBalances = () => {
    const balances: Map<string, { personal: number; joint: number }> = new Map();

    // Use previous month's ending balance for months after start month
    // Otherwise use the original starting balance
    let personalBalance = isAfterStartMonth ? previousMonthEndingBalances.personal : personalStartingBalance;
    let jointBalance = isAfterStartMonth ? previousMonthEndingBalances.joint : jointStartingBalance;

    // Get all days in the current month in order
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    let day = monthStart;

    while (day <= monthEnd) {
      const dateKey = format(day, 'yyyy-MM-dd');

      // Get manual deposits and expenses for this day
      const personalDeposits = getAmountForField(day, 'personal-checking');
      const personalExpenses = getAmountForField(day, 'personal-deduction');
      const jointDeposits = getAmountForField(day, 'joint-checking');
      const jointExpenses = getAmountForField(day, 'joint-deduction');

      // Get recurring deposits for this day
      const personalRecurring = getRecurringDepositAmountForDay(day, 'personal');
      const jointRecurring = getRecurringDepositAmountForDay(day, 'joint');

      // Calculate end of day balance (including recurring deposits)
      personalBalance = personalBalance + personalDeposits + personalRecurring - personalExpenses;
      jointBalance = jointBalance + jointDeposits + jointRecurring - jointExpenses;

      balances.set(dateKey, { personal: personalBalance, joint: jointBalance });

      day = addDays(day, 1);
    }

    return balances;
  };

  const runningBalances = calculateRunningBalances();

  // Calculate next month's per-day balances for overflow day display
  const calculateNextMonthBalances = () => {
    const balances: Map<string, { personal: number; joint: number }> = new Map();

    // Start from current month's ending balance
    const lastDayKey = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const currentEnding = runningBalances.get(lastDayKey);
    if (!currentEnding) return balances;

    let personalBalance = currentEnding.personal;
    let jointBalance = currentEnding.joint;

    const nextMonthStart = startOfMonth(nextMonth);
    const nextMonthEnd = endOfMonth(nextMonth);

    let day = nextMonthStart;
    while (day <= nextMonthEnd) {
      const dateKey = format(day, 'yyyy-MM-dd');
      const dayEntries = nextMonthEntries.filter(entry =>
        isSameDay(new Date(entry.date), day)
      );

      const personalRecurring = getDepositsForDate(recurringDeposits, day)
        .filter(d => d.account === 'personal')
        .reduce((sum, d) => sum + getDepositAmountForDate(d, day), 0);
      const jointRecurring = getDepositsForDate(recurringDeposits, day)
        .filter(d => d.account === 'joint')
        .reduce((sum, d) => sum + getDepositAmountForDate(d, day), 0);

      const personalDeposits = dayEntries
        .filter(e => e.category === 'personal-checking')
        .reduce((sum, e) => sum + e.amount, 0);
      const personalExpenses = dayEntries
        .filter(e => e.category === 'personal-deduction')
        .reduce((sum, e) => sum + e.amount, 0);
      const jointDeposits = dayEntries
        .filter(e => e.category === 'joint-checking')
        .reduce((sum, e) => sum + e.amount, 0);
      const jointExpenses = dayEntries
        .filter(e => e.category === 'joint-deduction')
        .reduce((sum, e) => sum + e.amount, 0);

      personalBalance = personalBalance + personalDeposits + personalRecurring - personalExpenses;
      jointBalance = jointBalance + jointDeposits + jointRecurring - jointExpenses;

      balances.set(dateKey, { personal: personalBalance, joint: jointBalance });

      day = addDays(day, 1);
    }

    return balances;
  };

  const nextMonthBalances = calculateNextMonthBalances();

  const getEndBalance = (day: Date, account: 'personal' | 'joint') => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const balances = runningBalances.get(dateKey);
    if (!balances) {
      // Use the appropriate starting balance
      if (isAfterStartMonth) {
        return account === 'personal' ? previousMonthEndingBalances.personal : previousMonthEndingBalances.joint;
      }
      return account === 'personal' ? personalStartingBalance : jointStartingBalance;
    }
    return account === 'personal' ? balances.personal : balances.joint;
  };

  const hasBalanceChanged = (day: Date, account: 'personal' | 'joint') => {
    const prevDay = addDays(day, -1);
    const currentBalance = getEndBalance(day, account);

    // For the first day of the month, compare with starting balance
    if (!isSameMonth(prevDay, currentMonth)) {
      const startingBalance = account === 'personal' ? personalStartingBalance : jointStartingBalance;
      return currentBalance !== startingBalance;
    }

    const prevBalance = getEndBalance(prevDay, account);
    return currentBalance !== prevBalance;
  };

  const handleCellClick = (date: Date, field: AccountField) => {
    console.log('handleCellClick:', { date: format(date, 'yyyy-MM-dd'), field, isSameMonth: isSameMonth(date, currentMonth) });
    if (!isSameMonth(date, currentMonth)) return;

    // Determine account from field
    const account: 'personal' | 'joint' = field.startsWith('personal') ? 'personal' : 'joint';

    // Determine which input to focus
    const focusField: 'deposit' | 'withdrawal' = field.includes('checking') ? 'deposit' : 'withdrawal';

    // Open modal instead of inline editing
    openModal(date, account, focusField);
  };

  const handleAddNew = (dateKey: string, field: AccountField) => {
    setShowingEntries(null);
    setEditingCell({ dateKey, field });
    setTempValue('');
  };

  const saveEntry = async (cell: { dateKey: string; field: AccountField }, value: string) => {
    console.log('saveEntry called with:', { cell, value, monthlyExpenses, creditCards });
    setInputError(null);

    const allLines = [...PERSONAL_LINES, ...JOINT_LINES];
    const accountLine = allLines.find(a => a.field === cell.field);

    if (!accountLine) {
      console.log('No account line found for field:', cell.field);
      return;
    }

    // Parse the dateKey first so we can pass it to the lookup
    // cell.dateKey is in format 'yyyy-MM-dd'
    const [year, month, day] = cell.dateKey.split('-').map(Number);
    const entryDate = new Date(year, month - 1, day, 12, 0, 0); // noon to avoid any timezone edge cases

    let amount: number;
    let description: string = accountLine.label;
    let linkedTo: string | undefined;

    // First, try to parse as a number
    const numericValue = parseFloat(value);

    if (!isNaN(numericValue) && numericValue !== 0) {
      // It's a valid number
      amount = Math.abs(numericValue);
      console.log('Parsed as number:', amount);
    } else {
      // Try to look up as an expense/credit card name (async to support month parsing)
      console.log('Trying to lookup by name:', value);
      console.log('Available expenses:', monthlyExpenses.map(e => e.name));
      console.log('Available cards:', creditCards.map(c => c.name));
      console.log('Card history:', creditCardHistory.map(h => ({ name: h.cardName, actual: h.actual, joint: h.joint })));
      const lookupResult = await lookupExpenseByNameAsync(value, entryDate);
      console.log('Lookup result:', lookupResult);
      if (lookupResult) {
        amount = lookupResult.amount;
        description = lookupResult.description;
        linkedTo = lookupResult.linkedTo;
      } else {
        // Invalid input - neither a number nor a known expense/card name
        console.log('Invalid input - not a number or known expense/card');
        setInputError(`"${value}" not found. Use a number, expense name, or credit card name.`);
        setTimeout(() => setInputError(null), 3000);
        return;
      }
    }

    const newEntry: Omit<BudgetEntry, '_id'> = {
      date: entryDate,
      category: cell.field,
      description,
      amount,
      type: accountLine.type,
      linkedTo,
    };

    console.log('Creating entry:', newEntry);
    console.log('Entry date:', entryDate.toString(), 'dateKey:', cell.dateKey);

    try {
      const result = await budgetAPI.createEntry(newEntry);
      console.log('Entry created successfully:', result);
      console.log('Calling onEntryUpdate to refresh entries...');
      onEntryUpdate();
    } catch (error) {
      console.error('Failed to create entry:', error);
    }
  };

  const handleCellBlur = () => {
    console.log('handleCellBlur called:', { editingCell, tempValue });
    const currentCell = editingCell;
    const currentValue = tempValue;

    setEditingCell(null);
    setTempValue('');

    if (currentCell && currentValue) {
      console.log('Calling saveEntry with:', { currentCell, currentValue });
      saveEntry(currentCell, currentValue);
    } else {
      console.log('Not calling saveEntry - missing cell or value');
    }
  };

  const handleBalanceClick = (type: 'personal' | 'joint') => {
    setEditingBalance(type);
    setTempValue(type === 'personal' ? personalStartingBalance.toString() : jointStartingBalance.toString());
  };

  const handleBalanceBlur = async () => {
    const currentType = editingBalance;
    const currentValue = tempValue;

    setEditingBalance(null);
    setTempValue('');

    if (currentType && currentValue) {
      const amount = parseFloat(currentValue);
      if (!isNaN(amount)) {
        const newPersonal = currentType === 'personal' ? amount : personalStartingBalance;
        const newJoint = currentType === 'joint' ? amount : jointStartingBalance;

        try {
          await balancesAPI.updateStartingBalances(newPersonal, newJoint);
          onStartingBalancesUpdate(newPersonal, newJoint);
        } catch (error) {
          console.error('Failed to update starting balance:', error);
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editingBalance) {
        handleBalanceBlur();
      } else if (editingRecurringDeposit !== null) {
        handleRecurringDepositSave();
      } else {
        handleCellBlur();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingCell(null);
      setEditingBalance(null);
      setEditingRecurringDeposit(null);
      setTempValue('');
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount === 0) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="relative overflow-hidden rounded-xl glass-panel p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-display font-bold mb-2 glow-text">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <p className="text-sm text-gray-400 font-mono">
          Click any cell to edit deposits and withdrawals
        </p>
        {inputError && (
          <div className="mt-2 p-2 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm font-mono">
            {inputError}
          </div>
        )}
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center py-2 text-sm font-bold text-blue-400 font-mono"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isNextMonthDay = isNextMonth(day);
            const isTodayDate = isToday(day);
            const isHovered = hoveredDate && isSameDay(hoveredDate, day);
            const dayKey = format(day, 'yyyy-MM-dd');
            const isEditing = editingCell && editingCell.dateKey === dayKey;
            const isShowingEntries = showingEntries && showingEntries.dateKey === dayKey;
            const isLastDayPrevMonth = isSameDay(day, lastDayOfPrevMonth);
            const dayNum = day.getDate();
            const hasOverflowData = (() => {
              if (isNextMonthDay) {
                const bal = nextMonthBalances.get(dayKey);
                if (!bal) return false;
                const prevDay = addDays(day, -1);
                const prevDayKey = format(prevDay, 'yyyy-MM-dd');
                const prevBal = isSameMonth(prevDay, currentMonth)
                  ? runningBalances.get(prevDayKey)
                  : nextMonthBalances.get(prevDayKey);
                if (!prevBal) return true;
                return bal.personal !== prevBal.personal || bal.joint !== prevBal.joint;
              }
              return false;
            })();

            return (
              <div
                key={dayKey}
                className={`
                  relative min-h-[160px] p-2 rounded-lg border transition-all duration-200
                  ${isCurrentMonth
                    ? 'bg-gray-800/40 border-gray-700/50 hover:bg-blue-500/10 hover:border-blue-500/30'
                    : 'bg-gray-900/20 border-gray-800/30 cursor-pointer hover:bg-gray-800/30 hover:border-gray-600/50'}
                  ${isTodayDate ? 'ring-2 ring-blue-500/50 border-blue-500/50' : ''}
                  ${isHovered && isCurrentMonth ? 'bg-blue-500/10 border-blue-500/30' : ''}
                  ${isLastDayPrevMonth && (isStartMonth || isAfterStartMonth) ? 'opacity-100 bg-gray-800/30' : hasOverflowData ? 'opacity-70 bg-gray-800/20' : !isCurrentMonth ? 'opacity-40' : ''}
                `}
                onMouseEnter={() => setHoveredDate(day)}
                onMouseLeave={() => setHoveredDate(null)}
                onClick={() => {
                  setShowingEntries(null);
                  if (!isCurrentMonth && onMonthChange) {
                    onMonthChange(startOfMonth(day));
                  }
                }}
              >
                {/* Day Number */}
                <div className={`
                  text-sm font-bold mb-1
                  ${isTodayDate ? 'text-blue-400' : isCurrentMonth ? 'text-gray-300' : 'text-gray-500'}
                `}>
                  {format(day, 'd')}
                </div>

                {/* Show starting balances on last day of previous month - only for start month (editable) */}
                {isLastDayPrevMonth && isStartMonth && (
                  <div className="grid grid-cols-2 gap-1">
                    {/* Personal Starting Balance */}
                    <div className="border-r border-gray-700/30 pr-1">
                      <div className="text-[10px] text-gray-500 font-mono mb-0.5">Personal</div>
                      <div
                        className="text-xs cursor-pointer hover:bg-purple-500/20 rounded px-1 py-0.5 transition-colors"
                        onClick={() => handleBalanceClick('personal')}
                      >
                        {editingBalance === 'personal' ? (
                          <input
                            type="number"
                            step="0.01"
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            onBlur={handleBalanceBlur}
                            onKeyDown={handleKeyDown}
                            className="w-full bg-transparent text-purple-400 outline-none border-b border-purple-400 text-xs"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className="text-purple-400 font-semibold">
                            {formatCurrency(personalStartingBalance)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Joint Starting Balance */}
                    <div className="pl-1">
                      <div className="text-[10px] text-gray-500 font-mono mb-0.5">Joint</div>
                      <div
                        className="text-xs cursor-pointer hover:bg-cyan-500/20 rounded px-1 py-0.5 transition-colors"
                        onClick={() => handleBalanceClick('joint')}
                      >
                        {editingBalance === 'joint' ? (
                          <input
                            type="number"
                            step="0.01"
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            onBlur={handleBalanceBlur}
                            onKeyDown={handleKeyDown}
                            className="w-full bg-transparent text-cyan-400 outline-none border-b border-cyan-400 text-xs"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className="text-cyan-400 font-semibold">
                            {formatCurrency(jointStartingBalance)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Show previous month's ending balances for months after start month (read-only) */}
                {isLastDayPrevMonth && isAfterStartMonth && (
                  <div className="grid grid-cols-2 gap-1">
                    {/* Personal Ending Balance */}
                    <div className="border-r border-gray-700/30 pr-1">
                      <div className="text-[10px] text-gray-500 font-mono mb-0.5">Personal</div>
                      <div className="text-xs px-1 py-0.5">
                        <span className={`font-semibold ${previousMonthEndingBalances.personal >= 0 ? 'text-purple-400' : 'text-red-400'}`}>
                          {formatCurrency(previousMonthEndingBalances.personal)}
                        </span>
                      </div>
                    </div>

                    {/* Joint Ending Balance */}
                    <div className="pl-1">
                      <div className="text-[10px] text-gray-500 font-mono mb-0.5">Joint</div>
                      <div className="text-xs px-1 py-0.5">
                        <span className={`font-semibold ${previousMonthEndingBalances.joint >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                          {formatCurrency(previousMonthEndingBalances.joint)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {isCurrentMonth && (
                  <div className="grid grid-cols-2 gap-1">
                    {/* Personal Column */}
                    <div className="border-r border-gray-700/30 pr-1">
                      <div className="text-[10px] text-gray-500 font-mono mb-0.5">Personal</div>

                      {/* Deposits Section */}
                      <div
                        className="text-xs cursor-pointer hover:bg-green-500/20 rounded px-1 py-0.5 transition-colors mb-0.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCellClick(day, 'personal-checking');
                        }}
                      >
                        {(() => {
                          const deposits = getEntriesForField(day, 'personal-checking');
                          const recurringDeps = getRecurringDepositsForDay(day, 'personal');
                          const isEditingDeposits = isEditing && editingCell?.field === 'personal-checking';
                          const isShowingDeposits = isShowingEntries && showingEntries?.field === 'personal-checking';

                          if (isShowingDeposits) {
                            return (
                              <div className="space-y-0.5" onClick={(e) => e.stopPropagation()}>
                                {recurringDeps.map((dep, idx) => {
                                  const depIndex = findRecurringDepositIndex(dep);
                                  const isEditingThis = editingRecurringDeposit === depIndex;
                                  return (
                                    <div
                                      key={`rec-${idx}`}
                                      className="flex items-center justify-between cursor-pointer hover:bg-green-500/30 rounded px-1 -mx-1"
                                      onClick={() => !isEditingThis && handleRecurringDepositEdit(dep)}
                                    >
                                      {isEditingThis ? (
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={tempValue}
                                          onChange={(e) => setTempValue(e.target.value)}
                                          onBlur={handleRecurringDepositSave}
                                          onKeyDown={handleKeyDown}
                                          className="w-full bg-transparent text-green-400 outline-none border-b border-green-400 text-xs"
                                          autoFocus
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      ) : (
                                        <>
                                          <span className="text-green-400">+{formatCurrency(getDepositAmountForDate(dep, day))}</span>
                                          <span className="text-[8px] text-gray-500">{dep.name}</span>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleSkipRecurringDeposit(dep, dayKey);
                                            }}
                                            className="text-red-400 hover:text-red-300 text-[10px] ml-1"
                                            title="Skip this date"
                                          >
                                            ✕
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                                {deposits.map((entry) => (
                                  <div key={entry._id} className="flex items-center justify-between">
                                    <span className="text-green-400">+{formatCurrency(getLinkedAmount(entry))}</span>
                                    <button onClick={() => entry._id && deleteEntry(entry._id)} className="text-red-400 hover:text-red-300 text-[10px]">✕</button>
                                  </div>
                                ))}
                                <button onClick={() => handleAddNew(dayKey, 'personal-checking')} className="text-gray-500 hover:text-green-400 text-[10px]">+ Add</button>
                              </div>
                            );
                          }
                          if (isEditingDeposits) {
                            return (
                              <input
                                type="text"
                                value={tempValue}
                                onChange={(e) => setTempValue(e.target.value)}
                                onBlur={handleCellBlur}
                                onKeyDown={handleKeyDown}
                                className="w-full bg-transparent text-green-400 outline-none border-b border-green-400 text-xs"
                                autoFocus
                                placeholder="Amount or name"
                                onClick={(e) => e.stopPropagation()}
                              />
                            );
                          }
                          const total = deposits.reduce((s, e) => s + getLinkedAmount(e), 0) + recurringDeps.reduce((s, d) => s + getDepositAmountForDate(d, day), 0);
                          return <span className={total > 0 ? 'text-green-400' : 'text-gray-600'}>{total > 0 ? `+${formatCurrency(total)}` : '+ deposits'}</span>;
                        })()}
                      </div>

                      {/* Withdrawals Section */}
                      <div
                        className="text-xs cursor-pointer hover:bg-red-500/20 rounded px-1 py-0.5 transition-colors mb-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('Withdrawal click for day:', dayNum, dayKey);
                          handleCellClick(day, 'personal-deduction');
                        }}
                      >
                        {(() => {
                          const withdrawals = getEntriesForField(day, 'personal-deduction');
                          const isEditingWithdrawals = isEditing && editingCell?.field === 'personal-deduction';
                          const isShowingWithdrawals = isShowingEntries && showingEntries?.field === 'personal-deduction';

                          if (isShowingWithdrawals) {
                            return (
                              <div className="space-y-0.5" onClick={(e) => e.stopPropagation()}>
                                {withdrawals.map((entry) => (
                                  <div key={entry._id} className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                      <span className="text-red-400">-{formatCurrency(getLinkedAmount(entry))}</span>
                                      {entry.description && entry.description !== '−' && (
                                        <span className="text-[8px] text-gray-500">{entry.description}</span>
                                      )}
                                    </div>
                                    <button onClick={() => entry._id && deleteEntry(entry._id)} className="text-red-400 hover:text-red-300 text-[10px]">✕</button>
                                  </div>
                                ))}
                                <button onClick={() => handleAddNew(dayKey, 'personal-deduction')} className="text-gray-500 hover:text-red-400 text-[10px]">+ Add</button>
                              </div>
                            );
                          }
                          if (isEditingWithdrawals) {
                            return (
                              <input
                                type="text"
                                value={tempValue}
                                onChange={(e) => setTempValue(e.target.value)}
                                onBlur={handleCellBlur}
                                onKeyDown={handleKeyDown}
                                className="w-full bg-transparent text-red-400 outline-none border-b border-red-400 text-xs"
                                autoFocus
                                placeholder="Amount or name"
                                onClick={(e) => e.stopPropagation()}
                              />
                            );
                          }
                          const total = withdrawals.reduce((s, e) => s + getLinkedAmount(e), 0);
                          return <span className={total > 0 ? 'text-red-400' : 'text-gray-600'}>{total > 0 ? `-${formatCurrency(total)}` : '− withdrawals'}</span>;
                        })()}
                      </div>

                      {/* Balance - only show if changed from previous day */}
                      {hasBalanceChanged(day, 'personal') && (
                        <div className="pt-1 border-t border-gray-700/50">
                          <div className={`text-xs font-bold ${getEndBalance(day, 'personal') >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            = {formatCurrency(getEndBalance(day, 'personal'))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Joint Column */}
                    <div className="pl-1">
                      <div className="text-[10px] text-gray-500 font-mono mb-0.5">Joint</div>

                      {/* Deposits Section */}
                      <div
                        className="text-xs cursor-pointer hover:bg-blue-500/20 rounded px-1 py-0.5 transition-colors mb-0.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCellClick(day, 'joint-checking');
                        }}
                      >
                        {(() => {
                          const deposits = getEntriesForField(day, 'joint-checking');
                          const recurringDeps = getRecurringDepositsForDay(day, 'joint');
                          const isEditingDeposits = isEditing && editingCell?.field === 'joint-checking';
                          const isShowingDeposits = isShowingEntries && showingEntries?.field === 'joint-checking';

                          if (isShowingDeposits) {
                            return (
                              <div className="space-y-0.5" onClick={(e) => e.stopPropagation()}>
                                {recurringDeps.map((dep, idx) => {
                                  const depIndex = findRecurringDepositIndex(dep);
                                  const isEditingThis = editingRecurringDeposit === depIndex;
                                  return (
                                    <div
                                      key={`rec-${idx}`}
                                      className="flex items-center justify-between cursor-pointer hover:bg-blue-500/30 rounded px-1 -mx-1"
                                      onClick={() => !isEditingThis && handleRecurringDepositEdit(dep)}
                                    >
                                      {isEditingThis ? (
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={tempValue}
                                          onChange={(e) => setTempValue(e.target.value)}
                                          onBlur={handleRecurringDepositSave}
                                          onKeyDown={handleKeyDown}
                                          className="w-full bg-transparent text-blue-400 outline-none border-b border-blue-400 text-xs"
                                          autoFocus
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      ) : (
                                        <>
                                          <span className="text-blue-400">+{formatCurrency(getDepositAmountForDate(dep, day))}</span>
                                          <span className="text-[8px] text-gray-500">{dep.name}</span>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleSkipRecurringDeposit(dep, dayKey);
                                            }}
                                            className="text-red-400 hover:text-red-300 text-[10px] ml-1"
                                            title="Skip this date"
                                          >
                                            ✕
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                                {deposits.map((entry) => (
                                  <div key={entry._id} className="flex items-center justify-between">
                                    <span className="text-blue-400">+{formatCurrency(getLinkedAmount(entry))}</span>
                                    <button onClick={() => entry._id && deleteEntry(entry._id)} className="text-red-400 hover:text-red-300 text-[10px]">✕</button>
                                  </div>
                                ))}
                                <button onClick={() => handleAddNew(dayKey, 'joint-checking')} className="text-gray-500 hover:text-blue-400 text-[10px]">+ Add</button>
                              </div>
                            );
                          }
                          if (isEditingDeposits) {
                            return (
                              <input
                                type="text"
                                value={tempValue}
                                onChange={(e) => setTempValue(e.target.value)}
                                onBlur={handleCellBlur}
                                onKeyDown={handleKeyDown}
                                className="w-full bg-transparent text-blue-400 outline-none border-b border-blue-400 text-xs"
                                autoFocus
                                placeholder="Amount or name"
                                onClick={(e) => e.stopPropagation()}
                              />
                            );
                          }
                          const total = deposits.reduce((s, e) => s + getLinkedAmount(e), 0) + recurringDeps.reduce((s, d) => s + getDepositAmountForDate(d, day), 0);
                          return <span className={total > 0 ? 'text-blue-400' : 'text-gray-600'}>{total > 0 ? `+${formatCurrency(total)}` : '+ deposits'}</span>;
                        })()}
                      </div>

                      {/* Withdrawals Section */}
                      <div
                        className="text-xs cursor-pointer hover:bg-orange-500/20 rounded px-1 py-0.5 transition-colors mb-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCellClick(day, 'joint-deduction');
                        }}
                      >
                        {(() => {
                          const withdrawals = getEntriesForField(day, 'joint-deduction');
                          const isEditingWithdrawals = isEditing && editingCell?.field === 'joint-deduction';
                          const isShowingWithdrawals = isShowingEntries && showingEntries?.field === 'joint-deduction';

                          if (isShowingWithdrawals) {
                            return (
                              <div className="space-y-0.5" onClick={(e) => e.stopPropagation()}>
                                {withdrawals.map((entry) => (
                                  <div key={entry._id} className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                      <span className="text-orange-400">-{formatCurrency(getLinkedAmount(entry))}</span>
                                      {entry.description && entry.description !== '−' && (
                                        <span className="text-[8px] text-gray-500">{entry.description}</span>
                                      )}
                                    </div>
                                    <button onClick={() => entry._id && deleteEntry(entry._id)} className="text-red-400 hover:text-red-300 text-[10px]">✕</button>
                                  </div>
                                ))}
                                <button onClick={() => handleAddNew(dayKey, 'joint-deduction')} className="text-gray-500 hover:text-orange-400 text-[10px]">+ Add</button>
                              </div>
                            );
                          }
                          if (isEditingWithdrawals) {
                            return (
                              <input
                                type="text"
                                value={tempValue}
                                onChange={(e) => setTempValue(e.target.value)}
                                onBlur={handleCellBlur}
                                onKeyDown={handleKeyDown}
                                className="w-full bg-transparent text-orange-400 outline-none border-b border-orange-400 text-xs"
                                autoFocus
                                placeholder="Amount or name"
                                onClick={(e) => e.stopPropagation()}
                              />
                            );
                          }
                          const total = withdrawals.reduce((s, e) => s + getLinkedAmount(e), 0);
                          return <span className={total > 0 ? 'text-orange-400' : 'text-gray-600'}>{total > 0 ? `-${formatCurrency(total)}` : '− withdrawals'}</span>;
                        })()}
                      </div>

                      {/* Balance - only show if changed from previous day */}
                      {hasBalanceChanged(day, 'joint') && (
                        <div className="pt-1 border-t border-gray-700/50">
                          <div className={`text-xs font-bold ${getEndBalance(day, 'joint') >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                            = {formatCurrency(getEndBalance(day, 'joint'))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Next Month overflow days - show ending balances only */}
                {isNextMonthDay && (() => {
                  const dayBalance = nextMonthBalances.get(dayKey);
                  if (!dayBalance) return null;

                  const prevDay = addDays(day, -1);
                  const prevDayKey = format(prevDay, 'yyyy-MM-dd');
                  let prevBalance: { personal: number; joint: number };
                  if (isSameMonth(prevDay, currentMonth)) {
                    const prevRunning = runningBalances.get(prevDayKey);
                    prevBalance = prevRunning || { personal: personalStartingBalance, joint: jointStartingBalance };
                  } else {
                    const prevNext = nextMonthBalances.get(prevDayKey);
                    prevBalance = prevNext || { personal: 0, joint: 0 };
                  }

                  const personalChanged = dayBalance.personal !== prevBalance.personal;
                  const jointChanged = dayBalance.joint !== prevBalance.joint;

                  if (!personalChanged && !jointChanged) return null;

                  return (
                    <div className="grid grid-cols-2 gap-1">
                      <div className="border-r border-gray-700/30 pr-1">
                        <div className="text-[10px] text-gray-500 font-mono mb-0.5">Personal</div>
                        {personalChanged && (
                          <div className="pt-1 border-t border-gray-700/50">
                            <div className={`text-xs font-bold px-1 ${dayBalance.personal >= 0 ? 'text-purple-400/70' : 'text-red-400/70'}`}>
                              = {formatCurrency(dayBalance.personal)}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="pl-1">
                        <div className="text-[10px] text-gray-500 font-mono mb-0.5">Joint</div>
                        {jointChanged && (
                          <div className="pt-1 border-t border-gray-700/50">
                            <div className={`text-xs font-bold px-1 ${dayBalance.joint >= 0 ? 'text-cyan-400/70' : 'text-red-400/70'}`}>
                              = {formatCurrency(dayBalance.joint)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
      </div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 grid-pattern opacity-10 pointer-events-none rounded-xl"></div>

      {/* Day Edit Modal */}
      {modalOpen && (
        <DayEditModal
          isOpen={!!modalOpen}
          onClose={closeModal}
          date={modalOpen.date}
          account={modalOpen.account}
          focusField={modalOpen.focusField}
          entries={getEntriesForDay(modalOpen.date)}
          recurringDeposits={getRecurringDepositsForDay(modalOpen.date, modalOpen.account)}
          onAddEntry={handleModalAddEntry}
          onDeleteEntry={handleModalDeleteEntry}
          onSkipRecurringDeposit={handleModalSkipRecurringDeposit}
          onEditRecurringDeposit={handleModalEditRecurringDeposit}
          getLinkedAmount={getLinkedAmount}
          formatCurrency={formatCurrency}
          creditCards={creditCards}
          monthlyExpenses={monthlyExpenses}
        />
      )}
    </div>
  );
}
