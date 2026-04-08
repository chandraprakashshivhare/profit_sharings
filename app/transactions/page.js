'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, ArrowUpCircle, ArrowDownCircle, Repeat, ArrowRightLeft, Download, Users, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { apiDownload, apiRequest } from '@/lib/api';
import { formatDashboardPeriodLabel } from '@/lib/dashboardData';
import { Checkbox } from '@/components/ui/checkbox';

export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isHistoryView = searchParams.get('history') === '1';
  const initialPeriod = isHistoryView ? (searchParams.get('period') || 'all') : 'all';
  const initialMonth = isHistoryView
    ? (searchParams.get('month') ?? new Date().getMonth().toString())
    : new Date().getMonth().toString();
  const initialYear = isHistoryView
    ? (searchParams.get('year') ?? new Date().getFullYear().toString())
    : new Date().getFullYear().toString();
  const initialType = isHistoryView ? (searchParams.get('type') || 'all') : 'all';
  const initialProjectId = isHistoryView ? (searchParams.get('project_id') || 'all') : 'all';
  const urlAccountTypesParam = searchParams.get('account_types');
  const urlDirectorIdsParam = searchParams.get('director_ids');
  const urlAccountTypeLegacy = searchParams.get('account_type');
  const urlDirectorIdLegacy = searchParams.get('director_id');

  const hasAccountFilterFromUrl = Boolean(
    urlAccountTypesParam || urlDirectorIdsParam || urlAccountTypeLegacy || urlDirectorIdLegacy
  );

  const initialCompanySelected = isHistoryView
    ? (urlAccountTypesParam
        ? urlAccountTypesParam.split(',').includes('company')
        : urlAccountTypeLegacy === 'company')
    : true;

  const initialSelectedDirectorIds = isHistoryView
    ? (urlDirectorIdsParam
        ? urlDirectorIdsParam.split(',').filter(Boolean)
        : urlAccountTypeLegacy === 'director' && urlDirectorIdLegacy
          ? [urlDirectorIdLegacy]
          : [])
    : [];
  const [transactions, setTransactions] = useState([]);
  const [deletedTransactions, setDeletedTransactions] = useState([]);
  const [directors, setDirectors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingDeleted, setLoadingDeleted] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('20');
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [period, setPeriod] = useState(initialPeriod);
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [projectFilterId, setProjectFilterId] = useState(initialProjectId);
  const [companySelected, setCompanySelected] = useState(initialCompanySelected);
  const [selectedDirectorIds, setSelectedDirectorIds] = useState(initialSelectedDirectorIds);
  const [accountSelectionInitialized, setAccountSelectionInitialized] = useState(false);
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [formData, setFormData] = useState({
    transaction_type: 'income',
    amount: '',
    bank_name: '',
    transaction_id: '',
    account_type: 'company',
    director_id: '',
    project_id: '',
    from_director_id: '',
    to_director_id: '',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0]
  });

  const transactionsQueryString = () => {
    let qs = `period=${period}`;
    if (period === 'month') {
      qs += `&month=${month}&year=${year}`;
    } else if (period === 'year') {
      qs += `&year=${year}`;
    }
    if (typeFilter !== 'all') {
      qs += `&type=${typeFilter}`;
    }

    const accountTypes = [];
    if (companySelected) accountTypes.push('company');
    if (selectedDirectorIds.length > 0) accountTypes.push('director');
    if (accountTypes.length > 0) {
      qs += `&account_types=${accountTypes.join(',')}`;
      if (accountTypes.includes('director')) {
        qs += `&director_ids=${encodeURIComponent(selectedDirectorIds.join(','))}`;
      }
    }

    if (projectFilterId && projectFilterId !== 'all') {
      qs += `&project_id=${projectFilterId}`;
    }
    qs += `&page=${page}&limit=${pageSize}`;
    return qs;
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const periodLabel = formatDashboardPeriodLabel(period, month, year);

  useEffect(() => {
    fetchDirectors();
    fetchProjects();
    fetchDeletedTransactions();
  }, []);

  useEffect(() => {
    if (isHistoryView) {
      router.replace('/transactions');
    }
  }, [isHistoryView, router]);

  useEffect(() => {
    if (directors.length === 0) return;
    if (accountSelectionInitialized) return;
    if (hasAccountFilterFromUrl) return;
    // Default: show all accounts (company + all directors)
    setCompanySelected(true);
    setSelectedDirectorIds(directors.map((d) => d.id));
    setAccountSelectionInitialized(true);
  }, [directors, accountSelectionInitialized, hasAccountFilterFromUrl]);

  useEffect(() => {
    fetchTransactions();
  }, [period, month, year, typeFilter, projectFilterId, companySelected, selectedDirectorIds, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [period, month, year, typeFilter, projectFilterId, companySelected, selectedDirectorIds, pageSize]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await apiRequest(`/api/transactions?${transactionsQueryString()}`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setTransactions(data);
          setTotalItems(data.length);
          setTotalPages(1);
        } else {
          setTransactions(data.items || []);
          setTotalItems(data.total || 0);
          setTotalPages(data.totalPages || 1);
        }
      } else {
        toast.error('Failed to load transactions');
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeletedTransactions = async () => {
    setLoadingDeleted(true);
    try {
      const response = await apiRequest('/api/transactions/deleted');
      if (response.ok) {
        const data = await response.json();
        setDeletedTransactions(data);
      }
    } catch (error) {
      console.error('Failed to fetch deleted transactions:', error);
    } finally {
      setLoadingDeleted(false);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const res = await apiDownload(`/api/transactions/csv?${transactionsQueryString()}`);
      if (!res.ok) {
        toast.error('Export failed');
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition');
      let filename = 'transactions.csv';
      const match = cd?.match(/filename="([^"]+)"/);
      if (match) filename = match[1];
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded');
    } catch (e) {
      console.error('Export error:', e);
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const fetchDirectors = async () => {
    try {
      const response = await apiRequest('/api/directors');
      if (response.ok) {
        const data = await response.json();
        setDirectors(data);
      }
    } catch (error) {
      console.error('Failed to fetch directors:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await apiRequest('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const url = editingTransaction ? `/api/transactions/${editingTransaction.id}` : '/api/transactions';
      const method = editingTransaction ? 'PUT' : 'POST';

      const response = await apiRequest(url, {
        method,
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success(editingTransaction ? 'Transaction updated!' : 'Transaction created!');
        setDialogOpen(false);
        resetForm();
        fetchTransactions();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save transaction');
      }
    } catch (error) {
      console.error('Failed to save transaction:', error);
      toast.error('Failed to save transaction');
    }
  };

  const confirmDeleteTransaction = async () => {
    if (!deleteTarget || deleteInProgress) return;
    setDeleteInProgress(true);
    try {
      const response = await apiRequest(`/api/transactions/${deleteTarget.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Transaction deleted!');
        setDeleteTarget(null);
        fetchTransactions();
        fetchDeletedTransactions();
      } else {
        toast.error('Failed to delete transaction');
      }
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      toast.error('Failed to delete transaction');
    } finally {
      setDeleteInProgress(false);
    }
  };

  const resetForm = () => {
    setFormData({
      transaction_type: 'income',
      amount: '',
      bank_name: '',
      transaction_id: '',
      account_type: 'company',
      director_id: '',
      project_id: '',
      from_director_id: '',
      to_director_id: '',
      description: '',
      transaction_date: new Date().toISOString().split('T')[0]
    });
    setEditingTransaction(null);
  };

  const openEditDialog = (transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      transaction_type: transaction.transaction_type,
      amount: transaction.amount,
      bank_name: transaction.bank_name || '',
      transaction_id: transaction.transaction_id || '',
      account_type: transaction.account_type || 'company',
      director_id: transaction.director_id || '',
      project_id: transaction.project_id || '',
      from_director_id: transaction.from_director_id || '',
      to_director_id: transaction.to_director_id || '',
      description: transaction.description || '',
      transaction_date: transaction.transaction_date ? new Date(transaction.transaction_date).toISOString().split('T')[0] : ''
    });
    setDialogOpen(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'income':
        return <ArrowUpCircle className="w-4 h-4 text-green-600" />;
      case 'expense':
        return <ArrowDownCircle className="w-4 h-4 text-red-600" />;
      case 'loan':
        return <Repeat className="w-4 h-4 text-orange-600" />;
      case 'transfer':
        return <ArrowRightLeft className="w-4 h-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const getDirectorName = (id) => {
    const director = directors.find(d => d.id === id);
    return director ? director.name : 'Unknown';
  };

  const getActorName = (id) => {
    if (!id) return '—';
    return getDirectorName(id);
  };

  const getProjectName = (id) => {
    const project = projects.find(p => p.id === id);
    return project ? project.name : 'N/A';
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Transactions</h1>
              <p className="text-muted-foreground mt-1">Track income, expenses, loans, and transfers</p>
              <p className="text-sm text-muted-foreground mt-2">
                Showing: <span className="font-medium text-foreground">{periodLabel}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="year">Financial Year</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="loan">Loan</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="w-[160px] justify-between">
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Accounts
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[280px]">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Accounts</span>
                    <span className="text-xs text-muted-foreground">
                      {companySelected ? 1 : 0} company, {selectedDirectorIds.length} directors
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    className="gap-2 px-2 py-1.5 cursor-pointer"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Checkbox
                      checked={companySelected}
                      onCheckedChange={(checked) => setCompanySelected(Boolean(checked))}
                    />
                    <span>Company</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {directors.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading directors…</div>
                  ) : (
                    directors.map((d) => (
                      <DropdownMenuItem
                        key={d.id}
                        className="gap-2 px-2 py-1.5 cursor-pointer"
                        onSelect={(e) => e.preventDefault()}
                      >
                        <Checkbox
                          checked={selectedDirectorIds.includes(d.id)}
                          onCheckedChange={(checked) => {
                            const checkedBool = Boolean(checked);
                            setSelectedDirectorIds((prev) => {
                              if (checkedBool) return Array.from(new Set([...prev, d.id]));
                              return prev.filter((id) => id !== d.id);
                            });
                          }}
                        />
                        <span>{d.name}</span>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Select value={projectFilterId} onValueChange={setProjectFilterId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {period === 'year' && (
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        FY {y}-{(y + 1).toString().slice(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {period === 'month' && (
                <>
                  <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((m, idx) => (
                        <SelectItem key={idx} value={idx.toString()}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y} value={y.toString()}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading || exporting}
                onClick={handleExportCsv}
              >
                <Download className="h-4 w-4 mr-2" />
                {exporting ? 'Exporting…' : 'Export CSV'}
              </Button>

              <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Transaction
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingTransaction ? 'Edit Transaction' : 'Create Transaction'}</DialogTitle>
                  <DialogDescription>
                    {editingTransaction ? 'Update transaction details' : 'Add a new financial transaction'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="transaction_type">Transaction Type *</Label>
                      <Select 
                        value={formData.transaction_type} 
                        onValueChange={(value) => setFormData({ ...formData, transaction_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">Income</SelectItem>
                          <SelectItem value="expense">Expense</SelectItem>
                          <SelectItem value="loan">Loan (Director → Company)</SelectItem>
                          <SelectItem value="transfer">Transfer (Director → Director)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bank_name">Bank Name</Label>
                      <Input
                        id="bank_name"
                        value={formData.bank_name}
                        onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                        placeholder="e.g. HDFC / SBI"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="transaction_id">Transaction ID</Label>
                      <Input
                        id="transaction_id"
                        value={formData.transaction_id}
                        onChange={(e) => setFormData({ ...formData, transaction_id: e.target.value })}
                        placeholder="e.g. TXN-0001"
                      />
                    </div>

                    {(formData.transaction_type === 'income' || formData.transaction_type === 'expense') && (
                      <div className="space-y-2">
                        <Label htmlFor="account_type">Account Type</Label>
                        <Select 
                          value={formData.account_type} 
                          onValueChange={(value) => setFormData({ ...formData, account_type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="company">Company Account</SelectItem>
                            <SelectItem value="director">Director Account</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {(formData.transaction_type === 'income' || formData.transaction_type === 'expense') && formData.account_type === 'director' && (
                      <div className="space-y-2">
                        <Label htmlFor="director_id">Director</Label>
                        <Select 
                          value={formData.director_id} 
                          onValueChange={(value) => setFormData({ ...formData, director_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select director" />
                          </SelectTrigger>
                          <SelectContent>
                            {directors.map(director => (
                              <SelectItem key={director.id} value={director.id}>
                                {director.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {formData.transaction_type === 'loan' && (
                      <div className="space-y-2">
                        <Label htmlFor="director_id">Lending Director *</Label>
                        <Select 
                          value={formData.director_id} 
                          onValueChange={(value) => setFormData({ ...formData, director_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select director" />
                          </SelectTrigger>
                          <SelectContent>
                            {directors.map(director => (
                              <SelectItem key={director.id} value={director.id}>
                                {director.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {formData.transaction_type === 'transfer' && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="from_director_id">From Director *</Label>
                          <Select 
                            value={formData.from_director_id} 
                            onValueChange={(value) => setFormData({ ...formData, from_director_id: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select director" />
                            </SelectTrigger>
                            <SelectContent>
                              {directors.map(director => (
                                <SelectItem key={director.id} value={director.id}>
                                  {director.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="to_director_id">To Director *</Label>
                          <Select 
                            value={formData.to_director_id} 
                            onValueChange={(value) => setFormData({ ...formData, to_director_id: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select director" />
                            </SelectTrigger>
                            <SelectContent>
                              {directors.map(director => (
                                <SelectItem key={director.id} value={director.id}>
                                  {director.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    {formData.transaction_type === 'income' && (
                      <div className="space-y-2">
                        <Label htmlFor="project_id">Project (Optional)</Label>
                        <Select 
                          value={formData.project_id || 'none'} 
                          onValueChange={(value) => setFormData({ ...formData, project_id: value === 'none' ? '' : value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select project" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {projects.map(project => (
                              <SelectItem key={project.id} value={project.id}>
                                {project.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="transaction_date">Date</Label>
                      <Input
                        id="transaction_date"
                        type="date"
                        value={formData.transaction_date}
                        onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingTransaction ? 'Update' : 'Create'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          <Tabs defaultValue="active" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="deleted">Deleted</TabsTrigger>
            </TabsList>

            <TabsContent value="active">
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
              ) : transactions.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <p className="text-muted-foreground">
                      {period === 'all'
                        ? 'No transactions yet. Create your first transaction!'
                        : `No transactions for ${periodLabel}. Try a different period or add a transaction.`}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Transactions — {periodLabel}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Transaction ID</TableHead>
                            <TableHead>Bank Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Details</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>By</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transactions.map((transaction) => (
                            <TableRow key={transaction.id}>
                              <TableCell className="font-medium">
                                {formatDate(transaction.transaction_date)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                {transaction.transaction_id || '—'}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                {transaction.bank_name || '—'}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  {getTransactionIcon(transaction.transaction_type)}
                                  <Badge variant="outline">
                                    {transaction.transaction_type}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className={`font-semibold ${
                                transaction.transaction_type === 'income' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {formatCurrency(transaction.amount)}
                              </TableCell>
                              <TableCell>
                                <div className="text-sm space-y-1">
                                  {transaction.account_type && (
                                    <div className="text-muted-foreground">
                                      Account: <span className="font-medium text-foreground">{transaction.account_type}</span>
                                    </div>
                                  )}
                                  {transaction.director_id && transaction.transaction_type !== 'transfer' && (
                                    <div className="text-muted-foreground">
                                      Director: <span className="font-medium text-foreground">{getDirectorName(transaction.director_id)}</span>
                                    </div>
                                  )}
                                  {transaction.project_id && (
                                    <div className="text-muted-foreground">
                                      Project: <span className="font-medium text-foreground">{getProjectName(transaction.project_id)}</span>
                                    </div>
                                  )}
                                  {transaction.from_director_id && transaction.to_director_id && (
                                    <div className="text-muted-foreground">
                                      {getDirectorName(transaction.from_director_id)} → {getDirectorName(transaction.to_director_id)}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="max-w-xs truncate">
                                {transaction.description || '-'}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {getActorName(transaction.updated_by || transaction.created_by)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end space-x-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openEditDialog(transaction)}
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => setDeleteTarget(transaction)}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Show</span>
                        <Select value={pageSize} onValueChange={setPageSize}>
                          <SelectTrigger className="w-[90px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-muted-foreground">records</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          Page {page} of {totalPages} ({totalItems} records)
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={page >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="deleted">
              <Card variant="outline">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Deleted transactions (soft-deleted)</span>
                    {loadingDeleted && (
                      <span className="text-xs text-muted-foreground">Loading…</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {deletedTransactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No deleted transactions. When you delete a transaction, it will still appear here for reference but
                      be excluded from the main books and dashboards.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Transaction ID</TableHead>
                            <TableHead>Bank Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Deleted at</TableHead>
                            <TableHead>Deleted by</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {deletedTransactions.map((transaction) => (
                            <TableRow key={transaction.id}>
                              <TableCell className="font-medium">
                                {formatDate(transaction.transaction_date)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                {transaction.transaction_id || '—'}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                {transaction.bank_name || '—'}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  {getTransactionIcon(transaction.transaction_type)}
                                  <Badge variant="outline">
                                    {transaction.transaction_type}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className="font-semibold text-muted-foreground">
                                {formatCurrency(transaction.amount)}
                              </TableCell>
                              <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                                {transaction.description || '-'}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                {formatDateTime(transaction.deleted_at)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {getActorName(transaction.deleted_by)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleteInProgress) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the transaction from the books and add a delete entry to the audit log. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTarget ? (
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Type</span>
                <Badge variant="outline" className="font-normal capitalize">
                  {deleteTarget.transaction_type}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatCurrency(deleteTarget.amount)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Date</span>
                <span className="text-foreground">{formatDate(deleteTarget.transaction_date)}</span>
              </div>
              {deleteTarget.description ? (
                <div className="pt-2 border-t border-border">
                  <span className="text-muted-foreground text-xs block mb-1">Description</span>
                  <p className="text-foreground line-clamp-2">{deleteTarget.description}</p>
                </div>
              ) : null}
            </div>
          ) : null}
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={deleteInProgress}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteInProgress}
              onClick={confirmDeleteTransaction}
            >
              {deleteInProgress ? 'Deleting…' : 'Delete transaction'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProtectedRoute>
  );
}
