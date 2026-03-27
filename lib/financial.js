// Financial year calculation utilities (April to March)

export function getCurrentFinancialYear() {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-11
  const currentYear = now.getFullYear();
  
  // If month is Jan-Mar (0-2), FY started last year
  if (currentMonth < 3) {
    return {
      startYear: currentYear - 1,
      endYear: currentYear,
      startDate: new Date(currentYear - 1, 3, 1), // April 1st last year
      endDate: new Date(currentYear, 2, 31, 23, 59, 59) // March 31st this year
    };
  }
  
  // If month is Apr-Dec (3-11), FY started this year
  return {
    startYear: currentYear,
    endYear: currentYear + 1,
    startDate: new Date(currentYear, 3, 1), // April 1st this year
    endDate: new Date(currentYear + 1, 2, 31, 23, 59, 59) // March 31st next year
  };
}

export function getFinancialYearDates(year) {
  // Year is the starting year of FY (e.g., 2025 for FY 2025-26)
  return {
    startDate: new Date(year, 3, 1), // April 1st
    endDate: new Date(year + 1, 2, 31, 23, 59, 59) // March 31st next year
  };
}

export function getMonthDateRange(year, month) {
  // month is 0-indexed (0=Jan, 11=Dec)
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);
  return { startDate, endDate };
}

export function getYearDateRange(year) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59);
  return { startDate, endDate };
}

export function calculateCompanyIncome(transactions) {
  const income = transactions
    .filter(t => t.transaction_type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const expenses = transactions
    .filter(t => t.transaction_type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  
  return income - expenses;
}

export function calculateCompanyBalance(transactions) {
  const income = transactions
    .filter(t => t.transaction_type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const expenses = transactions
    .filter(t => t.transaction_type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const loansReceived = transactions
    .filter(t => t.transaction_type === 'loan' && t.account_type === 'company')
    .reduce((sum, t) => sum + t.amount, 0);
  
  return income + loansReceived - expenses;
}

export function calculateDirectorIncome(directorId, transactions, totalDirectors = 4) {
  const companyIncome = calculateCompanyIncome(transactions);
  return companyIncome / totalDirectors;
}

export function calculateDirectorBalance(directorId, transactions, totalDirectors = 4) {
  // Director's own income
  const directorIncome = transactions
    .filter(t => t.transaction_type === 'income' && t.account_type === 'director' && t.director_id === directorId)
    .reduce((sum, t) => sum + t.amount, 0);
  
  // Director's expenses
  const directorExpenses = transactions
    .filter(t => t.transaction_type === 'expense' && t.account_type === 'director' && t.director_id === directorId)
    .reduce((sum, t) => sum + t.amount, 0);
  
  // Loans given to company
  const loansGiven = transactions
    .filter(t => t.transaction_type === 'loan' && t.director_id === directorId)
    .reduce((sum, t) => sum + t.amount, 0);
  
  // Transfers out
  const transfersOut = transactions
    .filter(t => t.transaction_type === 'transfer' && t.from_director_id === directorId)
    .reduce((sum, t) => sum + t.amount, 0);
  
  // Transfers in
  const transfersIn = transactions
    .filter(t => t.transaction_type === 'transfer' && t.to_director_id === directorId)
    .reduce((sum, t) => sum + t.amount, 0);
  
  // Share of company income
  const shareOfIncome = calculateDirectorIncome(directorId, transactions, totalDirectors);
  
  return directorIncome - directorExpenses - loansGiven - transfersOut + transfersIn + shareOfIncome;
}
