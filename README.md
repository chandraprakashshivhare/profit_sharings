# Technomatz Finance Management System

A comprehensive financial management system for **Technomatz IT Solution Pvt Ltd** to manage company and director-level income, expenses, loans, and balances with a complete approval workflow.

## 🚀 Features

### 1. Director Approval System
- First-time default director auto-created and approved
- New directors require approval from existing directors
- Pending directors cannot login until approved
- Equal share distribution based on approved directors only

### 2. Financial Modules
- **Projects**: Track revenue sources with CRUD operations
- **Transactions**: Income, Expenses, Loans, and Transfers
- **Dashboard**: Company and Director-level financial insights
- **Directors**: Manage directors with approval workflow

### 3. Business Logic
- Company Income = (All Income) - (All Expenses)
- Company Balance = Income + Loans Received - Expenses
- Director Share = Company Income / Number of Approved Directors
- Financial Year: April to March

## 📋 Default Director

When you first install the system, a default director is automatically created:

```
Email:    cpshivhare@technomatz.com
Password: Admin@123
Status:   Approved
```

**⚠️ IMPORTANT:** Change this password immediately after your first login!

## 🛠️ Setup Instructions

### 1. Install Dependencies
```bash
yarn install
```

### 2. Setup Default Director (First Time Only)
```bash
yarn seed
```

This will create the default director if it doesn't exist.

### 3. Start the Application
```bash
yarn dev
```

The application will be available at: `http://localhost:3000`

## 🔐 First Login

1. Go to the login page
2. Use the default credentials:
   - Email: `cpshivhare@technomatz.com`
   - Password: `Admin@123`
3. **Change your password immediately!**

## 👥 Adding New Directors

### As an Approved Director:

1. **Option 1: Invite via Directors Page**
   - Login to the system
   - Go to **Directors** → Click **"+ Add Director"**
   - Fill in the new director's details
   - The director is immediately added as approved

2. **Option 2: New Director Signup**
   - New director goes to **Register** page
   - Fills signup form
   - Account created with **"Pending"** status
   - Cannot login until approved

### Approving Pending Directors:

1. Login as an approved director
2. Go to **Directors** page
3. Click on **"Pending Approvals"** tab
4. Click **"Approve"** (green button) or **"Reject"** (red button)
5. Approved director can now login

## 📊 Using the System

### Creating Projects
1. Go to **Projects** → Click **"+ Add Project"**
2. Fill in project details (name, revenue, status, dates)
3. Projects can be linked to income transactions

### Recording Transactions
1. Go to **Transactions** → Click **"+ Add Transaction"**
2. Select transaction type:
   - **Income**: Revenue (company or director level)
   - **Expense**: Expenditure (company or director level)
   - **Loan**: Director lending money to company
   - **Transfer**: Money transfer between directors
3. Fill required fields based on type
4. Submit

### Viewing Dashboard
1. Go to **Dashboard**
2. Switch between:
   - **Company Overview**: Total income, expenses, net income, balance
   - **My Dashboard**: Personal share, loans, transfers, balance
3. Filter by period: All Time, Financial Year, or Month

## 💡 Key Workflows

### Scenario 1: Company Receives Income
1. Create income transaction (type: income, account: company)
2. Amount is divided equally among all approved directors
3. Each director sees their share in "My Dashboard"

### Scenario 2: Company Needs Loan
1. Company balance is low
2. Director creates loan transaction (type: loan)
3. Loan amount added to company balance
4. Tracked in director's "Loans Given"

### Scenario 3: Settling Balances
1. Director with positive balance creates transfer
2. Sends to director with negative balance
3. Balances update automatically

## 🗄️ Database

- **MongoDB** is used for data storage
- Database name: `technomatz_finance`
- Collections: `directors`, `projects`, `transactions`

## 🔧 Scripts

```bash
# Install dependencies
yarn install

# Create default director
yarn seed

# Run setup (seed + confirmation)
yarn setup

# Start development server
yarn dev
```

## 📈 Financial Calculations

### Company Level
```
Company Income = (Company Income + Director Income) - (Company Expenses + Director Expenses)
Company Balance = Total Income + Loans Received - Total Expenses
```

### Director Level
```
Share of Income = Company Income / Number of Approved Directors
Final Balance = Own Income - Own Expenses - Loans Given - Transfers Out + Transfers In + Share of Income
```

## 🔒 Security

- Passwords are hashed using bcrypt
- JWT tokens for authentication
- HttpOnly cookies + localStorage
- Protected API routes
- Session management

## 📱 Tech Stack

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: MongoDB
- **Authentication**: JWT + bcrypt

## 🎯 Equal Share Distribution

All approved directors have **equal ownership**:
- If 4 approved directors → 25% each
- If 5 approved directors → 20% each
- Automatically recalculates when directors added/removed

## 🆘 Troubleshooting

### Can't Login?
- Ensure you're using the correct email (all lowercase)
- Check if your account is approved (contact an existing director)
- Default director email: `cpshivhare@technomatz.com`

### Forgot Default Password?
Run the seed script again - it will show the default credentials:
```bash
yarn seed
```

### Need to Reset Database?
```bash
# Delete all directors (BE CAREFUL!)
mongosh technomatz_finance --eval "db.directors.deleteMany({})"

# Re-run seed to create default director
yarn seed
```

## 📞 Support

For issues or questions, contact the development team.

---

**Built with ❤️ for Technomatz IT Solution Pvt Ltd**
