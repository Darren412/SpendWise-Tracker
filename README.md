# Budget Tracker

A comprehensive monthly household budget tracker built with Next.js, React, and TypeScript. Track your expenses, visualize spending patterns, and stay within your budget.

**Modern, aesthetic UI with:**
- ✨ Glassmorphic design with blur effects and graffiti art
- 🎨 Animated gradient background with floating blobs
- 💰 Indian Rupee (₹) currency integration
- 📱 Compact, space-efficient responsive design
- 🌈 Beautiful color schemes and smooth transitions

## Features & Design

### Design Highlights

#### Header Banner (Compact & Modern)
- **Compact Layout** - Optimized to 6-8px padding, reduces scrolling
- **Glassmorphic Design** - Modern frosted glass effect with backdrop blur
- **Rupee Sign (₹)** - Currency symbol prominently displayed
- **Graffiti Art Elements** - Rotating emoji decorations (💰 📊 ✨ 🎯)
- **Animated Gradients** - Floating blob animations in the background
- **Responsive Design** - Side-by-side layout optimized for all screens
- **Smooth Transitions** - Gradient divider line for visual interest

#### Overall Aesthetics
- Clean, modern typography with proper hierarchy
- Consistent color scheme throughout the app
- Smooth transitions and animations
- Professional spacing and padding
- Accessible contrast ratios

## Features

✨ **Core Features:**
- 📊 Add and manage monthly expenses
- 💰 **Track monthly income from various sources**
- 📈 Visual charts and graphs for spending analysis
- 🏷️ **Fully customizable expense categories** - Add, edit, delete, and reorder
- 📋 Detailed expense and income lists
- 📅 Filter expenses by month and year
- 💾 Data persistence using browser localStorage
- 📱 Responsive design for mobile and desktop
- 🇮🇳 All amounts in Indian Rupees (₹)

✨ **Categories:**
The tracker comes with 8 pre-configured expense categories:
- Food & Groceries (₹8,000)
- Transportation (₹4,000)
- Utilities (₹3,000)
- Entertainment (₹2,000)
- Health & Fitness (₹2,000)
- Shopping (₹4,000)
- Dining Out (₹3,000)
- Other (₹2,000)

✨ **Dashboard:**
- Monthly overview with income and expense tracking
- Net balance calculation (income - expenses)
- Budget vs spending comparison per category
- Remaining budget after expenses
- **Editable category budgets** with Save/Cancel buttons
- **Add new custom categories** with custom names, icons, colors, and budgets
- **Delete or reorder categories** with up/down arrows
- Bar chart comparing budget vs actual spending
- Pie chart showing spending distribution

## Tech Stack

- **Frontend Framework:** Next.js 15.1 with App Router
- **Language:** TypeScript 5.6
- **UI Library:** React 19
- **Styling:** Tailwind CSS 3.4
- **State Management:** Zustand 4.5
- **Charts:** Recharts 2.13
- **Icons:** Lucide React 0.408

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Run the development server:**
```bash
npm run dev
```

3. **Open your browser:**
Navigate to `http://localhost:3000`

### Filtering by Month and Year

Use the Month/Year filter at the top of the dashboard to:
- Navigate between different months
- View historical spending data
- Compare spending across different periods

Click the arrow buttons to move between months, or simply see the current month indicator.

### Adding Income

1. Fill in the **Add Income** form:
   - Enter the income source (e.g., Salary, Bonus, Freelance)
   - Enter the amount
   - Choose the date

2. Click "Add Income"

3. Income will be saved and displayed in the Income Records table

### Editing Category Budgets

1. Click the **Edit Category Budgets** section to expand it
2. Click **Edit** next to any category3. Change any property:
   - **Name** - Change the category name
   - **Budget** - Adjust the monthly budget amount
   - **Icon** - Pick from 15+ emoji icons
   - **Color** - Select a color for the category
4. Click **Save** to confirm or **Cancel** to discard changes

### Adding New Categories

