'use client';

import { useState, useEffect } from 'react';
import { format, subMonths } from 'date-fns';
import { creditCardHistoryAPI, creditCardsAPI, personalCreditCardsAPI, partnerAPI, CreditCard, CreditCardMonthlyHistory } from '@/lib/api';
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
  currentMonth: Date;
  creditCards: CreditCard[]; // Joint credit cards
  personalCreditCards: CreditCard[]; // Personal credit cards
  partnerCreditCards?: CreditCard[]; // Partner's credit cards (joint amounts editable)
  onCreditCardsUpdate: (cards: CreditCard[]) => void;
  onPersonalCreditCardsUpdate: (cards: CreditCard[]) => void;
  onPartnerCreditCardsUpdate?: (cards: CreditCard[]) => void;
  userCreatedAt?: string;
  userName?: string; // Current user's name for personal cards section
  partnerName?: string; // Partner's name for display
  hasPartner?: boolean; // Whether user has a linked partner
  partnerJointCardNames?: string[]; // Names of joint cards that came from the partner
  userId?: string; // Current user's ID for identifying partner-added items
}

// Sortable wrapper component for history (with render prop for drag handle)
function SortableHistoryItem({ id, children }: { id: string; children: (listeners: Record<string, unknown>, attributes: Record<string, unknown>) => React.ReactNode }) {
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
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children((listeners ?? {}) as Record<string, unknown>, (attributes ?? {}) as unknown as Record<string, unknown>)}
    </div>
  );
}

