const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Helper to get auth headers
const getAuthHeaders = (): HeadersInit => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export interface BudgetEntry {
  _id?: string;
  userId?: string;
  date: Date | string;
  category: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  recurring?: boolean;
  recurringFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  tags?: string[];
  notes?: string;
  linkedTo?: string; // Format: "expense:Name" or "creditCard:Name" - links to dynamic amount source
}

export interface Category {
  _id?: string;
  name: string;
  color: string;
  icon?: string;
  type: 'income' | 'expense' | 'both';
  budget?: number;
}

export interface MonthlyExpense {
  name: string;
  amount: number;
  account: 'personal' | 'joint';
  addedBy?: string; // User ID of who created this item
}

export interface RecurringDeposit {
  name: string;
  amount: number;
  account: 'personal' | 'joint';
  frequency: 'weekly' | 'biweekly' | 'monthly';
  startDate: string; // ISO date string for biweekly reference or day of month for monthly
  skippedDates?: string[]; // ISO date strings for dates to skip this deposit
  amountHistory?: { amount: number; effectiveDate: string }[]; // Tracks past amount changes
  addedBy?: string; // User ID of who created this item
}

export interface CreditCard {
  name: string;
  projected: number;        // Overall monthly budget for the card
  actual: number;           // Overall actual (current month tracking)
  jointProjected: number;   // Joint portion of monthly budget
  jointActual: number;      // Joint actual (current month tracking)
  closingDay: number;       // Day of month when statement closes (1-31, or 0 for last day of month)
  account?: 'personal' | 'joint'; // Optional for backward compatibility
  addedBy?: string; // User ID of who created this item
}

export interface CreditCardMonthlyHistory {
  cardName: string;
  year: number;
  month: number;
  actual: number; // Personal total
  joint: number;  // Joint subtotal
  projected?: number;      // Overall projected budget for this month
  jointProjected?: number; // Joint projected budget for this month
}

export interface User {
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
}

export interface Partner {
  id: string;
  name: string;
  email: string;
  creditCards: CreditCard[];
  personalCreditCards: CreditCard[];
}

export interface SummaryStats {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  byCategory: Record<string, { income: number; expense: number }>;
}

// Budget Entries API
export const budgetAPI = {
  async getEntries(params?: {
    startDate?: string;
    endDate?: string;
    type?: string;
    category?: string;
  }): Promise<BudgetEntry[]> {
    const query = new URLSearchParams(params as any).toString();
    const response = await fetch(`${API_URL}/api/entries?${query}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch entries');
    return response.json();
  },

  async getEntry(id: string): Promise<BudgetEntry> {
    const response = await fetch(`${API_URL}/api/entries/${id}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch entry');
    return response.json();
  },

  async createEntry(entry: Omit<BudgetEntry, '_id'>): Promise<BudgetEntry> {
    const response = await fetch(`${API_URL}/api/entries`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(entry),
    });
    if (!response.ok) throw new Error('Failed to create entry');
    return response.json();
  },

  async updateEntry(id: string, entry: Partial<BudgetEntry>): Promise<BudgetEntry> {
    const response = await fetch(`${API_URL}/api/entries/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(entry),
    });
    if (!response.ok) throw new Error('Failed to update entry');
    return response.json();
  },

  async deleteEntry(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/entries/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete entry');
  },

  async getSummary(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<SummaryStats> {
    const query = new URLSearchParams(params as any).toString();
    const response = await fetch(`${API_URL}/api/entries/stats/summary?${query}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch summary');
    return response.json();
  },
};

// Categories API
export const categoryAPI = {
  async getCategories(): Promise<Category[]> {
    const response = await fetch(`${API_URL}/api/categories`);
    if (!response.ok) throw new Error('Failed to fetch categories');
    return response.json();
  },

  async createCategory(category: Omit<Category, '_id'>): Promise<Category> {
    const response = await fetch(`${API_URL}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(category),
    });
    if (!response.ok) throw new Error('Failed to create category');
    return response.json();
  },

  async updateCategory(id: string, category: Partial<Category>): Promise<Category> {
    const response = await fetch(`${API_URL}/api/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(category),
    });
    if (!response.ok) throw new Error('Failed to update category');
    return response.json();
  },

  async deleteCategory(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/categories/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete category');
  },
};

