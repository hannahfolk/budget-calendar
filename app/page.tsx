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

      // Fetch partner's credit cards if user has a partner
      // Partner's joint cards are already merged into user.creditCards via /api/auth/me
      // We fetch partner's personal cards separately for display
      if (user.partnerId) {
        partnerAPI.getPartner().then(({ partner }) => {
          if (partner) {
            const partnerPersonalCards = partner.personalCreditCards || [];
            setPartnerCreditCards(partnerPersonalCards);
            // Track partner's joint card names for "Partner's" tag
            setPartnerJointCardNames((partner.creditCards || []).map(c => c.name));
          }
        }).catch(err => {
          console.error('Failed to fetch partner data:', err);
        });
      }
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      if (!hasLoadedOnce.current) {
        setLoading(true);
      }
      setError(null);

      // Fetch current month entries
      const currentStartDate = startOfMonth(currentMonth);
      const currentEndDate = endOfMonth(currentMonth);

      const entriesData = await budgetAPI.getEntries({
        startDate: currentStartDate.toISOString(),
        endDate: currentEndDate.toISOString(),
      });
      setEntries(entriesData);

      // Fetch all entries from user's start month through previous month
      // (needed to chain running balances correctly across months)
      const userStart = user.createdAt ? startOfMonth(new Date(user.createdAt)) : startOfMonth(currentMonth);
      const prevEndDate = endOfMonth(subMonths(currentMonth, 1));

      const prevEntriesData = await budgetAPI.getEntries({
        startDate: userStart.toISOString(),
        endDate: prevEndDate.toISOString(),
      });
      setPreviousMonthEntries(prevEntriesData);

      // Fetch next month entries (for displaying preview on trailing days)
      const nextMonth = addMonths(currentMonth, 1);
      const nextStartDate = startOfMonth(nextMonth);
      const nextEndDate = endOfMonth(nextMonth);

      const nextEntriesData = await budgetAPI.getEntries({
        startDate: nextStartDate.toISOString(),
        endDate: nextEndDate.toISOString(),
      });
      setNextMonthEntries(nextEntriesData);
    } catch (err) {
      setError('Failed to load budget data. Make sure the backend server is running.');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
      hasLoadedOnce.current = true;
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [currentMonth, user]);

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
      setCurrentMonth(prev => subMonths(prev, 1));
    }
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
  };

  const handleExpensesUpdate = (updatedExpenses: MonthlyExpense[]) => {
    setExpenses(updatedExpenses);
    updateExpenses(updatedExpenses);
  };

  const handleDepositsUpdate = async (updatedDeposits: RecurringDeposit[]) => {
    console.log('=== handleDepositsUpdate ===');
    console.log('Updated deposits:', JSON.stringify(updatedDeposits, null, 2));

    // Update local state immediately
    setRecurringDeposits(updatedDeposits);
    updateRecurringDeposits(updatedDeposits);

    // Save to database
    try {
      console.log('Calling depositsAPI.updateDeposits...');
      const result = await depositsAPI.updateDeposits(updatedDeposits);
      console.log('API response:', JSON.stringify(result, null, 2));

      // Verify skippedDates were saved
      const skippedCheck = result.map(d => ({
        name: d.name,
        skippedDates: d.skippedDates || []
      }));
      console.log('Skipped dates in response:', JSON.stringify(skippedCheck, null, 2));
      console.log('=== End handleDepositsUpdate ===');
    } catch (error) {
      console.error('Failed to save recurring deposits:', error);
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
              onEntryUpdate={fetchData}
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
                setCurrentMonth(newMonth);
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
