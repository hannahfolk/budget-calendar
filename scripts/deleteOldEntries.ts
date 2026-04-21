import mongoose from 'mongoose';
import BudgetEntry from '../models/BudgetEntry';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/budget-calendar';

async function deleteOldEntries() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Delete all entries before January 1, 2026
    const cutoffDate = new Date('2026-01-01T00:00:00.000Z');
    
    const result = await BudgetEntry.deleteMany({
      date: { $lt: cutoffDate }
    });

    console.log(`Deleted ${result.deletedCount} entries from before January 2026`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

deleteOldEntries();
