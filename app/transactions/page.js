'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, ArrowUpCircle, ArrowDownCircle, Repeat, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [directors, setDirectors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [formData, setFormData] = useState({
    transaction_type: 'income',
    amount: '',
    account_type: 'company',
    director_id: '',
    project_id: '',
    from_director_id: '',
    to_director_id: '',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchTransactions();
    fetchDirectors();
    fetchProjects();
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await apiRequest('/api/transactions');
      if (response.ok) {
        const data = await response.json();
        setTransactions(data);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
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

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
      const response = await apiRequest(`/api/transactions/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Transaction deleted!');
        fetchTransactions();
      } else {
        toast.error('Failed to delete transaction');
      }
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      toast.error('Failed to delete transaction');
    }
  };

  const resetForm = () => {
    setFormData({
      transaction_type: 'income',
      amount: '',
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

  const getProjectName = (id) => {
    const project = projects.find(p => p.id === id);
    return project ? project.name : 'N/A';
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Transactions</h1>
              <p className="text-muted-foreground mt-1">Track income, expenses, loans, and transfers</p>
            </div>
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

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : transactions.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground">No transactions yet. Create your first transaction!</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>All Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell className="font-medium">
                            {formatDate(transaction.transaction_date)}
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
                                onClick={() => handleDelete(transaction.id)}
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
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
