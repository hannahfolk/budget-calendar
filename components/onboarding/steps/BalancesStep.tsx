'use client';

import { useState, useEffect } from 'react';

interface BalancesStepProps {
  personalBalance: number;
  jointBalance: number;
  onUpdate: (personal: number, joint: number) => void;
}

export default function BalancesStep({ personalBalance, jointBalance, onUpdate }: BalancesStepProps) {
  const [personal, setPersonal] = useState(personalBalance.toString());
  const [joint, setJoint] = useState(jointBalance.toString());

  useEffect(() => {
    const personalNum = parseFloat(personal) || 0;
    const jointNum = parseFloat(joint) || 0;
    onUpdate(personalNum, jointNum);
  }, [personal, joint, onUpdate]);

  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return num.toFixed(2);
  };

  return (
    <div>
      <h2 className="text-2xl font-display font-bold mb-2">Account Balances</h2>
      <p className="text-gray-400 font-mono text-sm mb-8">
        Enter your ending balances from the previous month. These will be your starting point.
      </p>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-mono text-gray-300 mb-2">
            Personal Account Ending Balance
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-mono">$</span>
            <input
              type="number"
              step="0.01"
              value={personal}
              onChange={(e) => setPersonal(e.target.value)}
              onBlur={() => setPersonal(formatCurrency(personal))}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-8 pr-4 py-3 text-white font-mono text-lg focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="0.00"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500 font-mono">
            Your individual checking/savings account
          </p>
        </div>

        <div>
          <label className="block text-sm font-mono text-gray-300 mb-2">
            Joint Account Ending Balance
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-mono">$</span>
            <input
              type="number"
              step="0.01"
              value={joint}
              onChange={(e) => setJoint(e.target.value)}
              onBlur={() => setJoint(formatCurrency(joint))}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-8 pr-4 py-3 text-white font-mono text-lg focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="0.00"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500 font-mono">
            Shared account with your partner (if applicable)
          </p>
        </div>
      </div>

      <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-blue-300 font-mono text-sm">
          These balances represent where you left off at the end of last month.
          Your budget calendar will calculate forward from here.
        </p>
      </div>
    </div>
  );
}
