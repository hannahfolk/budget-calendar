# Budget Calendar 💰

A beautiful, modern budget tracking application with a spreadsheet-like interface built with Next.js, MongoDB, and Express.

![Budget Calendar](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![MongoDB](https://img.shields.io/badge/MongoDB-6-green?style=for-the-badge&logo=mongodb)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)

## ✨ Features

- **Spreadsheet-Style Interface** - Excel-like grid for quick data entry
- **Real-time Updates** - Instant synchronization with MongoDB
- **Monthly Navigation** - Easy browsing through different months
- **Visual Dashboard** - Beautiful summary cards with income, expenses, and balance
- **Click-to-Edit Cells** - Fast inline editing for adding entries
- **Responsive Design** - Works seamlessly on desktop and mobile
- **Modern UI** - Dark theme with glassmorphism effects and smooth animations
- **Category Support** - Organize expenses and income by categories
- **Date-based Filtering** - View data by specific time ranges

## 🏗️ Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Smooth animations
- **date-fns** - Date manipulation

### Backend
- **Express.js** - RESTful API server
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB ODM

## 📁 Project Structure

```
budget-calendar/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Main application page
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── BudgetSpreadsheet.tsx
│   └── SummaryDashboard.tsx
├── lib/                   # Utility libraries
│   ├── api.ts            # API client functions
│   └── mongodb.ts        # MongoDB connection
├── models/               # Mongoose schemas
│   ├── BudgetEntry.ts   # Budget entry model
│   └── Category.ts      # Category model
├── server/              # Express backend
│   └── index.ts        # API routes and server
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── .env.local          # Environment variables
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- MongoDB installed and running locally (or MongoDB Atlas connection string)

### Installation

1. **Clone or navigate to the project directory:**
```bash
cd budget-calendar
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**

Edit `.env.local` with your MongoDB connection:
```env
MONGODB_URI=mongodb://localhost:27017/budget-calendar
NEXT_PUBLIC_API_URL=http://localhost:3001
```

4. **Start MongoDB** (if running locally):
```bash
mongod
```

5. **Run the application:**

**Option A - Run both servers simultaneously:**
```bash
npm run dev:all
```

**Option B - Run servers separately:**

Terminal 1 (Backend):
```bash
npm run server
```

Terminal 2 (Frontend):
```bash
npm run dev
```

6. **Open your browser:**
```
http://localhost:3000
```

## 📖 Usage

### Adding Entries

1. Click on any **Income** or **Expense** cell in the spreadsheet
2. Type the amount
3. Press **Enter** to save or **Escape** to cancel

### Navigating Months

- Use the **← Prev** and **Next →** buttons to browse months
- Click **Today** to jump to the current month

### Viewing Summary

The dashboard at the top shows:
- Total Income (green card)
- Total Expenses (red card)
- Net Balance (yellow/orange card)
- Savings Rate percentage

## 🔌 API Endpoints

### Budget Entries

- `GET /api/entries` - Get all entries (with optional filters)
- `GET /api/entries/:id` - Get single entry
- `POST /api/entries` - Create new entry
- `PUT /api/entries/:id` - Update entry
- `DELETE /api/entries/:id` - Delete entry
- `GET /api/entries/stats/summary` - Get summary statistics

### Categories

- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

## 🎨 Design Features

- **Dark Theme** - Easy on the eyes with a space-inspired color palette
- **Glassmorphism** - Modern frosted glass effect panels
- **Gradient Mesh Background** - Subtle animated gradients
- **Monospace Typography** - Financial data displayed in Space Mono font
- **Hover Effects** - Interactive row highlighting and cell focus
- **Animated Cards** - Smooth transitions and micro-interactions

## 🔧 Configuration

### Changing Database Connection

Edit `.env.local`:
```env
# For local MongoDB
MONGODB_URI=mongodb://localhost:27017/budget-calendar

# For MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/budget-calendar
```

### Customizing Theme

Edit `app/globals.css` to modify colors:
```css
:root {
  --color-bg-primary: #0a0e27;
  --color-accent-1: #60a5fa;
  --color-accent-2: #fbbf24;
  /* ... more variables */
}
```

## 📝 Data Models

### BudgetEntry
```typescript
{
  date: Date;
  category: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  recurring?: boolean;
  recurringFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  tags?: string[];
  notes?: string;
}
```

### Category
```typescript
{
  name: string;
  color: string;
  icon?: string;
  type: 'income' | 'expense' | 'both';
  budget?: number;
}
```

## 🐛 Troubleshooting

### Backend won't connect
- Ensure MongoDB is running: `mongod`
- Check `.env.local` has correct `MONGODB_URI`
- Verify port 3001 is available

### Frontend shows "Backend disconnected"
- Start the backend server: `npm run server`
- Check that `NEXT_PUBLIC_API_URL` points to `http://localhost:3001`

### Database connection errors
- Verify MongoDB is running
- Check MongoDB logs for errors
- Ensure database user has proper permissions (if using Atlas)

## 🚢 Deployment

### Frontend (Vercel)
1. Push to GitHub
2. Connect to Vercel
3. Set environment variable: `NEXT_PUBLIC_API_URL` to your backend URL

### Backend (Railway/Render)
1. Deploy Express server
2. Set `MONGODB_URI` environment variable
3. Update frontend `NEXT_PUBLIC_API_URL`

### Database (MongoDB Atlas)
1. Create cluster at mongodb.com
2. Get connection string
3. Update `MONGODB_URI` in environment variables

## 📚 Future Enhancements

- [ ] User authentication
- [ ] Multiple budget categories with budgets
- [ ] Recurring transactions automation
- [ ] CSV import/export
- [ ] Charts and visualizations
- [ ] Mobile app (React Native)
- [ ] Multi-currency support
- [ ] Budget goals and alerts

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 💬 Support

If you encounter any issues or have questions, please open an issue on GitHub.

---

**Built with ❤️ using Next.js, MongoDB, and TypeScript**
