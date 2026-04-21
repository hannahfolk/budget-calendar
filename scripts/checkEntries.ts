import mongoose from 'mongoose';
import BudgetEntry from '../models/BudgetEntry';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/budget-calendar';

async function checkEntries() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get all entries and their dates
    const entries = await BudgetEntry.find({}).sort({ date: 1 }).limit(20);

    console.log('Found ' + entries.length + ' entries (showing first 20):');
    entries.forEach(entry => {
      console.log('  ' + entry.date.toISOString() + ' - ' + entry.description + ' - $' + entry.amount);
    });

    // Count by month
    const allEntries = await BudgetEntry.find({});
    const byMonth: Record<string, number> = {};
    allEntries.forEach(entry => {
      const key = entry.date.getFullYear() + '-' + String(entry.date.getMonth() + 1).padStart(2, '0');
      byMonth[key] = (byMonth[key] || 0) + 1;
    });

    console.log('\nEntries by month:');
    Object.keys(byMonth).sort().forEach(key => {
      console.log('  ' + key + ': ' + byMonth[key] + ' entries');
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkEntries();
