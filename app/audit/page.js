'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowUpCircle, ArrowDownCircle, Repeat, ArrowRightLeft, Download } from 'lucide-react';
import { toast } from 'sonner';
import { apiDownload, apiRequest } from '@/lib/api';
import { formatDashboardPeriodLabel } from '@/lib/dashboardData';

export default function AuditPage() {
  const [entries, setEntries] = useState([]);
  const [directors, setDirectors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [period, setPeriod] = useState('all');
  const [month, setMonth] = useState(new Date().getMonth().toString());
  const [year, setYear] = useState(new Date().getFullYear().toString());

  const auditQueryString = () => {
    let qs = `period=${period}`;
    if (period === 'month') {
      qs += `&month=${month}&year=${year}`;
    } else if (period === 'year') {
      qs += `&year=${year}`;
    }
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
    (async () => {
      try {
        const res = await apiRequest('/api/directors');
        if (res.ok) setDirectors(await res.json());
      } catch {
        /* ignore */
      }
      try {
        const res = await apiRequest('/api/projects');
        if (res.ok) setProjects(await res.json());
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    fetchAudit();
  }, [period, month, year]);

  const fetchAudit = async () => {
    setLoading(true);
    try {
      const response = await apiRequest(`/api/transaction-audit?${auditQueryString()}`);
      if (response.ok) {
        setEntries(await response.json());
      } else {
        toast.error('Failed to load audit log');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const res = await apiDownload(`/api/transaction-audit/csv?${auditQueryString()}`);
      if (!res.ok) {
        toast.error('Export failed');
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition');
      let filename = 'transaction-audit.csv';
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
      console.error(e);
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount ?? 0);
  };

  const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (date) => {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '—';
    }
  };

  const getDirectorName = (id) => {
    if (!id) return '—';
    const director = directors.find((d) => d.id === id);
    return director ? director.name : id;
  };

  const getProjectName = (id) => {
    if (!id) return '—';
    const project = projects.find((p) => p.id === id);
    return project ? project.name : id;
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

  const actionBadge = (action) => {
    const variant =
      action === 'create' ? 'default' : action === 'update' ? 'secondary' : 'destructive';
    const label = action === 'create' ? 'Created' : action === 'update' ? 'Updated' : 'Deleted';
    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Audit</h1>
              <p className="text-muted-foreground mt-1">
                Log of every transaction created, edited, or deleted (with amounts).
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Activity in: <span className="font-medium text-foreground">{periodLabel}</span>
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
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            </div>
          ) : entries.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground">
                  {period === 'all'
                    ? 'No audit entries yet. Actions on transactions will appear here.'
                    : `No activity recorded in ${periodLabel}.`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Transaction activity — {periodLabel}</CardTitle>
                <CardDescription>
                  Filter uses when the action happened (recorded time), not the transaction book date.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Previous</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Txn date</TableHead>
                        <TableHead>By</TableHead>
                        <TableHead>Recorded</TableHead>
                        <TableHead>Context</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="font-mono text-xs">Txn ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{actionBadge(row.action)}</TableCell>
                          <TableCell className="font-semibold whitespace-nowrap">
                            {formatCurrency(row.amount)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {row.action === 'update' &&
                            (row.previous_amount != null || row.previous_transaction_type) ? (
                              <span>
                                {row.previous_amount != null
                                  ? formatCurrency(row.previous_amount)
                                  : '—'}
                                {row.previous_transaction_type &&
                                  row.previous_transaction_type !== row.transaction_type && (
                                    <span className="block text-xs">
                                      was {row.previous_transaction_type}
                                    </span>
                                  )}
                              </span>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getTransactionIcon(row.transaction_type)}
                              <Badge variant="outline">{row.transaction_type}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatDate(row.transaction_date)}
                          </TableCell>
                          <TableCell className="text-sm">{getDirectorName(row.actor_id)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDateTime(row.recorded_at)}
                          </TableCell>
                          <TableCell className="text-sm max-w-[180px]">
                            <div className="space-y-0.5 text-muted-foreground">
                              {row.account_type && (
                                <div>
                                  Account:{' '}
                                  <span className="text-foreground">{row.account_type}</span>
                                </div>
                              )}
                              {row.director_id && row.transaction_type !== 'transfer' && (
                                <div>
                                  Director:{' '}
                                  <span className="text-foreground">
                                    {getDirectorName(row.director_id)}
                                  </span>
                                </div>
                              )}
                              {row.project_id && (
                                <div>
                                  Project:{' '}
                                  <span className="text-foreground">
                                    {getProjectName(row.project_id)}
                                  </span>
                                </div>
                              )}
                              {row.from_director_id && row.to_director_id && (
                                <div className="text-foreground">
                                  {getDirectorName(row.from_director_id)} →{' '}
                                  {getDirectorName(row.to_director_id)}
                                </div>
                              )}
                              {!row.account_type &&
                                !row.director_id &&
                                !row.project_id &&
                                !row.from_director_id && <span>—</span>}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[160px] truncate text-sm text-muted-foreground">
                            {row.description || '—'}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground max-w-[100px] truncate">
                            {row.transaction_id}
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
