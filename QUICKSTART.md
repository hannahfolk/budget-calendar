# Quick Start Guide 🚀

Get your Budget Calendar up and running in 5 minutes!

## Prerequisites Check

Before starting, make sure you have:
- ✅ Node.js 18+ installed (`node --version`)
- ✅ MongoDB installed (`mongod --version`)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

This will install all required packages for both frontend and backend.

### 2. Start MongoDB

**On macOS (with Homebrew):**
```bash
brew services start mongodb-community
```

**On Linux:**
```bash
sudo systemctl start mongod
```

**On Windows:**
```bash
net start MongoDB
```

**Or run manually:**
```bash
mongod
```

### 3. Seed the Database (Optional)

Populate your database with sample data:

```bash
npm run seed
```

This creates sample categories and entries for the current month.

### 4. Start the Application

**Option A - Start everything at once:**
```bash
npm run dev:all
```

**Option B - Start separately (recommended for debugging):**

Terminal 1 - Backend:
```bash
npm run server
```

Terminal 2 - Frontend:
```bash
npm run dev
```

### 5. Open Your Browser

Navigate to: **http://localhost:3000**

You should see:
- ✅ Green connection indicator
- ✅ Current month's budget calendar
- ✅ Summary dashboard with stats

## Your First Budget Entry

1. Click on any **Income** or **Expense** cell
2. Type an amount (e.g., `500`)
3. Press **Enter** to save
4. Watch the totals update automatically!

## Troubleshooting

### "Backend disconnected" error

**Solution:** Start the backend server
```bash
npm run server
```

### MongoDB connection error

**Solution:** Make sure MongoDB is running
```bash
# Check if MongoDB is running
ps aux | grep mongod

# If not, start it
mongod
```

### Port already in use

**Solution:** Kill the process or change ports

```bash
# Find process on port 3000 or 3001
lsof -ti:3000
lsof -ti:3001

# Kill the process
kill -9 <PID>
```

## Environment Variables

The app comes pre-configured, but you can customize:

**.env.local:**
```env
MONGODB_URI=mongodb://localhost:27017/budget-calendar
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Next Steps

- 📊 Explore the spreadsheet interface
- 💰 Add your real income and expenses
- 📅 Navigate between months
- 🎨 Check out the summary dashboard
- 📝 Read the full README.md for advanced features

## Common Commands

```bash
# Install dependencies
npm install

# Start both servers
npm run dev:all

# Start backend only
npm run server

# Start frontend only
npm run dev

# Seed database with sample data
npm run seed

# Build for production
npm run build

# Run production build
npm start
```

## Default Ports

- Frontend (Next.js): http://localhost:3000
- Backend (Express): http://localhost:3001
- MongoDB: mongodb://localhost:27017

## Need Help?

- 📖 Check the full [README.md](./README.md)
- 🐛 Open an issue on GitHub
- 💬 Review the troubleshooting section

---

**Happy budgeting! 💰**
