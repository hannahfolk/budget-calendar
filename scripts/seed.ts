import mongoose from 'mongoose';
import BudgetEntry from '../models/BudgetEntry';
import Category from '../models/Category';
import User from '../models/User';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/budget-calendar';

const categories = [
  { name: 'personal-checking', color: '#34d399', type: 'income', icon: '💰' },
  { name: 'joint-checking', color: '#60a5fa', type: 'income', icon: '👥' },
  { name: 'personal-deduction', color: '#f87171', type: 'expense', icon: '💸' },
  { name: 'joint-deduction', color: '#fb923c', type: 'expense', icon: '🏠' },
];

const generateSampleEntries = (userId: mongoose.Types.ObjectId) => {
  const entries = [];
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Paycheck to personal checking (1st and 15th)
  entries.push({
    userId,
    date: new Date(currentYear, currentMonth, 1),
    category: 'personal-checking',
    description: 'Paycheck',
    amount: 2500,
    type: 'income',
    recurring: true,
    recurringFrequency: 'monthly',
  });

  entries.push({
    userId,
    date: new Date(currentYear, currentMonth, 15),
    category: 'personal-checking',
    description: 'Paycheck',
    amount: 2500,
    type: 'income',
  });

  // Joint account deposits
  entries.push({
    userId,
    date: new Date(currentYear, currentMonth, 2),
    category: 'joint-checking',
    description: 'Transfer to joint',
    amount: 1500,
    type: 'income',
  });

  entries.push({
    userId,
    date: new Date(currentYear, currentMonth, 16),
    category: 'joint-checking',
    description: 'Transfer to joint',
    amount: 1500,
    type: 'income',
  });

  // Joint deductions (shared expenses)
  entries.push({
    userId,
    date: new Date(currentYear, currentMonth, 1),
    category: 'joint-deduction',
    description: 'Rent',
    amount: 1800,
    type: 'expense',
  });

  entries.push({
    userId,
    date: new Date(currentYear, currentMonth, 5),
    category: 'joint-deduction',
    description: 'Utilities',
    amount: 150,
    type: 'expense',
  });

  entries.push({
    userId,
    date: new Date(currentYear, currentMonth, 3),
    category: 'joint-deduction',
    description: 'Groceries',
    amount: 120,
    type: 'expense',
  });

  entries.push({
    userId,
    date: new Date(currentYear, currentMonth, 10),
    category: 'joint-deduction',
    description: 'Groceries',
    amount: 135,
    type: 'expense',
  });

  entries.push({
    userId,
    date: new Date(currentYear, currentMonth, 17),
    category: 'joint-deduction',
    description: 'Groceries',
    amount: 110,
    type: 'expense',
  });

  // Personal deductions
  entries.push({
    userId,
    date: new Date(currentYear, currentMonth, 7),
    category: 'personal-deduction',
    description: 'Gas',
    amount: 60,
    type: 'expense',
  });

  entries.push({
    userId,
    date: new Date(currentYear, currentMonth, 14),
    category: 'personal-deduction',
    description: 'Gas',
    amount: 55,
    type: 'expense',
  });

  entries.push({
    userId,
    date: new Date(currentYear, currentMonth, 12),
    category: 'personal-deduction',
    description: 'Lunch',
    amount: 25,
    type: 'expense',
  });

  entries.push({
    userId,
    date: new Date(currentYear, currentMonth, 20),
    category: 'personal-deduction',
    description: 'Subscription',
    amount: 15,
    type: 'expense',
  });

  entries.push({
    userId,
    date: new Date(currentYear, currentMonth, 8),
    category: 'personal-deduction',
    description: 'Coffee',
    amount: 12,
    type: 'expense',
  });

  return entries;
};

async function seed() {
  try {
    console.log('🌱 Starting database seed...');

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await BudgetEntry.deleteMany({});
    await Category.deleteMany({});
    await User.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Create test user
    const testUser = new User({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      monthlyExpenses: [
        { name: 'Rent', amount: 2000, account: 'joint' },
        { name: 'Acting', amount: 250, account: 'personal' },
        { name: 'Singing', amount: 175, account: 'personal' },
      ],
      recurringDeposits: [
        { name: 'Paycheck', amount: 625, account: 'joint', frequency: 'biweekly', startDate: new Date('2025-01-03') },
        { name: 'Paycheck', amount: 473.93, account: 'personal', frequency: 'biweekly', startDate: new Date('2025-01-03') },
      ],
    });
    await testUser.save();
    console.log('✅ Created test user (test@example.com / password123)');

    // Insert categories
    const insertedCategories = await Category.insertMany(categories);
    console.log(`✅ Inserted ${insertedCategories.length} categories`);

    // Insert sample entries for test user
    const sampleEntries = generateSampleEntries(testUser._id as unknown as mongoose.Types.ObjectId);
    const insertedEntries = await BudgetEntry.insertMany(sampleEntries);
    console.log(`✅ Inserted ${insertedEntries.length} budget entries`);

    console.log('\n📊 Database seeded successfully!');
    console.log('\nTest account:');
    console.log('  Email: test@example.com');
    console.log('  Password: password123');
    console.log('\nSample data includes:');
    console.log('- Paychecks to personal checking (1st & 15th)');
    console.log('- Transfers to joint checking');
    console.log('- Joint expenses (rent, utilities, groceries)');
    console.log('- Personal expenses (gas, lunch, subscriptions)');
    console.log('- Monthly expenses: Rent ($2000, joint), Acting ($250, personal), Singing ($175, personal)');
    console.log('- Recurring deposits: Paycheck ($625, joint biweekly), Paycheck ($473.93, personal biweekly)');

    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seed();