// Sortable wrapper for budgets (whole row draggable)
function SortableBudgetItem({ id, children }: { id: string; children: React.ReactNode }) {
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
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

// Helper for ordinal suffix
const getOrdinalSuffix = (day: number) => {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

// Helper to get the actual closing day for a card (handles 0 as "last day of month")
const getActualClosingDay = (closingDay: number, year: number, month: number): number => {
  if (closingDay === 0) {
    // Last day of month: create date for first day of next month, subtract 1 day
    return new Date(year, month + 1, 0).getDate();
  }
  return closingDay;
};

// Helper to format closing day for display
const formatClosingDay = (closingDay: number): string => {
  if (closingDay === 0) {
    return 'Last';
  }
  return `${closingDay}${getOrdinalSuffix(closingDay)}`;
};

export default function PreviousMonthSidebar({ currentMonth, creditCards, personalCreditCards, partnerCreditCards = [], onCreditCardsUpdate, onPersonalCreditCardsUpdate, onPartnerCreditCardsUpdate, userCreatedAt, userName, partnerName, hasPartner, partnerJointCardNames = [], userId }: Props) {
  const [history, setHistory] = useState<CreditCardMonthlyHistory[]>([]);
  const [currentMonthHistory, setCurrentMonthHistory] = useState<CreditCardMonthlyHistory[]>([]);
  const [partnerHistory, setPartnerHistory] = useState<CreditCardMonthlyHistory[]>([]);
  const [partnerCurrentMonthHistory, setPartnerCurrentMonthHistory] = useState<CreditCardMonthlyHistory[]>([]);
  const [editingHistoryCard, setEditingHistoryCard] = useState<{ name: string; column: 'personal' | 'joint' } | null>(null);
  const [editingBudgetCard, setEditingBudgetCard] = useState<{ index: number; field: 'projected' | 'actual' | 'closingDay' | 'jointProjected' | 'jointActual' | 'name' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);

  // Partner card editing state (only joint amounts are editable)
  const [editingPartnerCard, setEditingPartnerCard] = useState<{ cardName: string; field: 'jointProjected' | 'jointActual' | 'projected' | 'actual' } | null>(null);
  const [partnerEditValue, setPartnerEditValue] = useState('');

  // Add card state (Joint)
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardProjected, setNewCardProjected] = useState('');
  const [newCardJointProjected, setNewCardJointProjected] = useState('');
  const [newCardClosingDay, setNewCardClosingDay] = useState('1');

  // Personal card state
  const [editingPersonalBudgetCard, setEditingPersonalBudgetCard] = useState<{ index: number; field: 'projected' | 'actual' | 'closingDay' } | null>(null);
  const [isAddingPersonalCard, setIsAddingPersonalCard] = useState(false);
  const [newPersonalCardName, setNewPersonalCardName] = useState('');
  const [newPersonalCardProjected, setNewPersonalCardProjected] = useState('');
  const [newPersonalCardClosingDay, setNewPersonalCardClosingDay] = useState('1');
  const [personalEditValue, setPersonalEditValue] = useState('');

  const previousMonth = subMonths(currentMonth, 1);
  const prevYear = previousMonth.getFullYear();
  const prevMonthNum = previousMonth.getMonth();


  // Determine if joint amounts should be editable
  // Editable when the previous month is in the past relative to today
  const userStartDate = userCreatedAt ? new Date(userCreatedAt) : null;
  const userStartYear = userStartDate?.getFullYear() ?? 2026;
  const userStartMonth = userStartDate?.getMonth() ?? 0; // 0-indexed
  const isStartMonth = currentMonth.getFullYear() === userStartYear && currentMonth.getMonth() === userStartMonth;
  const today = new Date();
  const isPreviousMonthInPast =
    previousMonth.getFullYear() < today.getFullYear() ||
    (previousMonth.getFullYear() === today.getFullYear() && previousMonth.getMonth() < today.getMonth());
  const isJointEditable = isPreviousMonthInPast;

  // Is the currently viewed month in the past? (used to show historical data in budget section)
  const isCurrentMonthInPast =
    currentMonth.getFullYear() < today.getFullYear() ||
    (currentMonth.getFullYear() === today.getFullYear() && currentMonth.getMonth() < today.getMonth());

  // Is the currently viewed month in the future?
  const isCurrentMonthInFuture =
    currentMonth.getFullYear() > today.getFullYear() ||
    (currentMonth.getFullYear() === today.getFullYear() && currentMonth.getMonth() > today.getMonth());

  // Helper to check if a card's closing date has passed for the previous month's data
  // For late closing days (>15): statement closes in the SAME month as the data
  //   e.g., closingDay=31, December data closes December 31st
  // For early closing days (<=15): statement closes in the FOLLOWING month
  //   e.g., closingDay=2, January data closes February 2nd
  const hasClosingDatePassed = (card: CreditCard): boolean => {
    const today = new Date();
    let closingDate: Date;

    // closingDay === 0 means "last day of month" - treat as late closing day
    if (card.closingDay === 0 || card.closingDay > 15) {
      // Late closing day - statement closes in the previous month (same as the data month)
      const actualDay = getActualClosingDay(card.closingDay, previousMonth.getFullYear(), previousMonth.getMonth());
      closingDate = new Date(previousMonth.getFullYear(), previousMonth.getMonth(), actualDay);
    } else {
      // Early closing day - statement closes in the current viewed month
      closingDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), card.closingDay);
    }

    return today >= closingDate;
  };

  // Get the values to display for previous month section
  // - For user's START MONTH: ALWAYS use history data (completely independent, editable)
  // - For other months in the past: use history data (read-only)
  // - For current budget month: use credit card budget actuals (read-only)
  const getCardPreviousMonthValues = (card: CreditCard): { personal: number; joint: number; isClosed: boolean; fromHistory: boolean } => {
    // For partner cards, use partner's history data
    const isPartner = isPartnerCard(card);
    const historySource = isPartner ? partnerHistory : history;

    // For the user's start month, ALWAYS use history data
    // This is the month before they started tracking - completely independent
    if (isStartMonth) {
      const cardHistory = historySource.find(h => h.cardName === card.name);
      return {
        personal: cardHistory?.actual || 0,
        joint: cardHistory?.joint || 0,
        isClosed: true, // Always show as "closed" for pre-tracking month
        fromHistory: true,
      };
    }

    const today = new Date();
    const currentRealMonth = today.getMonth();
    const currentRealYear = today.getFullYear();

    // Check if the previous month (of the viewed month) is before the current real month
    // If so, we should use historical data, not credit card budget actuals
    const isPreviousMonthInPast =
      previousMonth.getFullYear() < currentRealYear ||
      (previousMonth.getFullYear() === currentRealYear && previousMonth.getMonth() < currentRealMonth);

    const closingPassed = hasClosingDatePassed(card);

    if (isPreviousMonthInPast) {
      // Previous month is in the past - use history data
      const cardHistory = historySource.find(h => h.cardName === card.name);
      return {
        personal: cardHistory?.actual || 0,
        joint: cardHistory?.joint || 0,
        isClosed: true, // Always closed if in the past
        fromHistory: true,
      };
    } else {
      // Previous month is the current budget month
      // Check history first (user may have edited budget values which save to history)
      const cardHistory = historySource.find(h => h.cardName === card.name);
      if (cardHistory) {
        return {
          personal: cardHistory.actual ?? card.actual,
          joint: cardHistory.joint ?? (card.jointActual || 0),
          isClosed: closingPassed,
          fromHistory: true,
        };
      }
      // Fall back to credit card budget actuals
      return {
        personal: card.actual,
        joint: card.jointActual || 0,
        isClosed: closingPassed,
        fromHistory: false,
      };
    }
  };

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchHistory();
  }, [currentMonth]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await creditCardHistoryAPI.getHistory(prevYear, prevMonthNum);
      let hasUpdates = false;

      // Only auto-sync credit card budget actuals to history when:
      // - Not the start month (start month's previous month is completely independent)
      // - Previous month is NOT in the past (auto-sync only applies when previous month is the current budget month)
      // When viewing past months, creditCards are for the viewed month, not the previous month,
      // so syncing them would overwrite history with wrong data.
      if (!isStartMonth && !isPreviousMonthInPast) {
        // For each card, check if closing date has passed
        // If it has, save actual values to history (only if not already saved)
        for (const card of creditCards) {
          const today = new Date();
          const actualDay = getActualClosingDay(card.closingDay, currentMonth.getFullYear(), currentMonth.getMonth());
          const closingDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), actualDay);
          const closingPassed = today >= closingDate;

          if (closingPassed) {
            // Closing date has passed - save actual values to history
            const existingHistory = data.find(h => h.cardName === card.name);
            const actualPersonal = card.actual;
            const actualJoint = card.jointActual || 0;

            if (!existingHistory) {
              // Create new history entry with actual values and projected budget
              try {
                await creditCardHistoryAPI.updateHistory(card.name, prevYear, prevMonthNum, actualPersonal, actualJoint, card.projected, card.jointProjected || 0);
                hasUpdates = true;
              } catch (error) {
                console.error('Failed to save history for', card.name, error);
              }
            } else {
              // Update if values differ (actual values should override once closing date passes)
              const needsUpdate = existingHistory.actual !== actualPersonal || existingHistory.joint !== actualJoint;
              if (needsUpdate) {
                try {
                  await creditCardHistoryAPI.updateHistory(card.name, prevYear, prevMonthNum, actualPersonal, actualJoint);
                  hasUpdates = true;
                } catch (error) {
                  console.error('Failed to update history for', card.name, error);
                }
              }
            }
          }
        }
      }

      // Re-fetch if we made updates
      if (hasUpdates) {
        const refreshedData = await creditCardHistoryAPI.getHistory(prevYear, prevMonthNum);
        setHistory(refreshedData);
      } else {
        setHistory(data);
      }

      // Also fetch current month's history (for budget section when viewing past months)
      let currentMonthData = await creditCardHistoryAPI.getHistory(
        currentMonth.getFullYear(),
        currentMonth.getMonth()
      );

      // Auto-initialize history for cards that don't have an entry for this month yet
      // This ensures every viewed month gets per-month snapshots stored in the database
      const allCards = [...creditCards, ...personalCreditCards];
      let currentMonthUpdated = false;
      for (const card of allCards) {
        if (!currentMonthData.find(h => h.cardName === card.name)) {
          // Use previous month's history for projected defaults, fall back to card defaults
          const prevHist = (hasUpdates ? await creditCardHistoryAPI.getHistory(prevYear, prevMonthNum) : data).find(h => h.cardName === card.name);
          const projected = prevHist?.projected ?? card.projected;
          const jointProjected = prevHist?.jointProjected ?? (card.jointProjected || 0);
          try {
            await creditCardHistoryAPI.updateHistory(
              card.name,
              currentMonth.getFullYear(),
              currentMonth.getMonth(),
              0, 0, // actuals start at 0 for new months
              projected,
              jointProjected
            );
            currentMonthUpdated = true;
          } catch (error) {
            console.error('Failed to initialize history for', card.name, error);
          }
        }
      }

      if (currentMonthUpdated) {
        currentMonthData = await creditCardHistoryAPI.getHistory(
          currentMonth.getFullYear(),
          currentMonth.getMonth()
        );
      }
      setCurrentMonthHistory(currentMonthData);

      // Fetch partner's history for both previous and current month
      if (hasPartner) {
        try {
          const [partnerPrevData, partnerCurrData] = await Promise.all([
            partnerAPI.getPartnerHistory(prevYear, prevMonthNum),
            partnerAPI.getPartnerHistory(currentMonth.getFullYear(), currentMonth.getMonth()),
          ]);
          setPartnerHistory(partnerPrevData);
          setPartnerCurrentMonthHistory(partnerCurrData);
        } catch (err) {
          console.error('Failed to fetch partner history:', err);
        }
      }
    } catch (error) {
      console.error('Failed to fetch credit card history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCardHistory = (cardName: string) => {
    return history.find(h => h.cardName === cardName);
  };

  // History editing handlers
  const handleHistoryEditStart = (cardName: string, column: 'personal' | 'joint', currentValue: number) => {
    setEditingHistoryCard({ name: cardName, column });
    setEditValue(currentValue.toString());
  };

  const handleHistoryEditSave = async (cardName: string, column: 'personal' | 'joint') => {
    const amount = parseFloat(editValue);
    if (isNaN(amount) || amount < 0) {
      setEditingHistoryCard(null);
      return;
    }
    try {
      if (column === 'personal') {
        await creditCardHistoryAPI.updateHistory(cardName, prevYear, prevMonthNum, amount, undefined);
      } else {
        await creditCardHistoryAPI.updateHistory(cardName, prevYear, prevMonthNum, undefined, amount);
      }
      await fetchHistory();
    } catch (error) {
      console.error('Failed to update history:', error);
    }
    setEditingHistoryCard(null);
  };

  // Budget editing handlers
  const handleBudgetEditStart = (index: number, field: 'projected' | 'actual' | 'closingDay' | 'jointProjected' | 'jointActual' | 'name', value: number | string) => {
    setEditingBudgetCard({ index, field });
    setEditValue(value.toString());
  };

  const handleBudgetEditSave = async () => {
    if (!editingBudgetCard) return;

    const card = creditCards[editingBudgetCard.index];
    const field = editingBudgetCard.field;

    // Name and closingDay changes apply to the card itself (shared across months)
    if (field === 'name') {
      const newName = editValue.trim();
      if (!newName) {
        setEditingBudgetCard(null);
        return;
      }
      const updated = [...creditCards];
      updated[editingBudgetCard.index] = { ...updated[editingBudgetCard.index], name: newName };
      try {
        await creditCardsAPI.updateCreditCards(getOwnCards(updated));
        await creditCardsAPI.updateCreditCardOrder(updated.map(c => c.name));
        onCreditCardsUpdate(updated);
      } catch (error) {
        console.error('Failed to update credit card:', error);
      }
      setEditingBudgetCard(null);
      return;
    }

    if (field === 'closingDay') {
      const value = parseInt(editValue);
      if (isNaN(value) || value < 1 || value > 31) {
        setEditingBudgetCard(null);
        return;
      }
      const updated = [...creditCards];
      updated[editingBudgetCard.index] = { ...updated[editingBudgetCard.index], closingDay: Math.min(31, Math.max(1, value)) };
      try {
        await creditCardsAPI.updateCreditCards(getOwnCards(updated));
        onCreditCardsUpdate(updated);
      } catch (error) {
        console.error('Failed to update credit card:', error);
      }
      setEditingBudgetCard(null);
      return;
    }

    // Projected/actual changes are per-month — save to history
    const value = parseFloat(editValue);
    if (isNaN(value) || value < 0) {
      setEditingBudgetCard(null);
      return;
    }

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    try {
      // Get existing history values for this card/month
      const existingHist = currentMonthHistory.find(h => h.cardName === card.name);
      const histValues = {
        actual: existingHist?.actual ?? card.actual,
        joint: existingHist?.joint ?? (card.jointActual || 0),
        projected: existingHist?.projected ?? card.projected,
        jointProjected: existingHist?.jointProjected ?? (card.jointProjected || 0),
      };

      // Map the field to history field names
      if (field === 'projected') histValues.projected = value;
      else if (field === 'jointProjected') histValues.jointProjected = value;
      else if (field === 'actual') histValues.actual = value;
      else if (field === 'jointActual') histValues.joint = value;

      await creditCardHistoryAPI.updateHistory(
        card.name, year, month,
        histValues.actual, histValues.joint,
        histValues.projected, histValues.jointProjected
      );

      // Refresh history data
      const refreshed = await creditCardHistoryAPI.getHistory(year, month);
      setCurrentMonthHistory(refreshed);
    } catch (error) {
      console.error('Failed to save budget to history:', error);
    }
    setEditingBudgetCard(null);
  };

  const handleCardDelete = async (index: number) => {
    const updated = creditCards.filter((_, i) => i !== index);
    try {
      await creditCardsAPI.updateCreditCards(getOwnCards(updated));
      await creditCardsAPI.updateCreditCardOrder(updated.map(c => c.name));
      onCreditCardsUpdate(updated);
    } catch (error) {
      console.error('Failed to delete credit card:', error);
    }
  };

  const handleCardAdd = async () => {
    if (!newCardName.trim() || !newCardProjected) return;
    const projected = parseFloat(newCardProjected);
    const jointProjected = parseFloat(newCardJointProjected) || 0;
    const closingDay = parseInt(newCardClosingDay) || 1;
    if (isNaN(projected) || projected < 0) return;
    const updated = [...creditCards, {
      name: newCardName.trim(),
      projected,
      actual: 0,
      jointProjected,
      jointActual: 0,
      closingDay: Math.min(31, Math.max(1, closingDay)),
      account: 'joint' as const,
    }];
    try {
      await creditCardsAPI.updateCreditCards(getOwnCards(updated));
      await creditCardsAPI.updateCreditCardOrder(updated.map(c => c.name));
      onCreditCardsUpdate(updated);
      setNewCardName('');
      setNewCardProjected('');
      setNewCardJointProjected('');
      setNewCardClosingDay('1');
      setIsAddingCard(false);
    } catch (error) {
      console.error('Failed to add credit card:', error);
    }
  };

  const handleHistoryDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = creditCards.findIndex((c) => `history-${c.name}` === active.id);
      const newIndex = creditCards.findIndex((c) => `history-${c.name}` === over.id);
      const reordered = arrayMove(creditCards, oldIndex, newIndex);
      try {
        // Save order only (per-user, no partner sync)
        await creditCardsAPI.updateCreditCardOrder(reordered.map(c => c.name));
        onCreditCardsUpdate(reordered);
      } catch (error) {
        console.error('Failed to reorder credit cards:', error);
      }
    }
  };

  const handleBudgetDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = creditCards.findIndex((c) => `budget-${c.name}` === active.id);
      const newIndex = creditCards.findIndex((c) => `budget-${c.name}` === over.id);
      const reordered = arrayMove(creditCards, oldIndex, newIndex);
      try {
        // Save order only (per-user, no partner sync)
        await creditCardsAPI.updateCreditCardOrder(reordered.map(c => c.name));
        onCreditCardsUpdate(reordered);
      } catch (error) {
        console.error('Failed to reorder credit cards:', error);
      }
    }
  };

  // Personal card handlers
  const handlePersonalBudgetEditStart = (index: number, field: 'projected' | 'actual' | 'closingDay', value: number) => {
    setEditingPersonalBudgetCard({ index, field });
    setPersonalEditValue(value.toString());
  };

  const handlePersonalBudgetEditSave = async () => {
    if (!editingPersonalBudgetCard) return;
    const value = editingPersonalBudgetCard.field === 'closingDay' ? parseInt(personalEditValue) : parseFloat(personalEditValue);
    if (isNaN(value) || value < 0) {
      setEditingPersonalBudgetCard(null);
      return;
    }
    const updated = [...personalCreditCards];
    if (editingPersonalBudgetCard.field === 'closingDay') {
      updated[editingPersonalBudgetCard.index] = { ...updated[editingPersonalBudgetCard.index], closingDay: Math.min(31, Math.max(1, value)) };
    } else {
      updated[editingPersonalBudgetCard.index] = { ...updated[editingPersonalBudgetCard.index], [editingPersonalBudgetCard.field]: value };
    }
    try {
      await personalCreditCardsAPI.updateCreditCards(updated);
      onPersonalCreditCardsUpdate(updated);
    } catch (error) {
      console.error('Failed to update personal credit card:', error);
    }
    setEditingPersonalBudgetCard(null);
  };

  const handlePersonalCardDelete = async (index: number) => {
    const updated = personalCreditCards.filter((_, i) => i !== index);
    try {
      await personalCreditCardsAPI.updateCreditCards(updated);
      onPersonalCreditCardsUpdate(updated);
    } catch (error) {
      console.error('Failed to delete personal credit card:', error);
    }
  };

  const handlePersonalCardAdd = async () => {
    if (!newPersonalCardName.trim() || !newPersonalCardProjected) return;
    const projected = parseFloat(newPersonalCardProjected);
    const closingDay = parseInt(newPersonalCardClosingDay) || 1;
    if (isNaN(projected) || projected < 0) return;
    const updated = [...personalCreditCards, {
      name: newPersonalCardName.trim(),
      projected,
      actual: 0,
      jointProjected: 0,
      jointActual: 0,
      closingDay: Math.min(31, Math.max(1, closingDay)),
      account: 'personal' as const,
    }];
    try {
      await personalCreditCardsAPI.updateCreditCards(updated);
      onPersonalCreditCardsUpdate(updated);
      setNewPersonalCardName('');
      setNewPersonalCardProjected('');
      setNewPersonalCardClosingDay('1');
      setIsAddingPersonalCard(false);
    } catch (error) {
      console.error('Failed to add personal credit card:', error);
    }
  };

  const handlePersonalBudgetDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = personalCreditCards.findIndex((c) => `personal-budget-${c.name}` === active.id);
      const newIndex = personalCreditCards.findIndex((c) => `personal-budget-${c.name}` === over.id);
      const reordered = arrayMove(personalCreditCards, oldIndex, newIndex);
      try {
        await personalCreditCardsAPI.updateCreditCards(reordered);
        onPersonalCreditCardsUpdate(reordered);
      } catch (error) {
        console.error('Failed to reorder personal credit cards:', error);
      }
    }
  };

  // Partner card editing handlers (supports joint and personal fields)
  const handlePartnerCardEditStart = (cardName: string, field: 'jointProjected' | 'jointActual' | 'projected' | 'actual', value: number) => {
    setEditingPartnerCard({ cardName, field: field as any });
    setPartnerEditValue(value.toString());
  };

  const handlePartnerCardEditSave = async () => {
    if (!editingPartnerCard) return;
    const value = parseFloat(partnerEditValue);
    if (isNaN(value) || value < 0) {
      setEditingPartnerCard(null);
      return;
    }
    try {
      await partnerAPI.updatePartnerCardJoint(editingPartnerCard.cardName, {
        [editingPartnerCard.field]: value,
      });
      // Update local state
      if (onPartnerCreditCardsUpdate) {
        const updated = partnerCreditCards.map(card =>
          card.name === editingPartnerCard.cardName
            ? { ...card, [editingPartnerCard.field]: value }
            : card
        );
        onPartnerCreditCardsUpdate(updated);
      }
    } catch (error) {
      console.error('Failed to update partner card:', error);
    }
    setEditingPartnerCard(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Check if a card was added by the partner (uses addedBy field, falls back to partnerJointCardNames)
  const isPartnerCard = (card: CreditCard) => {
    if (card.addedBy && userId) return card.addedBy !== userId;
    return partnerJointCardNames.includes(card.name);
  };

  // Filter out partner cards before saving to server (partner cards are merged at read time, not stored on user)
  const getOwnCards = (cards: CreditCard[]) => cards.filter(c => !isPartnerCard(c));

  // Get budget values for the viewed month - uses history so each month is isolated
  // Future months: 0 actuals, projected from previous month's history (or card defaults)
  // For partner cards, uses partner's history data
  const getCardBudgetValues = (card: CreditCard) => {
    const isPartner = isPartnerCard(card);
    const histSource = isPartner ? partnerCurrentMonthHistory : currentMonthHistory;
    const prevHistSource = isPartner ? partnerHistory : history;

    const hist = histSource.find(h => h.cardName === card.name);
    // Use previous month's history for projected defaults when no current month history exists
    const prevHist = prevHistSource.find(h => h.cardName === card.name);
    const defaultProjected = prevHist?.projected ?? card.projected;
    const defaultJointProjected = prevHist?.jointProjected ?? (card.jointProjected || 0);

    if (hist) {
      return {
        projected: hist.projected ?? defaultProjected,
        jointProjected: hist.jointProjected ?? defaultJointProjected,
        actual: isCurrentMonthInFuture ? 0 : (hist.actual ?? card.actual),
        jointActual: isCurrentMonthInFuture ? 0 : (hist.joint ?? (card.jointActual || 0)),
      };
    }
    return {
      projected: defaultProjected,
      jointProjected: defaultJointProjected,
      actual: isCurrentMonthInFuture ? 0 : card.actual,
      jointActual: isCurrentMonthInFuture ? 0 : (card.jointActual || 0),
    };
  };

  // Alias for backward compat in totals
  const getCardBudgetActual = getCardBudgetValues;

  // Calculate totals for previous month section using projected vs actual based on closing date
  const personalTotal = creditCards.reduce((sum, card) => {
    const { personal } = getCardPreviousMonthValues(card);
    return sum + personal;
  }, 0);

  const jointTotal = creditCards.reduce((sum, card) => {
    const { joint } = getCardPreviousMonthValues(card);
    return sum + joint;
  }, 0);

  // Check if any cards are still open (closing date hasn't passed)
  const hasOpenCards = creditCards.some(card => !hasClosingDatePassed(card));

  const cardProjectedTotal = creditCards.reduce((sum, c) => sum + getCardBudgetValues(c).projected, 0);
  const cardActualTotal = creditCards.reduce((sum, c) => sum + getCardBudgetValues(c).actual, 0);
  const cardJointProjectedTotal = creditCards.reduce((sum, c) => sum + getCardBudgetValues(c).jointProjected, 0);
  const cardJointActualTotal = creditCards.reduce((sum, c) => sum + getCardBudgetValues(c).jointActual, 0);

  const personalCardProjectedTotal = personalCreditCards.reduce((sum, c) => sum + getCardBudgetValues(c).projected, 0);
  const personalCardActualTotal = personalCreditCards.reduce((sum, c) => sum + getCardBudgetValues(c).actual, 0);

  // Combine all user's cards (joint + personal) for display
  const allUserCards = [...creditCards, ...personalCreditCards];

  // Calculate combined totals for all user cards
  const allUserCardProjectedTotal = allUserCards.reduce((sum, c) => sum + getCardBudgetValues(c).projected, 0);
  const allUserCardActualTotal = allUserCards.reduce((sum, c) => sum + getCardBudgetValues(c).actual, 0);
  const allUserCardJointProjectedTotal = allUserCards.reduce((sum, c) => sum + getCardBudgetValues(c).jointProjected, 0);
  const allUserCardJointActualTotal = allUserCards.reduce((sum, c) => sum + getCardBudgetValues(c).jointActual, 0);

  // Previous month section JSX (rendered after budget section)
  const previousMonthSection = (
      <div className="glass-panel rounded-xl p-4">
        <h3 className="text-lg font-display font-bold mb-3 text-purple-400">
          {format(previousMonth, 'MMMM yyyy')} Credit Cards
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
          </div>
        ) : creditCards.length === 0 ? (
          <p className="text-sm text-gray-500 font-mono text-center py-4">No credit cards configured</p>
        ) : (
          <div>
            {/* Header row */}
            <div className="flex items-center mb-2 text-[10px] font-mono text-gray-500">
              <div className="w-4"></div>
              <div className="flex-1">Card</div>
              <div className="w-20 text-right text-green-400/70">Personal</div>
              <div className="w-20 text-right text-cyan-400/70">Joint</div>
            </div>

            {/* Card rows */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleHistoryDragEnd}>
              <SortableContext items={creditCards.map((c) => `history-${c.name}`)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {creditCards.map((card, cardIndex) => {
                    // Get values - from history if in past, from credit card budgets if current budget month
                    const { personal: personalValue, joint: jointValue, isClosed, fromHistory } = getCardPreviousMonthValues(card);
                    const isEditingPersonal = editingHistoryCard?.name === card.name && editingHistoryCard?.column === 'personal';
                    const isEditingJoint = editingHistoryCard?.name === card.name && editingHistoryCard?.column === 'joint';
                    // Editable when the previous month is in the past relative to today
                    const canEdit = isPreviousMonthInPast;

                    return (
                      <SortableHistoryItem key={`history-${card.name}`} id={`history-${card.name}`}>
                        {(listeners, attributes) => (
                        <div className={`flex items-center p-1.5 rounded group hover:bg-gray-800/50 transition-colors ${!isClosed ? 'bg-gray-800/20 border border-dashed border-gray-700' : 'bg-gray-800/30'}`}>
                          {/* Drag handle */}
                          <span
                            className="text-gray-500 cursor-grab w-4 text-[10px]"
                            {...listeners}
                            {...attributes}
                          >⋮⋮</span>

                          {/* Card name with in-progress indicator */}
                          <div className="flex-1 min-w-0">
                            <div className="text-gray-300 font-mono text-[10px] truncate">{card.name}</div>
                            {!isClosed && <div className="text-[8px] text-yellow-500/70">(open)</div>}
                          </div>

                          {/* Personal column - blank for partner's cards */}
                          {isPartnerCard(card) ? (
                            <div className="w-20"></div>
                          ) : (
                          <div
                            className={`w-20 text-right ${canEdit ? 'cursor-pointer' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (canEdit && !isEditingPersonal) handleHistoryEditStart(card.name, 'personal', personalValue);
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            {isEditingPersonal && canEdit ? (
                              <input
                                type="number"
                                step="0.01"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => handleHistoryEditSave(card.name, 'personal')}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleHistoryEditSave(card.name, 'personal');
                                  if (e.key === 'Escape') setEditingHistoryCard(null);
                                }}
                                className="w-16 bg-gray-700 border border-green-500 rounded px-1 py-0.5 text-right text-[10px] font-mono text-white focus:outline-none"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span className={`font-mono text-[10px] font-bold ${!isClosed ? 'text-green-400/60' : 'text-green-400'} ${canEdit ? 'hover:underline' : ''}`}>
                                {formatCurrency(personalValue)}
                              </span>
                            )}
                          </div>
                          )}

                          {/* Joint column - saves to history for start month */}
                          <div
                            className={`w-20 text-right ${canEdit ? 'cursor-pointer' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (canEdit && !isEditingJoint) handleHistoryEditStart(card.name, 'joint', jointValue);
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            {isEditingJoint && canEdit ? (
                              <input
                                type="number"
                                step="0.01"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => handleHistoryEditSave(card.name, 'joint')}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleHistoryEditSave(card.name, 'joint');
                                  if (e.key === 'Escape') setEditingHistoryCard(null);
                                }}
                                className="w-16 bg-gray-700 border border-cyan-500 rounded px-1 py-0.5 text-right text-[10px] font-mono text-white focus:outline-none"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span className={`font-mono text-[10px] font-bold ${!isClosed ? 'text-cyan-400/60' : 'text-cyan-400'} ${canEdit ? 'hover:underline' : ''}`}>
                                {formatCurrency(jointValue)}
                              </span>
                            )}
                          </div>
                        </div>
                        )}
                      </SortableHistoryItem>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>

            {/* Partner's Personal Cards in Previous Month */}
            {hasPartner && partnerCreditCards.length > 0 && (
              <div className="mt-3 pt-2 border-t border-gray-700/30">
                <p className="text-[10px] text-purple-400 font-mono mb-1">{partnerName || 'Partner'}&apos;s Personal Cards</p>
                <div className="space-y-1">
                  {partnerCreditCards.map((card) => {
                    // Use partner's card values directly (we don't have their per-month history)
                    const personalValue = card.actual || 0;
                    const isClosed = hasClosingDatePassed(card);
                    return (
                      <div key={`partner-history-${card.name}`} className={`flex items-center p-1.5 rounded ${!isClosed ? 'bg-purple-800/10 border border-dashed border-purple-700/30' : 'bg-purple-800/10'}`}>
                        <div className="w-4"></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-purple-300 font-mono text-[10px] truncate">{card.name}</div>
                          {!isClosed && <div className="text-[8px] text-yellow-500/70">(open)</div>}
                        </div>
                        <div className="w-20 text-right">
                          <span className={`font-mono text-[10px] font-bold ${!isClosed ? 'text-purple-400/60' : 'text-purple-400'}`}>
                            {formatCurrency(personalValue)}
                          </span>
                        </div>
                        <div className="w-20"></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Totals row */}
            <div className="flex items-center mt-3 pt-2 border-t border-gray-700/30 text-[10px] font-mono">
              <div className="w-4"></div>
              <div className="flex-1 text-gray-400 flex items-center gap-1">
                Total
                {hasOpenCards && <span className="text-[8px] text-yellow-500/70">(in progress)</span>}
              </div>
              <div className={`w-20 text-right font-bold ${hasOpenCards ? 'text-green-400/70' : 'text-green-400'}`}>{formatCurrency(personalTotal)}</div>
              <div className={`w-20 text-right font-bold ${hasOpenCards ? 'text-cyan-400/70' : 'text-cyan-400'}`}>{formatCurrency(jointTotal)}</div>
            </div>
          </div>
        )}
      </div>
  );

  return (
    <div className="space-y-4">
      {/* Previous Month Credit Cards */}
      {previousMonthSection}

      {/* Current Month Credit Card Budgets */}
      <div className="glass-panel rounded-xl p-4">
        <h3 className="text-lg font-display font-bold mb-3 text-blue-400">
          {format(currentMonth, 'MMMM yyyy')} Credit Cards
        </h3>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleBudgetDragEnd}>
          <SortableContext items={creditCards.map((c) => `budget-${c.name}`)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3 mb-3">
              {creditCards.map((card, index) => (
                <SortableBudgetItem key={`budget-${card.name}`} id={`budget-${card.name}`}>
                  <div className="p-2 bg-gray-800/30 rounded-lg group hover:bg-gray-800/50 transition-colors cursor-grab">
                    {/* Card header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">⋮⋮</span>
                        <div className="flex flex-col">
                          {editingBudgetCard?.index === index && editingBudgetCard.field === 'name' ? (
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleBudgetEditSave}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleBudgetEditSave();
                                if (e.key === 'Escape') setEditingBudgetCard(null);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                              className="bg-gray-700 border border-blue-500 rounded px-1 text-sm font-mono text-white focus:outline-none w-32"
                              autoFocus
                            />
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <span
                                className="text-gray-300 font-mono text-sm font-semibold hover:text-blue-400 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBudgetEditStart(index, 'name', card.name);
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                              >
                                {card.name}
                              </span>
                              {isPartnerCard(card) && (
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 shrink-0">
                                  Partner&apos;s
                                </span>
                              )}
                            </span>
                          )}
                          <div className="flex items-center gap-2">
                            {editingBudgetCard?.index === index && editingBudgetCard.field === 'closingDay' ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                                <span className="text-[10px] text-gray-500 font-mono">Closes:</span>
                                <input
                                  type="number"
                                  min="1"
                                  max="31"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={handleBudgetEditSave}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleBudgetEditSave();
                                    if (e.key === 'Escape') setEditingBudgetCard(null);
                                  }}
                                  className="w-10 bg-gray-700 border border-blue-500 rounded px-1 text-center text-[10px] font-mono text-white focus:outline-none"
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <span
                                className="text-[10px] text-gray-500 font-mono hover:text-blue-400 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBudgetEditStart(index, 'closingDay', card.closingDay);
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                              >
                                Closes: {formatClosingDay(card.closingDay)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardDelete(index);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all text-xs"
                      >
                        ×
                      </button>
                    </div>

                    {/* Joint Budget Section */}
                    {(() => {
                      const vals = getCardBudgetValues(card);
                      return (
                        <>
                    <div className="mb-2 p-1.5 bg-cyan-500/5 rounded border border-cyan-500/20">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-cyan-400 font-mono font-semibold">Joint</span>
                        <div className="flex gap-3">
                          <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                            <span className="text-gray-500">Projected: </span>
                            {editingBudgetCard?.index === index && editingBudgetCard.field === 'jointProjected' ? (
                              <input
                                type="number"
                                step="0.01"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleBudgetEditSave}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleBudgetEditSave();
                                  if (e.key === 'Escape') setEditingBudgetCard(null);
                                }}
                                className="w-14 bg-gray-700 border border-cyan-500 rounded px-1 text-right text-[10px] font-mono text-white focus:outline-none"
                                autoFocus
                              />
                            ) : (
                              <span
                                onClick={() => handleBudgetEditStart(index, 'jointProjected', vals.jointProjected)}
                                className="text-cyan-400 font-mono cursor-pointer hover:underline"
                              >
                                {formatCurrency(vals.jointProjected)}
                              </span>
                            )}
                          </div>
                          <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                            <span className="text-gray-500">Actual: </span>
                            {editingBudgetCard?.index === index && editingBudgetCard.field === 'jointActual' ? (
                              <input
                                type="number"
                                step="0.01"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleBudgetEditSave}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleBudgetEditSave();
                                  if (e.key === 'Escape') setEditingBudgetCard(null);
                                }}
                                className="w-14 bg-gray-700 border border-cyan-500 rounded px-1 text-right text-[10px] font-mono text-white focus:outline-none"
                                autoFocus
                              />
                            ) : (
                              <span
                                onClick={() => handleBudgetEditStart(index, 'jointActual', vals.jointActual)}
                                className={`font-mono cursor-pointer hover:underline ${vals.jointActual > vals.jointProjected ? 'text-red-400' : 'text-yellow-400'}`}
                              >
                                {formatCurrency(vals.jointActual)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${vals.jointActual > vals.jointProjected ? 'bg-red-500' : 'bg-cyan-500'}`}
                          style={{ width: `${vals.jointProjected > 0 ? Math.min((vals.jointActual / vals.jointProjected) * 100, 100) : 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Overall Budget Section - hidden for partner's cards */}
                    {!isPartnerCard(card) && (
                    <div className="p-1.5 bg-blue-500/5 rounded border border-blue-500/20">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-blue-400 font-mono font-semibold">Overall</span>
                        <div className="flex gap-3">
                          <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                            <span className="text-gray-500">Projected: </span>
                            {editingBudgetCard?.index === index && editingBudgetCard.field === 'projected' ? (
                              <input
                                type="number"
                                step="0.01"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleBudgetEditSave}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleBudgetEditSave();
                                  if (e.key === 'Escape') setEditingBudgetCard(null);
                                }}
                                className="w-14 bg-gray-700 border border-blue-500 rounded px-1 text-right text-[10px] font-mono text-white focus:outline-none"
                                autoFocus
                              />
                            ) : (
                              <span
                                onClick={() => handleBudgetEditStart(index, 'projected', vals.projected)}
                                className="text-blue-400 font-mono cursor-pointer hover:underline"
                              >
                                {formatCurrency(vals.projected)}
                              </span>
                            )}
                          </div>
                          <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                            <span className="text-gray-500">Actual: </span>
                            {editingBudgetCard?.index === index && editingBudgetCard.field === 'actual' ? (
                              <input
                                type="number"
                                step="0.01"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleBudgetEditSave}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleBudgetEditSave();
                                  if (e.key === 'Escape') setEditingBudgetCard(null);
                                }}
                                className="w-14 bg-gray-700 border border-blue-500 rounded px-1 text-right text-[10px] font-mono text-white focus:outline-none"
                                autoFocus
                              />
                            ) : (
                              <span
                                onClick={() => handleBudgetEditStart(index, 'actual', vals.actual)}
                                className={`font-mono cursor-pointer hover:underline ${vals.actual > vals.projected ? 'text-red-400' : 'text-yellow-400'}`}
                              >
                                {formatCurrency(vals.actual)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${vals.actual > vals.projected ? 'bg-red-500' : 'bg-blue-500'}`}
                          style={{ width: `${vals.projected > 0 ? Math.min((vals.actual / vals.projected) * 100, 100) : 0}%` }}
                        />
                      </div>
                    </div>
                    )}
                        </>
                      );
                    })()}
                  </div>
                </SortableBudgetItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {isAddingCard ? (
          <div className="space-y-2 p-3 bg-gray-800/50 rounded-lg">
            <input
              type="text"
              value={newCardName}
              onChange={(e) => setNewCardName(e.target.value)}
              placeholder="Card name"
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm font-mono text-white focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <div>
              <label className="text-xs text-cyan-400 font-mono block mb-1">Joint Projected</label>
              <input
                type="number"
                step="0.01"
                value={newCardJointProjected}
                onChange={(e) => setNewCardJointProjected(e.target.value)}
                placeholder="Joint budget"
                className="w-full bg-gray-700 border border-cyan-600 rounded px-2 py-1 text-sm font-mono text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-xs text-blue-400 font-mono block mb-1">Overall Projected</label>
              <input
                type="number"
                step="0.01"
                value={newCardProjected}
                onChange={(e) => setNewCardProjected(e.target.value)}
                placeholder="Overall budget"
                className="w-full bg-gray-700 border border-blue-600 rounded px-2 py-1 text-sm font-mono text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-mono block mb-1">Closing day</label>
              <input
                type="number"
                min="1"
                max="31"
                value={newCardClosingDay}
                onChange={(e) => setNewCardClosingDay(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm font-mono text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleCardAdd} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-mono py-1 rounded transition-colors">Add</button>
              <button onClick={() => { setIsAddingCard(false); setNewCardName(''); setNewCardProjected(''); setNewCardJointProjected(''); setNewCardClosingDay('1'); }} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-mono py-1 rounded transition-colors">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setIsAddingCard(true)} className="w-full text-sm font-mono text-gray-400 hover:text-blue-400 py-2 border border-dashed border-gray-700 hover:border-blue-500 rounded-lg transition-colors">+ Add credit card</button>
        )}

        {/* User's Personal Credit Cards */}
        {personalCreditCards.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-700/50">
            <p className="text-xs text-gray-500 font-mono mb-3">Personal Cards</p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePersonalBudgetDragEnd}>
              <SortableContext items={personalCreditCards.map((c) => `personal-budget-${c.name}`)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {personalCreditCards.map((card, index) => (
                    <SortableBudgetItem key={`personal-budget-${card.name}`} id={`personal-budget-${card.name}`}>
                      <div className="p-2 bg-gray-800/30 rounded-lg group hover:bg-gray-800/50 transition-colors cursor-grab">
                        {/* Card header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">⋮⋮</span>
                            <div className="flex flex-col">
                              <span className="text-gray-300 font-mono text-sm font-semibold">{card.name}</span>
                              <span className="text-[10px] text-gray-500 font-mono">
                                Closes: {formatClosingDay(card.closingDay)}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePersonalCardDelete(index);
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all text-xs"
                          >
                            ×
                          </button>
                        </div>

                        {/* Overall Budget Section (personal cards don't have joint) */}
                        {(() => {
                          const pVals = getCardBudgetValues(card);
                          return (
                        <div className="p-1.5 bg-green-500/5 rounded border border-green-500/20">
                          <div className="flex justify-between text-[10px] mb-1">
                            <span className="text-green-400 font-mono font-semibold">Budget</span>
                            <div className="flex gap-3">
                              <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                                <span className="text-gray-500">Projected: </span>
                                {editingPersonalBudgetCard?.index === index && editingPersonalBudgetCard.field === 'projected' ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={personalEditValue}
                                    onChange={(e) => setPersonalEditValue(e.target.value)}
                                    onBlur={handlePersonalBudgetEditSave}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handlePersonalBudgetEditSave();
                                      if (e.key === 'Escape') setEditingPersonalBudgetCard(null);
                                    }}
                                    className="w-14 bg-gray-700 border border-green-500 rounded px-1 text-right text-[10px] font-mono text-white focus:outline-none"
                                    autoFocus
                                  />
                                ) : (
                                  <span
                                    onClick={() => handlePersonalBudgetEditStart(index, 'projected', pVals.projected)}
                                    className="text-green-400 font-mono cursor-pointer hover:underline"
                                  >
                                    {formatCurrency(pVals.projected)}
                                  </span>
                                )}
                              </div>
                              <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                                <span className="text-gray-500">Actual: </span>
                                {editingPersonalBudgetCard?.index === index && editingPersonalBudgetCard.field === 'actual' ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={personalEditValue}
                                    onChange={(e) => setPersonalEditValue(e.target.value)}
                                    onBlur={handlePersonalBudgetEditSave}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handlePersonalBudgetEditSave();
                                      if (e.key === 'Escape') setEditingPersonalBudgetCard(null);
                                    }}
                                    className="w-14 bg-gray-700 border border-green-500 rounded px-1 text-right text-[10px] font-mono text-white focus:outline-none"
                                    autoFocus
                                  />
                                ) : (
                                  <span
                                    onClick={() => handlePersonalBudgetEditStart(index, 'actual', pVals.actual)}
                                    className={`font-mono cursor-pointer hover:underline ${pVals.actual > pVals.projected ? 'text-red-400' : 'text-yellow-400'}`}
                                  >
                                    {formatCurrency(pVals.actual)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${pVals.actual > pVals.projected ? 'bg-red-500' : 'bg-green-500'}`}
                              style={{ width: `${pVals.projected > 0 ? Math.min((pVals.actual / pVals.projected) * 100, 100) : 0}%` }}
                            />
                          </div>
                        </div>
                          );
                        })()}
                      </div>
                    </SortableBudgetItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* Add Personal Card button */}
            {isAddingPersonalCard ? (
              <div className="mt-3 space-y-2 p-3 bg-gray-800/50 rounded-lg">
                <input
                  type="text"
                  value={newPersonalCardName}
                  onChange={(e) => setNewPersonalCardName(e.target.value)}
                  placeholder="Card name"
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm font-mono text-white focus:outline-none focus:border-green-500"
                  autoFocus
                />
                <div>
                  <label className="text-xs text-green-400 font-mono block mb-1">Projected Budget</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newPersonalCardProjected}
                    onChange={(e) => setNewPersonalCardProjected(e.target.value)}
                    placeholder="Budget"
                    className="w-full bg-gray-700 border border-green-600 rounded px-2 py-1 text-sm font-mono text-white focus:outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-mono block mb-1">Closing day</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={newPersonalCardClosingDay}
                    onChange={(e) => setNewPersonalCardClosingDay(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm font-mono text-white focus:outline-none focus:border-green-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={handlePersonalCardAdd} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-mono py-1 rounded transition-colors">Add</button>
                  <button onClick={() => { setIsAddingPersonalCard(false); setNewPersonalCardName(''); setNewPersonalCardProjected(''); setNewPersonalCardClosingDay('1'); }} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-mono py-1 rounded transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setIsAddingPersonalCard(true)} className="mt-3 w-full text-sm font-mono text-gray-400 hover:text-green-400 py-2 border border-dashed border-gray-700 hover:border-green-500 rounded-lg transition-colors">+ Add personal card</button>
            )}
          </div>
        )}

        {/* Partner's Personal Cards - Current Month */}
        {hasPartner && partnerCreditCards.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-700/50">
            <p className="text-xs text-purple-400 font-mono mb-3">{partnerName || 'Partner'}&apos;s Personal Cards</p>
            <div className="space-y-3">
              {partnerCreditCards.map((card) => {
                // Use partner's card values directly
                const projected = card.projected || 0;
                const actual = card.actual || 0;
                const isEditingProjected = editingPartnerCard?.cardName === card.name && editingPartnerCard.field === 'projected';
                const isEditingActual = editingPartnerCard?.cardName === card.name && editingPartnerCard.field === 'actual';
                return (
                  <div key={`partner-budget-${card.name}`} className="p-2 bg-purple-800/10 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex flex-col">
                        <span className="text-purple-300 font-mono text-sm font-semibold">{card.name}</span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          Closes: {formatClosingDay(card.closingDay)}
                        </span>
                      </div>
                    </div>
                    {/* Budget Section */}
                    <div className="p-1.5 bg-purple-500/5 rounded border border-purple-500/20">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-purple-400 font-mono font-semibold">Budget</span>
                        <div className="flex gap-3">
                          <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                            <span className="text-gray-500">Projected: </span>
                            {isEditingProjected ? (
                              <input
                                type="number"
                                step="0.01"
                                value={partnerEditValue}
                                onChange={(e) => setPartnerEditValue(e.target.value)}
                                onBlur={handlePartnerCardEditSave}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handlePartnerCardEditSave();
                                  if (e.key === 'Escape') setEditingPartnerCard(null);
                                }}
                                className="w-14 bg-gray-700 border border-purple-500 rounded px-1 text-right text-[10px] font-mono text-white focus:outline-none"
                                autoFocus
                              />
                            ) : (
                              <span
                                onClick={() => handlePartnerCardEditStart(card.name, 'projected', projected)}
                                className="text-purple-400 font-mono cursor-pointer hover:underline"
                              >
                                {formatCurrency(projected)}
                              </span>
                            )}
                          </div>
                          <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                            <span className="text-gray-500">Actual: </span>
                            {isEditingActual ? (
                              <input
                                type="number"
                                step="0.01"
                                value={partnerEditValue}
                                onChange={(e) => setPartnerEditValue(e.target.value)}
                                onBlur={handlePartnerCardEditSave}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handlePartnerCardEditSave();
                                  if (e.key === 'Escape') setEditingPartnerCard(null);
                                }}
                                className="w-14 bg-gray-700 border border-purple-500 rounded px-1 text-right text-[10px] font-mono text-white focus:outline-none"
                                autoFocus
                              />
                            ) : (
                              <span
                                onClick={() => handlePartnerCardEditStart(card.name, 'actual', actual)}
                                className={`font-mono cursor-pointer hover:underline ${actual > projected ? 'text-red-400' : 'text-yellow-400'}`}
                              >
                                {formatCurrency(actual)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${actual > projected ? 'bg-red-500' : 'bg-purple-500'}`}
                          style={{ width: `${projected > 0 ? Math.min((actual / projected) * 100, 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-3 pt-2 border-t border-gray-700/30 space-y-2">
          {/* Joint Totals (only from joint cards) */}
          <div className="p-1.5 bg-cyan-500/5 rounded border border-cyan-500/20">
            <div className="flex justify-between text-[10px]">
              <span className="text-cyan-400 font-mono font-semibold">Joint Totals</span>
              <div className="flex gap-3">
                <span className="text-gray-500">Projected: <span className="text-cyan-400 font-bold">{formatCurrency(cardJointProjectedTotal)}</span></span>
                <span className="text-gray-500">Actual: <span className={`font-bold ${cardJointActualTotal > cardJointProjectedTotal ? 'text-red-400' : 'text-yellow-400'}`}>{formatCurrency(cardJointActualTotal)}</span></span>
              </div>
            </div>
          </div>
          {/* All Cards Overall Totals */}
          <div className="p-1.5 bg-blue-500/5 rounded border border-blue-500/20">
            <div className="flex justify-between text-[10px]">
              <span className="text-blue-400 font-mono font-semibold">All Cards Total</span>
              <div className="flex gap-3">
                <span className="text-gray-500">Projected: <span className="text-blue-400 font-bold">{formatCurrency(allUserCardProjectedTotal)}</span></span>
                <span className="text-gray-500">Actual: <span className={`font-bold ${allUserCardActualTotal > allUserCardProjectedTotal ? 'text-red-400' : 'text-yellow-400'}`}>{formatCurrency(allUserCardActualTotal)}</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