1. Click **Add New Category** button in the Manage Categories section
2. Fill in the form:
   - **Category Name** - Give it a unique name
   - **Budget Amount** - Set the monthly budget
   - **Icon** - Choose from available emojis
   - **Color** - Pick a color
3. Click **Add Category**
4. The new category will appear in the list immediately

### Deleting Categories

Click the **trash icon** next to any category to remove it. The category will be deleted along with any associated expense data.

### Reordering Categories

Use the **up/down arrow buttons** next to each category to change the display order:
- **Up arrow** - Move category up (disabled if at the top)
- **Down arrow** - Move category down (disabled if at the bottom)

The order is automatically saved and persists across sessions.

### Editing Category Budgets

1. Click the **Manage Categories** section to expand it
2. Click **Edit** next to any category3. Change the budget amount
4. Click **Save** to confirm or **Cancel** to discard changes
5. The total budget updates automatically

### Adding an Expense

1. Fill in the expense form:
   - Select a category
   - Enter the amount
   - Add a description
   - Choose the date

2. Click "Add Expense"

3. The expense will be saved to localStorage and displayed in the recent expenses table

### Viewing Your Budget

- **Dashboard Cards:** See income, expenses, budget, remaining funds, and net balance
- **Bar Chart:** Compare your budget vs actual spending by category
- **Pie Chart:** View the distribution of your spending
- **Expense List:** See all transactions with details
- **Income List:** View all income records for the month
- **Edit Budgets:** Adjust category budgets anytime

### Managing Data

- **Delete Expenses:** Click the trash icon next to any expense to remove it
- **Delete Income:** Click the trash icon next to any income record to remove it
- **Manage Categories:** Expand the Manage Categories section to:
  - Add new custom categories
  - Edit category name, icon, color, and budget
  - Delete categories
  - Reorder categories using up/down arrows
- **Data Persistence:** All data is automatically saved to your browser's localStorage
- **Month-based Tracking:** Expenses and income are automatically organized by month

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main dashboard page
│   └── globals.css         # Global styles + animations
├── components/
│   ├── Header.tsx          # Modern animated header with glassmorphism
│   ├── MonthYearFilter.tsx # Month/year selector
│   ├── ExpenseForm.tsx     # Add expense form
│   ├── IncomeForm.tsx      # Add income form
│   ├── ExpenseList.tsx     # Expense table
│   ├── IncomeList.tsx      # Income table
│   ├── CategoryStats.tsx   # Stats cards
│   ├── BudgetEditor.tsx    # Category management
│   └── Charts.tsx          # Recharts visualizations
├── store/
│   └── budgetStore.ts      # Zustand state management
└── types/
    └── index.ts            # TypeScript interfaces
```

## Scripts

- `npm run dev` — Start development server (accessible at localhost:3000)
- `npm run build` — Build for production
- `npm run start` — Start production server
- `npm run lint` — Run ESLint

## Data Storage

The application uses browser localStorage to persist data:
- `budget_expenses` — Stores all expense records
- `budget_categories` — Stores category configurations

**Note:** Data is stored locally in the browser and will be retained across sessions until cleared.

## Customization

### Modify Categories

Edit the `defaultCategories` array in `src/store/budgetStore.ts` to add, remove, or modify expense categories.

### Adjust Colors and Theme

Update the color values in:
- `tailwind.config.ts` — Global color scheme
- `defaultCategories` in `src/store/budgetStore.ts` — Category colors

### Change Budget Limits

Modify the `budget` property in each category object in `src/store/budgetStore.ts`.

## Future Enhancements

Potential features to add:
- Monthly trend analysis over multiple months
- Export data as CSV/PDF
- Multi-month comparison charts
- Budget forecasting based on historical data
- Recurring expense/income entries
- Drag-and-drop category reordering
- Dark mode
- Mobile app version
- Tax category tracking
- Savings goal tracking
- Budget alerts when spending exceeds limit
- Search and filter expenses

## License

This project is open source and available under the MIT License.

## Support

For issues or suggestions, please create an issue in the project repository.

---

Happy budgeting! 💰
