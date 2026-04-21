'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface MonthlyExpense {
  name: string;
  amount: number;
  account: 'personal' | 'joint';
}

interface RecurringDeposit {
  name: string;
  amount: number;
  account: 'personal' | 'joint';
  frequency: 'weekly' | 'biweekly' | 'monthly';
  startDate: string;
  skippedDates?: string[];
}

interface CreditCard {
  name: string;
  projected: number;
  actual: number;
  jointProjected: number;
  jointActual: number;
  closingDay: number;
  account?: 'personal' | 'joint';
  addedBy?: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  monthlyExpenses: MonthlyExpense[];
  partnerJointExpenses?: MonthlyExpense[];
  recurringDeposits: RecurringDeposit[];
  creditCards: CreditCard[]; // Joint credit card budgets
  personalCreditCards: CreditCard[]; // Personal credit card budgets
  personalStartingBalance: number;
  jointStartingBalance: number;
  onboardingCompleted: boolean;
  partnerId?: string;
  partnerName?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  updateExpenses: (expenses: MonthlyExpense[]) => void;
  updateStartingBalances: (personal: number, joint: number) => void;
  updateRecurringDeposits: (deposits: RecurringDeposit[]) => void;
  updateCreditCards: (cards: CreditCard[]) => void;
  updatePersonalCreditCards: (cards: CreditCard[]) => void;
  setUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on mount
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      fetchUser(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async (authToken: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        // Token invalid, clear it
        localStorage.removeItem('token');
        setToken(null);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      localStorage.removeItem('token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Registration failed');
    }

    const data = await response.json();
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const updateExpenses = (expenses: MonthlyExpense[]) => {
    if (user) {
      setUser({ ...user, monthlyExpenses: expenses });
    }
  };

  const updateStartingBalances = (personal: number, joint: number) => {
    if (user) {
      setUser({
        ...user,
        personalStartingBalance: personal,
        jointStartingBalance: joint,
      });
    }
  };

  const updateRecurringDeposits = (deposits: RecurringDeposit[]) => {
    if (user) {
      setUser({ ...user, recurringDeposits: deposits });
    }
  };

  const updateCreditCards = (cards: CreditCard[]) => {
    if (user) {
      setUser({ ...user, creditCards: cards });
    }
  };

  const updatePersonalCreditCards = (cards: CreditCard[]) => {
    if (user) {
      setUser({ ...user, personalCreditCards: cards });
    }
  };

  const setUserData = (userData: User) => {
    setUser(userData);
  };

  const refreshUser = async () => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      await fetchUser(storedToken);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout, updateExpenses, updateStartingBalances, updateRecurringDeposits, updateCreditCards, updatePersonalCreditCards, setUser: setUserData, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
