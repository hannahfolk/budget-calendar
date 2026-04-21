import { addDays, subDays, getDay, isSameDay, isWithinInterval, startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns';
import { RecurringDeposit } from './api';

// Federal holidays that would affect paydays (when banks are closed)
// Returns holidays for a given year
export function getFederalHolidays(year: number): Date[] {
  const holidays: Date[] = [];

  // New Year's Day - January 1 (observed on nearest weekday if weekend)
  holidays.push(observedDate(new Date(year, 0, 1)));

  // Martin Luther King Jr. Day - Third Monday of January
  holidays.push(getNthWeekdayOfMonth(year, 0, 1, 3)); // 3rd Monday (1) of January (0)

  // Presidents' Day - Third Monday of February
  holidays.push(getNthWeekdayOfMonth(year, 1, 1, 3)); // 3rd Monday of February

  // Memorial Day - Last Monday of May
  holidays.push(getLastWeekdayOfMonth(year, 4, 1)); // Last Monday of May

  // Juneteenth - June 19 (observed on nearest weekday if weekend)
  holidays.push(observedDate(new Date(year, 5, 19)));

  // Independence Day - July 4 (observed on nearest weekday if weekend)
  holidays.push(observedDate(new Date(year, 6, 4)));

  // Labor Day - First Monday of September
  holidays.push(getNthWeekdayOfMonth(year, 8, 1, 1)); // 1st Monday of September

  // Columbus Day - Second Monday of October
  holidays.push(getNthWeekdayOfMonth(year, 9, 1, 2)); // 2nd Monday of October

  // Veterans Day - November 11 (observed on nearest weekday if weekend)
  holidays.push(observedDate(new Date(year, 10, 11)));

  // Thanksgiving Day - Fourth Thursday of November
  holidays.push(getNthWeekdayOfMonth(year, 10, 4, 4)); // 4th Thursday of November

  // Christmas Day - December 25 (observed on nearest weekday if weekend)
  holidays.push(observedDate(new Date(year, 11, 25)));

  return holidays;
}

// Get the observed date for a holiday (moves to Friday if Saturday, Monday if Sunday)
function observedDate(date: Date): Date {
  const day = getDay(date);
  if (day === 6) return subDays(date, 1); // Saturday -> Friday
  if (day === 0) return addDays(date, 1); // Sunday -> Monday
  return date;
}

// Get the nth occurrence of a weekday in a month
// weekday: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const firstDay = new Date(year, month, 1);
  const firstWeekday = getDay(firstDay);
  let daysUntilWeekday = weekday - firstWeekday;
  if (daysUntilWeekday < 0) daysUntilWeekday += 7;
  const firstOccurrence = addDays(firstDay, daysUntilWeekday);
  return addDays(firstOccurrence, (n - 1) * 7);
}

// Get the last occurrence of a weekday in a month
function getLastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const lastDay = new Date(year, month + 1, 0); // Last day of month
  const lastWeekday = getDay(lastDay);
  let daysBack = lastWeekday - weekday;
  if (daysBack < 0) daysBack += 7;
  return subDays(lastDay, daysBack);
}

// Check if a date is a federal holiday
export function isFederalHoliday(date: Date): boolean {
  const holidays = getFederalHolidays(date.getFullYear());
  return holidays.some(holiday => isSameDay(date, holiday));
}

// Get the actual payday for a given Friday (Thursday if Friday is a holiday)
export function getActualPayday(friday: Date): Date {
  if (isFederalHoliday(friday)) {
    return subDays(friday, 1); // Thursday
  }
  return friday;
}

// Check if a date is a Friday
function isFriday(date: Date): boolean {
  return getDay(date) === 5;
}

// Get all Fridays in a month
function getFridaysInMonth(year: number, month: number): Date[] {
  const start = startOfMonth(new Date(year, month));
  const end = endOfMonth(new Date(year, month));
  const days = eachDayOfInterval({ start, end });
  return days.filter(day => isFriday(day));
}

// Check if a Friday is a valid payday for a biweekly deposit based on start date
function isBiweeklyPayday(friday: Date, startDate: Date): boolean {
  const start = new Date(startDate);
  const target = new Date(friday);

  // Calculate weeks difference
  const diffTime = target.getTime() - start.getTime();
  const diffWeeks = Math.round(diffTime / (7 * 24 * 60 * 60 * 1000));

  // Biweekly means every 2 weeks (even number of weeks from start)
  return diffWeeks >= 0 && diffWeeks % 2 === 0;
}