// Monthly Expenses API
export const expensesAPI = {
  async getExpenses(): Promise<MonthlyExpense[]> {
    const response = await fetch(`${API_URL}/api/user/expenses`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch expenses');
    return response.json();
  },

  async updateExpenses(expenses: MonthlyExpense[]): Promise<MonthlyExpense[]> {
    const response = await fetch(`${API_URL}/api/user/expenses`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ expenses }),
    });
    if (!response.ok) throw new Error('Failed to update expenses');
    return response.json();
  },

  async addExpense(name: string, amount: number, account?: 'personal' | 'joint'): Promise<MonthlyExpense[]> {
    const response = await fetch(`${API_URL}/api/user/expenses`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, amount, account }),
    });
    if (!response.ok) throw new Error('Failed to add expense');
    return response.json();
  },

  async deleteExpense(name: string): Promise<MonthlyExpense[]> {
    const response = await fetch(`${API_URL}/api/user/expenses/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete expense');
    return response.json();
  },
};

// Starting Balances API
export const balancesAPI = {
  async updateStartingBalances(
    personalStartingBalance?: number,
    jointStartingBalance?: number
  ): Promise<{ personalStartingBalance: number; jointStartingBalance: number }> {
    const response = await fetch(`${API_URL}/api/user/starting-balances`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ personalStartingBalance, jointStartingBalance }),
    });
    if (!response.ok) throw new Error('Failed to update starting balances');
    return response.json();
  },
};

// Recurring Deposits API
export const depositsAPI = {
  async getDeposits(): Promise<RecurringDeposit[]> {
    const response = await fetch(`${API_URL}/api/user/recurring-deposits`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch recurring deposits');
    return response.json();
  },

  async updateDeposits(deposits: RecurringDeposit[]): Promise<RecurringDeposit[]> {
    const response = await fetch(`${API_URL}/api/user/recurring-deposits`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ deposits }),
    });
    if (!response.ok) throw new Error('Failed to update recurring deposits');
    return response.json();
  },
};

// Credit Card Budgets API (Joint)
export const creditCardsAPI = {
  async updateCreditCards(cards: CreditCard[]): Promise<CreditCard[]> {
    const response = await fetch(`${API_URL}/api/user/credit-cards`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ cards }),
    });
    if (!response.ok) throw new Error('Failed to update credit card budgets');
    return response.json();
  },

  async updateCreditCardOrder(order: string[]): Promise<string[]> {
    const response = await fetch(`${API_URL}/api/user/credit-card-order`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ order }),
    });
    if (!response.ok) throw new Error('Failed to update credit card order');
    return response.json();
  },
};

// Personal Credit Card Budgets API
export const personalCreditCardsAPI = {
  async updateCreditCards(cards: CreditCard[]): Promise<CreditCard[]> {
    const response = await fetch(`${API_URL}/api/user/personal-credit-cards`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ cards }),
    });
    if (!response.ok) throw new Error('Failed to update personal credit card budgets');
    return response.json();
  },
};

// Credit Card History API
export const creditCardHistoryAPI = {
  async getHistory(year: number, month: number): Promise<CreditCardMonthlyHistory[]> {
    const response = await fetch(`${API_URL}/api/user/credit-card-history/${year}/${month}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch credit card history');
    return response.json();
  },

  async updateHistory(cardName: string, year: number, month: number, actual?: number, joint?: number, projected?: number, jointProjected?: number): Promise<CreditCardMonthlyHistory[]> {
    const response = await fetch(`${API_URL}/api/user/credit-card-history`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ cardName, year, month, actual, joint, projected, jointProjected }),
    });
    if (!response.ok) throw new Error('Failed to update credit card history');
    return response.json();
  },
};

// Profile API
export const profileAPI = {
  async updateProfile(data: { name?: string; email?: string }): Promise<{ token: string; user: { id: string; email: string; name: string } }> {
    const response = await fetch(`${API_URL}/api/user/profile`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update profile');
    }
    return response.json();
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const response = await fetch(`${API_URL}/api/user/password`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to change password');
    }
    return response.json();
  },

  async deleteAccount(password: string): Promise<{ message: string }> {
    const response = await fetch(`${API_URL}/api/user/account`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete account');
    }
    return response.json();
  },
};

// Partner API
export const partnerAPI = {
  async generateInvite(): Promise<{ code: string; expiry: string }> {
    const response = await fetch(`${API_URL}/api/partner/generate-invite`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to generate invite code');
    return response.json();
  },

  async linkWithCode(code: string): Promise<{ partnerId: string; partnerName: string; partnerEmail: string }> {
    const response = await fetch(`${API_URL}/api/partner/link`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ code }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to link with partner');
    }
    return response.json();
  },

  async getPartner(): Promise<{ partner: Partner | null }> {
    const response = await fetch(`${API_URL}/api/partner`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to get partner info');
    return response.json();
  },

  async unlinkPartner(): Promise<void> {
    const response = await fetch(`${API_URL}/api/partner`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to unlink from partner');
  },

  async syncWithPartner(): Promise<{ message: string; synced: { jointExpenses: number; jointDeposits: number; jointCreditCards: number; jointBalance: number } }> {
    const response = await fetch(`${API_URL}/api/partner/sync`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to sync with partner');
    return response.json();
  },

  async getPartnerHistory(year: number, month: number): Promise<CreditCardMonthlyHistory[]> {
    const response = await fetch(`${API_URL}/api/partner/credit-card-history/${year}/${month}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch partner history');
    return response.json();
  },

  async updatePartnerCardJoint(cardName: string, updates: { jointProjected?: number; jointActual?: number; projected?: number; actual?: number }): Promise<void> {
    const response = await fetch(`${API_URL}/api/partner/cards/${encodeURIComponent(cardName)}/joint`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update partner card');
  },
};

// Onboarding API
export const onboardingAPI = {
  async getStatus(): Promise<{ completed: boolean }> {
    const response = await fetch(`${API_URL}/api/onboarding/status`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to get onboarding status');
    return response.json();
  },

  async complete(data: {
    personalStartingBalance?: number;
    jointStartingBalance?: number;
    creditCards?: CreditCard[];
    personalCreditCards?: CreditCard[];
    creditCardHistory?: CreditCardMonthlyHistory[];
  }): Promise<User> {
    const response = await fetch(`${API_URL}/api/onboarding/complete`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to complete onboarding');
    return response.json();
  },
};
