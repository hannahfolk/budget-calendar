# Budget Calendar - Project Overview

## 🎯 What You've Got

A complete, production-ready budget tracking application with:

### ✨ Core Features
- **Spreadsheet Interface** - Excel-like grid for quick data entry
- **Real-time Database** - MongoDB backend with instant updates
- **Beautiful UI** - Dark theme with glassmorphism and animations
- **Monthly Navigation** - Browse through different time periods
- **Summary Dashboard** - Visual cards showing income, expenses, and balance
- **RESTful API** - Complete Express backend with CRUD operations

### 🏗️ Technology Stack

**Frontend:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Framer Motion (animations)
- date-fns (date handling)

**Backend:**
- Express.js
- MongoDB + Mongoose
- RESTful API architecture
- TypeScript

## 📦 What's Included

```
budget-calendar/
├── 📱 Frontend (Next.js App)
│   ├── app/                    # Next.js pages
│   ├── components/             # React components
│   │   ├── BudgetSpreadsheet  # Main spreadsheet grid
│   │   └── SummaryDashboard   # Stats dashboard
│   └── lib/                    # Utilities
│
├── 🔧 Backend (Express API)
│   ├── server/                 # API server
│   ├── models/                 # Mongoose schemas
│   │   ├── BudgetEntry        # Transaction model
│   │   └── Category           # Category model
│   └── lib/                    # Database connection
│
├── 📜 Scripts
│   ├── seed.ts                # Sample data generator
│   ├── verify-setup.js        # Setup checker
│   └── server.js              # Server launcher
│
└── 📚 Documentation
    ├── README.md              # Full documentation
    ├── QUICKSTART.md          # Quick start guide
    └── PROJECT_OVERVIEW.md    # This file
```

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd budget-calendar
npm install
```

### 2. Start MongoDB
```bash
mongod
```

### 3. Seed Database (Optional)
```bash
npm run seed
```

### 4. Run the App
```bash
# Start both frontend and backend
npm run dev:all

# Or start separately
npm run server  # Terminal 1 - Backend
npm run dev     # Terminal 2 - Frontend
```

### 5. Open Browser
```
http://localhost:3000
```

## 🎨 Design Features

### Visual Style
- **Dark Space Theme** - Deep blues with glowing accents
- **Glassmorphism** - Frosted glass panels with blur effects
- **Gradient Mesh Background** - Subtle animated gradients
- **Monospace Numbers** - Financial data in Space Mono font
- **Smooth Animations** - Framer Motion micro-interactions

### Color Palette
- Background: Deep navy (#0a0e27)
- Accent Blue: #60a5fa
- Accent Yellow: #fbbf24
- Success Green: #34d399
- Danger Red: #f87171

## 💡 How to Use

### Adding Transactions
1. Click any Income/Expense cell
2. Type amount
3. Press Enter to save

### Navigation
- **← Prev / Next →** - Change months
- **Today** - Jump to current month

### Understanding the Dashboard
- **Green Card** - Total income for the month
- **Red Card** - Total expenses for the month
- **Yellow Card** - Net balance (income - expenses)
- **Savings Rate** - Percentage of income saved

## 🔌 API Endpoints

### Budget Entries
- `GET /api/entries` - List all entries
- `POST /api/entries` - Create entry
- `PUT /api/entries/:id` - Update entry
- `DELETE /api/entries/:id` - Delete entry
- `GET /api/entries/stats/summary` - Get statistics

### Categories
- `GET /api/categories` - List categories
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

## 📊 Data Models

### BudgetEntry
```typescript
{
  date: Date
  category: string
  description: string
  amount: number
  type: 'income' | 'expense'
  recurring?: boolean
  recurringFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  tags?: string[]
  notes?: string
}
```

### Category
```typescript
{
  name: string
  color: string
  icon?: string
  type: 'income' | 'expense' | 'both'
  budget?: number
}
```

## 🛠️ Customization

### Change Theme Colors
Edit `app/globals.css`:
```css
:root {
  --color-bg-primary: #0a0e27;
  --color-accent-1: #60a5fa;
  /* ... customize colors */
}
```

### Modify Database Connection
Edit `.env.local`:
```env
MONGODB_URI=mongodb://localhost:27017/budget-calendar
```

### Add New Categories
Use the seed script or API to add custom categories with colors and budgets.

## 🎯 Next Steps & Enhancements

### Immediate Improvements
- [ ] Add category management UI
- [ ] Implement search/filter functionality
- [ ] Add export to CSV feature
- [ ] Create detailed transaction view modal

### Future Features
- [ ] User authentication & multi-user support
- [ ] Budget goals and alerts
- [ ] Charts and visualizations
- [ ] Recurring transaction automation
- [ ] Mobile app (React Native)
- [ ] Multi-currency support
- [ ] Receipt uploads
- [ ] Budget templates

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check MongoDB is running
ps aux | grep mongod

# Start MongoDB
mongod
```

### Port conflicts
```bash
# Kill processes on ports
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

### Database connection errors
- Verify MongoDB is running
- Check `.env.local` configuration
- Ensure correct permissions

## 📝 Commands Reference

```bash
npm run dev          # Start Next.js frontend
npm run server       # Start Express backend
npm run dev:all      # Start both servers
npm run seed         # Populate with sample data
npm run verify       # Check setup requirements
npm run build        # Production build
npm start            # Run production
```

## 🚢 Deployment Options

### Frontend (Vercel)
1. Push to GitHub
2. Import to Vercel
3. Set `NEXT_PUBLIC_API_URL` env variable

### Backend (Railway/Render)
1. Deploy Express app
2. Set `MONGODB_URI` env variable
3. Update frontend API URL

### Database (MongoDB Atlas)
1. Create free cluster
2. Get connection string
3. Update environment variables

## 🎓 Learning Resources

This project demonstrates:
- Next.js 14 App Router
- TypeScript best practices
- MongoDB with Mongoose
- RESTful API design
- Responsive design with Tailwind
- Animation with Framer Motion
- State management in React
- Date handling with date-fns

## 💬 Support & Documentation

- **README.md** - Comprehensive documentation
- **QUICKSTART.md** - 5-minute setup guide
- **Code Comments** - Inline documentation throughout

## 🎉 You're Ready!

Your budget calendar is fully functional and ready to use. Start tracking your finances with a beautiful, modern interface!

**Happy budgeting! 💰**

---

Built with Next.js, MongoDB, Express, and TypeScript