// Parse a date string (yyyy-MM-dd) without timezone conversion
function parseDateString(dateStr: string): { year: number; month: number; day: number } {
  const parts = dateStr.split('-');
  return {
    year: parseInt(parts[0], 10),
    month: parseInt(parts[1], 10) - 1, // Convert to 0-indexed month
    day: parseInt(parts[2], 10),
  };
}

// Compare two dates by date only (ignoring time)
function isDateOnOrAfter(date: Date, referenceDate: Date): boolean {
  const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const d2 = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  return d1 >= d2;
}

// Get all deposit dates for a given month
export function getDepositDatesForMonth(
  deposit: RecurringDeposit,
  year: number,
  month: number
): Date[] {
  // Parse the start date string directly to avoid timezone issues
  const parsed = parseDateString(deposit.startDate);
  const startDate = new Date(parsed.year, parsed.month, parsed.day, 12, 0, 0); // noon to avoid DST issues

  // Check if the requested month is before the start date - if so, return empty array
  const requestedMonthStart = new Date(year, month, 1);
  const startMonthStart = new Date(parsed.year, parsed.month, 1);
  if (requestedMonthStart < startMonthStart) {
    return []; // Month is before the deposit start date
  }

  if (deposit.frequency === 'monthly') {
    // Monthly - deposit on the same day of month as startDate
    const dayOfMonth = parsed.day; // Use the parsed day directly
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    // If the day doesn't exist in this month (e.g., 31st in February), use last day
    const depositDay = Math.min(dayOfMonth, lastDayOfMonth);
    const depositDate = new Date(year, month, depositDay, 12, 0, 0);

    // Also check if this specific date is before the start date (for first month)
    if (!isDateOnOrAfter(depositDate, startDate)) {
      return [];
    }
    return [depositDate];
  }

  const fridays = getFridaysInMonth(year, month);

  let payFridays: Date[];

  if (deposit.frequency === 'weekly') {
    // Filter out Fridays before the start date (compare dates only, not times)
    payFridays = fridays.filter(friday => isDateOnOrAfter(friday, startDate));
  } else {
    // Biweekly - filter to every other Friday based on start date, and after start date
    payFridays = fridays.filter(friday => isDateOnOrAfter(friday, startDate) && isBiweeklyPayday(friday, startDate));
  }

  // Convert to actual paydays (Thursday if Friday is a holiday)
  return payFridays.map(friday => getActualPayday(friday));
}

// Get deposits for a specific date
export function getDepositsForDate(
  deposits: RecurringDeposit[],
  date: Date
): RecurringDeposit[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const dateKey = format(date, 'yyyy-MM-dd');

  return deposits.filter(deposit => {
    // Check if this date is skipped for this deposit
    if (deposit.skippedDates?.includes(dateKey)) {
      return false;
    }

    const depositDates = getDepositDatesForMonth(deposit, year, month);
    return depositDates.some(depositDate => isSameDay(depositDate, date));
  });
}

// Get the correct deposit amount for a specific date, respecting amount history
export function getDepositAmountForDate(deposit: RecurringDeposit, date: Date): number {
  if (!deposit.amountHistory || deposit.amountHistory.length === 0) {
    return deposit.amount; // No history, use current amount
  }

  // Sort by effectiveDate ascending
  const sorted = [...deposit.amountHistory].sort(
    (a, b) => a.effectiveDate.localeCompare(b.effectiveDate)
  );

  const dateStr = format(date, 'yyyy-MM-dd');

  // Find the last entry whose effectiveDate <= date
  let result = sorted[0].amount; // Start with the earliest recorded amount
  for (const entry of sorted) {
    if (entry.effectiveDate <= dateStr) {
      result = entry.amount;
    } else {
      break;
    }
  }

  // If the date is on or after the last history entry's effectiveDate,
  // the current deposit.amount applies (it's the latest)
  const lastEntry = sorted[sorted.length - 1];
  if (dateStr >= lastEntry.effectiveDate) {
    return deposit.amount;
  }

  return result;
}

// Format frequency for display
export function formatFrequency(frequency: 'weekly' | 'biweekly' | 'monthly'): string {
  if (frequency === 'weekly') return 'Weekly';
  if (frequency === 'biweekly') return 'Biweekly';
  return 'Monthly';
}
