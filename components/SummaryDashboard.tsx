'use client';

import { motion } from 'framer-motion';
import { SummaryStats } from '@/lib/api';

interface Props {
  stats: SummaryStats | null;
}

export default function SummaryDashboard({ stats }: Props) {
  if (!stats) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const savingsRate = stats.totalIncome > 0 
    ? ((stats.balance / stats.totalIncome) * 100).toFixed(1) 
    : '0';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {/* Income Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-panel rounded-xl p-6 relative overflow-hidden group hover:scale-105 transition-transform duration-300"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl group-hover:bg-green-500/20 transition-colors"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-mono text-gray-400 uppercase tracking-wider">Total Income</h3>
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
            </div>
          </div>
          <div className="text-4xl font-display font-bold text-green-400 mb-2">
            {formatCurrency(stats.totalIncome)}
          </div>
          <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 1, delay: 0.3 }}
              className="h-full bg-gradient-to-r from-green-500 to-emerald-400 animate-pulse-glow"
            ></motion.div>
          </div>
        </div>
      </motion.div>

      {/* Expenses Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-panel rounded-xl p-6 relative overflow-hidden group hover:scale-105 transition-transform duration-300"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl group-hover:bg-red-500/20 transition-colors"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-mono text-gray-400 uppercase tracking-wider">Total Expenses</h3>
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
              </svg>
            </div>
          </div>
          <div className="text-4xl font-display font-bold text-red-400 mb-2">
            {formatCurrency(stats.totalExpenses)}
          </div>
          <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: stats.totalIncome > 0 ? `${(stats.totalExpenses / stats.totalIncome) * 100}%` : '0%' }}
              transition={{ duration: 1, delay: 0.3 }}
              className="h-full bg-gradient-to-r from-red-500 to-orange-400 animate-pulse-glow"
            ></motion.div>
          </div>
        </div>
      </motion.div>

      {/* Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-panel rounded-xl p-6 relative overflow-hidden group hover:scale-105 transition-transform duration-300"
      >
        <div className={`absolute top-0 right-0 w-32 h-32 ${stats.balance >= 0 ? 'bg-yellow-500/10' : 'bg-orange-500/10'} rounded-full blur-3xl group-hover:opacity-100 transition-opacity`}></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-mono text-gray-400 uppercase tracking-wider">Net Balance</h3>
            <div className={`w-10 h-10 rounded-full ${stats.balance >= 0 ? 'bg-yellow-500/20' : 'bg-orange-500/20'} flex items-center justify-center`}>
              <svg className={`w-5 h-5 ${stats.balance >= 0 ? 'text-yellow-400' : 'text-orange-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className={`text-4xl font-display font-bold mb-2 ${stats.balance >= 0 ? 'text-yellow-400' : 'text-orange-400'}`}>
            {formatCurrency(stats.balance)}
          </div>
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-gray-500">Savings Rate</span>
            <span className={`font-bold ${parseFloat(savingsRate) >= 20 ? 'text-green-400' : parseFloat(savingsRate) >= 10 ? 'text-yellow-400' : 'text-orange-400'}`}>
              {savingsRate}%
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
