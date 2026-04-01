export function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(rows) {
  const lines = rows.map((row) => row.map(escapeCsvCell).join(','));
  return '\uFEFF' + lines.join('\r\n');
}

export function companyDashboardExportCsv(data) {
  const { totalIncome, totalExpenses, companyIncome, companyBalance } = data;
  const rows = [
    ['Total Income', 'Total Expenses', 'Net Income', 'Company Balance'],
    [totalIncome, totalExpenses, companyIncome, companyBalance]
  ];
  return rowsToCsv(rows);
}

export function directorDashboardExportCsv(data) {
  const {
    shareOfIncome,
    directorOwnIncome,
    directorExpenses,
    loansGiven,
    transfersOut,
    transfersIn,
    balance
  } = data;
  const transfersCell = `Out: ${transfersOut}; In: ${transfersIn}`;
  const rows = [
    [
      'My Income Share',
      'Personal Income',
      'My Expenses',
      'Loans Given',
      'Transfers',
      'Final Balance'
    ],
    [shareOfIncome, directorOwnIncome, directorExpenses, loansGiven, transfersCell, balance]
  ];
  return rowsToCsv(rows);
}
