import mongoose from 'mongoose';
import User from '../models/User';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/budget-calendar';

async function checkDeposits() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const users = await User.find({});

    users.forEach(user => {
      console.log('\nUser:', user.email);
      console.log('Recurring Deposits:');
      user.recurringDeposits.forEach((dep: any, idx: number) => {
        console.log('  ' + idx + ': ' + dep.name + ' - $' + dep.amount + ' (' + dep.frequency + ')');
        console.log('     skippedDates:', dep.skippedDates || []);
      });
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDeposits();
