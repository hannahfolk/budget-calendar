'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { addMonths, subMonths, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';
import { budgetAPI, BudgetEntry, MonthlyExpense, RecurringDeposit, CreditCard, depositsAPI, partnerAPI, Partner } from '@/lib/api';
import BudgetSpreadsheet from '@/components/BudgetSpreadsheet';
import ExpensesSidebar from '@/components/ExpensesSidebar';
import PreviousMonthSidebar from '@/components/PreviousMonthSidebar';
import { useAuth } from '@/components/AuthProvider';
import { motion } from 'framer-motion';

export default function Home() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [previousMonthEntries, setPreviousMonthEntries] = useState<BudgetEntry[]>([]);
  const [nextMonthEntries, setNextMonthEntries] = useState<BudgetEntry[]>([]);
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [partnerJointExpenses, setPartnerJointExpenses] = useState<MonthlyExpense[]>([]);
  const [recurringDeposits, setRecurringDeposits] = useState<RecurringDeposit[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [personalCreditCards, setPersonalCreditCards] = useState<CreditCard[]>([]);
  const [partnerCreditCards, setPartnerCreditCards] = useState<CreditCard[]>([]);
  const [partnerJointCardNames, setPartnerJointCardNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnce = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [depositSaveError, setDepositSaveError] = useState<string | null>(null);
  // Bumped whenever the sidebar writes to credit-card history. The calendar
  // watches this so its own historyCache refetches and stays in sync.
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const bumpHistoryRefresh = () => setHistoryRefreshKey((k) => k + 1);

  const { user, loading: authLoading, updateExpenses, updateStartingBalances, updateRecurringDeposits, updateCreditCards, updatePersonalCreditCards } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated, or to onboarding if not completed
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (!user.onboardingCompleted) {
        router.push('/onboarding');
      }
    }
  }, [user, authLoading, router]);

  // Set data from user
  useEffect(() => {
    if (user) {
      setExpenses(user.monthlyExpenses);
      setPartnerJointExpenses(user.partnerJointExpenses || []);
      setRecurringDeposits(user.recurringDeposits || []);
      // Ensure backward compatibility - add default account if missing
      const cardsWithAccount = (user.creditCards || []).map(card => ({
        ...card,
        account: (card as any).account || 'joint',
      })) as CreditCard[];
      setCreditCards(cardsWithAccount);
      // Personal credit cards
      const personalCardsWithAccount = (user.personalCreditCards || []).map(card => ({
        ...card,
        account: (card as any).account || 'personal',
      })) as CreditCard[];
      setPersonalCreditCards(personalCardsWithAccount);

      // Joint cards where the partner is the canonical owner. Used by the
      // calendar/sidebar to fetch joint history from the partner's record
      // (single source of truth) rather than the user's own duplicate. Derive
      // from the merged creditCards (buildUserResponse stamps addedBy) so we
      // never pull from raw partner.creditCards, which would include duplicates
      // the user already canonically owns.
      const partnerOwnedJointCardNames = cardsWithAccount
        .filter(c => c.addedBy && c.addedBy === user.partnerId)
        .map(c => c.name);
      setPartnerJointCardNames(partnerOwnedJointCardNames);

      // Fetch partner's personal cards (for the "Partner's Personal Cards"
      // section). Joint cards are resolved above from the merged user payload.
      if (user.partnerId) {
        partnerAPI.getPartner().then(({ partner }) => {
          if (partner) {
            const partnerPersonalCards = partner.personalCreditCards || [];
            setPartnerCreditCards(partnerPersonalCards);
          }
        }).catch(err => {
          console.error('Failed to fetch partner data:', err);
        });
      }
    }
  }, [user]);

  // Fetches a target month's data and only commits it (together with
  // `currentMonth` itself) once the fetch resolves. This is what keeps
  // `currentMonth` and `entries`/`previousMonthEntries`/`nextMonthEntries`
  // always in sync for every render — the calendar previously updated
  // `currentMonth` immediately on navigation while the fetch for that month
  // was still in flight, so it would briefly compute balances by pairing the
  // NEW month's dates with the OLD month's entries: a flash of wrong numbers
  // on every month switch (and, via the credit-card-history load, on first
  // load too). Fetching first and swapping atomically makes that state
  // unrepresentable instead of trying to hide it with a loading flag.
  const latestRequestRef = useRef(0);

  const loadMonth = async (targetMonth: Date) => {
    if (!user) return;
    const requestId = ++latestRequestRef.current;

    try {
      if (!hasLoadedOnce.current) {
        setLoading(true);
      }
      setError(null);

      // Fetch current month, previous-chain, and next month entries in parallel
      // instead of one after another — three sequential round trips was adding
      // avoidable delay before the calendar's amounts could render.
      const currentStartDate = startOfMonth(targetMonth);
      const currentEndDate = endOfMonth(targetMonth);

      // Fetch all entries from user's start month through previous month
      // (needed to chain running balances correctly across months)
      const userStart = user.createdAt ? startOfMonth(new Date(user.createdAt)) : startOfMonth(targetMonth);
      const prevEndDate = endOfMonth(subMonths(targetMonth, 1));

      // Fetch next month entries (used only to tell whether next-month overflow
      // cells have any activity, for their dimming — no figures are displayed)
      const nextMonthDate = addMonths(targetMonth, 1);
      const nextStartDate = startOfMonth(nextMonthDate);
      const nextEndDate = endOfMonth(nextMonthDate);

      const [entriesData, prevEntriesData, nextEntriesData] = await Promise.all([
        budgetAPI.getEntries({
          startDate: currentStartDate.toISOString(),
          endDate: currentEndDate.toISOString(),
        }),
        budgetAPI.getEntries({
          startDate: userStart.toISOString(),
          endDate: prevEndDate.toISOString(),
        }),
        budgetAPI.getEntries({
          startDate: nextStartDate.toISOString(),
          endDate: nextEndDate.toISOString(),
        }),
      ]);

      // A newer navigation started while this one was in flight — its own
      // load will commit instead, so don't clobber it with a stale response.
      if (requestId !== latestRequestRef.current) return;

      setEntries(entriesData);
      setPreviousMonthEntries(prevEntriesData);
      setNextMonthEntries(nextEntriesData);
      setCurrentMonth(targetMonth);
    } catch (err) {
      if (requestId !== latestRequestRef.current) return;
      setError('Failed to load budget data. Make sure the backend server is running.');
      console.error('Error fetching data:', err);
    } finally {
      if (requestId === latestRequestRef.current) {
        setLoading(false);
        hasLoadedOnce.current = true;
      }
    }
  };

  // Initial load only — subsequent month changes go through loadMonth
  // directly (see navigation handlers below), which fetches before
  // committing `currentMonth` rather than reacting to it after the fact.
  useEffect(() => {
    if (user && !hasLoadedOnce.current) {
      loadMonth(currentMonth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Check if we can navigate to the previous month (not before user's start month)
  const canGoPreviousMonth = () => {
    if (!user?.createdAt) return true; // Allow if no createdAt (shouldn't happen)
    const userStartDate = new Date(user.createdAt);
    const userStartMonth = new Date(userStartDate.getFullYear(), userStartDate.getMonth(), 1);
    const currentMonthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    // Can go back if current month is after the user's start month
    return currentMonthStart > userStartMonth;
  };

  const handlePreviousMonth = () => {
    if (canGoPreviousMonth()) {
      loadMonth(subMonths(currentMonth, 1));
    }
  };

  const handleNextMonth = () => {
    loadMonth(addMonths(currentMonth, 1));
  };

  const handleToday = () => {
    loadMonth(new Date());
  };

  const handleExpensesUpdate = (updatedExpenses: MonthlyExpense[]) => {
    setExpenses(updatedExpenses);
    updateExpenses(updatedExpenses);
  };

  const handleDepositsUpdate = async (updatedDeposits: RecurringDeposit[]) => {
    // Keep the previous value so a failed save can be rolled back instead of
    // silently leaving the UI showing an edit that was never persisted.
    const previousDeposits = recurringDeposits;

    // Update local state immediately (optimistic)
    setRecurringDeposits(updatedDeposits);
    updateRecurringDeposits(updatedDeposits);
    setDepositSaveError(null);

    // Save to database
    try {
      await depositsAPI.updateDeposits(updatedDeposits);
    } catch (error) {
      console.error('Failed to save recurring deposits:', error);
      // Roll back the optimistic update so the UI doesn't claim a change
      // was saved when it wasn't, and surface it instead of failing silently.
      setRecurringDeposits(previousDeposits);
      updateRecurringDeposits(previousDeposits);
      setDepositSaveError('Failed to save deposit change — please try again.');
    }
  };

  const handleCreditCardsUpdate = (updatedCards: CreditCard[]) => {
    setCreditCards(updatedCards);
    updateCreditCards(updatedCards);
  };

  const handlePersonalCreditCardsUpdate = (updatedCards: CreditCard[]) => {
    setPersonalCreditCards(updatedCards);
    updatePersonalCreditCards(updatedCards);
  };

  const handleStartingBalancesUpdate = (personal: number, joint: number) => {
    updateStartingBalances(personal, joint);
  };

  // Show loading while checking auth
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

  // Don't render if not authenticated or onboarding not completed (will redirect)
  if (!user || !user.onboardingCompleted) {
    return null;
  }

  return (
    <main className="min-h-screen p-3 sm:p-5 lg:p-8">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 sm:mb-8"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold mb-1 glow-text">
              Budget Calendar
            </h1>
            <p className="text-sm font-mono text-gray-400">{user.name}</p>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={handlePreviousMonth}
              disabled={!canGoPreviousMonth()}
              className={`glass-panel px-4 py-2 rounded-lg transition-all duration-200 font-mono ${
                canGoPreviousMonth()
                  ? 'hover:bg-blue-500/20 cursor-pointer'
                  : 'opacity-40 cursor-not-allowed'
              }`}
            >
              ← Prev
            </button>

            <button
              onClick={handleToday}
              className="glass-panel px-6 py-2 rounded-lg hover:bg-blue-500/20 transition-all duration-200 font-mono font-bold"
            >
              Today
            </button>

            <button
              onClick={handleNextMonth}
              className="glass-panel px-4 py-2 rounded-lg hover:bg-blue-500/20 transition-all duration-200 font-mono"
            >
              Next →
            </button>
          </div>
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-400 animate-pulse' : 'bg-green-400'}`}></div>
          <span className="text-gray-500">
            {error ? 'Backend disconnected' : 'Connected'}
          </span>
        </div>
      </motion.header>

      {/* Deposit Save Error */}
      {depositSaveError && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between gap-4"
        >
          <p className="text-red-400 font-mono text-sm">{depositSaveError}</p>
          <button
            onClick={() => setDepositSaveError(null)}
            className="text-gray-400 hover:text-white text-sm shrink-0"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-lg"
        >
          <p className="text-red-400 font-mono text-sm">{error}</p>
          <p className="text-gray-400 font-mono text-xs mt-2">
            Run: <code className="bg-gray-800 px-2 py-1 rounded">npm run dev:all</code>
          </p>
        </motion.div>
      )}

      {/* Main Content */}
      {/* Phone: single column (calendar first). lg: calendar full-width with sidebars 2-up below. 2xl: classic 3-column. */}
      <div className="flex flex-col 2xl:flex-row 2xl:items-start gap-4 2xl:gap-6">
        {/* Calendar */}
        <div className="order-1 2xl:order-2 flex-1 min-w-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-400 font-mono">Loading budget data...</p>
              </div>
            </div>
          ) : (
            <BudgetSpreadsheet
              currentMonth={currentMonth}
              entries={entries}
              previousMonthEntries={previousMonthEntries}
              nextMonthEntries={nextMonthEntries}
              onEntryUpdate={() => loadMonth(currentMonth)}
              personalStartingBalance={user.personalStartingBalance ?? 0}
              jointStartingBalance={user.jointStartingBalance ?? 0}
              onStartingBalancesUpdate={handleStartingBalancesUpdate}
              recurringDeposits={recurringDeposits}
              onRecurringDepositUpdate={handleDepositsUpdate}
              monthlyExpenses={[...expenses, ...partnerJointExpenses]}
              creditCards={creditCards}
              userCreatedAt={user.createdAt}
              hasPartner={!!user.partnerId}
              partnerJointCardNames={partnerJointCardNames}
              historyRefreshKey={historyRefreshKey}
              onMonthChange={(newMonth) => {
                const currentStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
                const targetStart = new Date(newMonth.getFullYear(), newMonth.getMonth(), 1);
                if (targetStart < currentStart && !canGoPreviousMonth()) return;
                loadMonth(newMonth);
              }}
            />
          )}
        </div>

        {/* Sidebars: stacked on phones, 2-up on large screens, separate side columns at 2xl */}
        <div className="order-2 grid grid-cols-1 lg:grid-cols-2 gap-4 2xl:contents">
          {/* Left Sidebar - Previous Month Credit Cards */}
          <div className="2xl:order-1 2xl:w-80 2xl:shrink-0">
            <PreviousMonthSidebar
              currentMonth={currentMonth}
              creditCards={creditCards}
              personalCreditCards={personalCreditCards}
              partnerCreditCards={partnerCreditCards}
              onCreditCardsUpdate={handleCreditCardsUpdate}
              onPersonalCreditCardsUpdate={handlePersonalCreditCardsUpdate}
              onPartnerCreditCardsUpdate={setPartnerCreditCards}
              userCreatedAt={user.createdAt}
              userName={user.name}
              partnerName={user.partnerName}
              hasPartner={!!user.partnerId}
              partnerJointCardNames={partnerJointCardNames}
              userId={user.id}
              onHistoryUpdate={bumpHistoryRefresh}
            />
          </div>

          {/* Right Sidebar */}
          <div className="2xl:order-3 2xl:w-80 2xl:shrink-0">
            <ExpensesSidebar
              expenses={expenses}
              partnerJointExpenses={partnerJointExpenses}
              recurringDeposits={recurringDeposits}
              onExpensesUpdate={handleExpensesUpdate}
              onDepositsUpdate={handleDepositsUpdate}
              hasPartner={!!user.partnerId}
              partnerName={user.partnerName}
              onPartnerLinked={() => window.location.reload()}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 text-center text-gray-500 font-mono text-xs"
      >
        <p>Click cells to add entries • Press Enter to save • Press Escape to cancel</p>
      </motion.footer>
    </main>
  );
}
