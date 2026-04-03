'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowUpCircle, ArrowDownCircle, TrendingUp, Wallet, Download } from 'lucide-react';
import { toast } from 'sonner';
import { apiDownload, apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('all');
  const [month, setMonth] = useState(new Date().getMonth().toString());
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [companyData, setCompanyData] = useState(null);
  const [myDirectorData, setMyDirectorData] = useState(null);
  const [otherDirectorDataList, setOtherDirectorDataList] = useState([]);
  const [directors, setDirectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(null);
  const otherDirectors = directors.filter((d) => d.id !== user?.id);

  const dashboardQueryString = () => {
    let qs = `period=${period}`;
    if (period === 'month') {
      qs += `&month=${month}&year=${year}`;
    } else if (period === 'year') {
      qs += `&year=${year}`;
    }
    return qs;
  };

  useEffect(() => {
    if (user) {
      fetchDirectors();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, period, month, year, directors]);

  const fetchDirectors = async () => {
    try {
      const res = await apiRequest('/api/directors');
      if (res.ok) {
        const data = await res.json();
        setDirectors(data);
      }
    } catch (e) {
      console.error('Failed to load directors for dashboard:', e);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const q = dashboardQueryString();
      const companyUrl = `/api/dashboard/company?${q}`;
      const myDirectorUrl = `/api/dashboard/director?${q}&director_id=${encodeURIComponent(user.id)}`;
      const otherDirectorUrls = otherDirectors.map(
        (d) => `/api/dashboard/director?${q}&director_id=${encodeURIComponent(d.id)}`
      );

      const [companyRes, myDirectorRes, ...otherDirectorResponses] = await Promise.all([
        apiRequest(companyUrl),
        apiRequest(myDirectorUrl),
        ...otherDirectorUrls.map((url) => apiRequest(url))
      ]);

      const othersOk = otherDirectorResponses.every((r) => r.ok);
      if (companyRes.ok && myDirectorRes.ok && othersOk) {
        setCompanyData(await companyRes.json());
        setMyDirectorData(await myDirectorRes.json());
        setOtherDirectorDataList(await Promise.all(otherDirectorResponses.map((r) => r.json())));
      } else {
        toast.error('Failed to load dashboard data');
      }
    } catch (error) {
      console.error('Dashboard error:', error);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async (kind, directorId = null) => {
    const q = dashboardQueryString();
    const path = (() => {
      if (kind === 'company') return '/api/dashboard/company/csv';
      if (kind === 'directors-all') return '/api/dashboard/directors/csv';
      return '/api/dashboard/director/csv';
    })();
    const extra = (() => {
      if (kind === 'director' && user?.id) {
        return `&director_id=${encodeURIComponent(user.id)}`;
      }
      if (kind === 'director-other' && directorId) {
        return `&director_id=${encodeURIComponent(directorId)}`;
      }
      return '';
    })();
    const exportKey = kind === 'director-other' ? `director-other:${directorId}` : kind;
    setExporting(exportKey);
    try {
      const res = await apiDownload(`${path}?${q}${extra}`);
      if (!res.ok) {
        toast.error('Export failed');
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition');
      let filename = 'dashboard.csv';
      if (kind === 'company') filename = 'company-dashboard.csv';
      if (kind === 'director') filename = 'my-dashboard.csv';
      if (kind === 'director-other') filename = 'director-dashboard.csv';
      if (kind === 'directors-all') filename = 'all-directors-dashboard.csv';
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
      setExporting(null);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground mt-1">Financial overview and insights</p>
            </div>
            <div className="flex space-x-2">
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
                    {years.map(y => (
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
                      {years.map(y => (
                        <SelectItem key={y} value={y.toString()}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          </div>

          <Tabs defaultValue="company" className="space-y-4">
            <TabsList>
              <TabsTrigger value="company">Company Overview</TabsTrigger>
              <TabsTrigger value="director">My Dashboard</TabsTrigger>
            </TabsList>

            <TabsContent value="company" className="space-y-4">
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading || !companyData || exporting === 'company'}
                  onClick={() => handleExportCsv('company')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {exporting === 'company' ? 'Exporting…' : 'Export CSV'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading || exporting === 'directors-all'}
                  onClick={() => handleExportCsv('directors-all')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {exporting === 'directors-all' ? 'Exporting…' : 'Export All Directors'}
                </Button>
              </div>
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
              ) : companyData ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                        <ArrowUpCircle className="h-4 w-4 text-green-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(companyData.totalIncome)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                          All revenue sources
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                        <ArrowDownCircle className="h-4 w-4 text-red-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(companyData.totalExpenses)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                          All expenditures
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Net Income</CardTitle>
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${
                          companyData.companyIncome >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(companyData.companyIncome)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Income - Expenses
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Company Balance</CardTitle>
                        <Wallet className="h-4 w-4 text-purple-600" />
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${
                          companyData.companyBalance >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(companyData.companyBalance)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Including loans
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {otherDirectorDataList.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {otherDirectorDataList.map((d) => (
                        <Card key={d.directorId}>
                          <CardHeader className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <CardTitle className="text-sm font-medium">
                                {d.directorName || 'Director'}
                              </CardTitle>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={loading || exporting === `director-other:${d.directorId}`}
                                onClick={() => handleExportCsv('director-other', d.directorId)}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                {exporting === `director-other:${d.directorId}` ? 'Exporting…' : 'Export CSV'}
                              </Button>
                            </div>
                            <CardDescription>{d.directorEmail || '—'}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="rounded-md border p-3">
                                <div className="text-xs text-muted-foreground">Income Share</div>
                                <div className="text-base font-semibold">{formatCurrency(d.shareOfIncome)}</div>
                              </div>
                              <div className="rounded-md border p-3">
                                <div className="text-xs text-muted-foreground">Personal Income</div>
                                <div className="text-base font-semibold">{formatCurrency(d.directorOwnIncome)}</div>
                              </div>
                              <div className="rounded-md border p-3">
                                <div className="text-xs text-muted-foreground">Expenses</div>
                                <div className="text-base font-semibold">{formatCurrency(d.directorExpenses)}</div>
                              </div>
                              <div className="rounded-md border p-3">
                                <div className="text-xs text-muted-foreground">Loans Given</div>
                                <div className="text-base font-semibold">{formatCurrency(d.loansGiven)}</div>
                              </div>
                              <div className="rounded-md border p-3">
                                <div className="text-xs text-muted-foreground">Transfers (Out/In)</div>
                                <div className="text-base font-semibold">
                                  {formatCurrency(d.transfersOut)} / {formatCurrency(d.transfersIn)}
                                </div>
                              </div>
                              <div className="rounded-md border p-3">
                                <div className="text-xs text-muted-foreground">Final Balance</div>
                                <div className="text-base font-semibold">{formatCurrency(d.balance)}</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground">
                          No other approved directors available to display.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : null}
            </TabsContent>

            <TabsContent value="director" className="space-y-4">
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading || !myDirectorData || exporting === 'director'}
                  onClick={() => handleExportCsv('director')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {exporting === 'director' ? 'Exporting…' : 'Export CSV'}
                </Button>
              </div>
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
              ) : myDirectorData ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">My Income Share</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(myDirectorData.shareOfIncome)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Equal share of company income
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Personal Income</CardTitle>
                        <ArrowUpCircle className="h-4 w-4 text-green-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(myDirectorData.directorOwnIncome)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                          My direct earnings
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">My Expenses</CardTitle>
                        <ArrowDownCircle className="h-4 w-4 text-red-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(myDirectorData.directorExpenses)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Personal expenditures
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Loans Given</CardTitle>
                        <ArrowUpCircle className="h-4 w-4 text-orange-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(myDirectorData.loansGiven)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Loans to company
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Transfers</CardTitle>
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Out:</span>
                            <span className="text-sm font-medium text-red-600">
                              {formatCurrency(myDirectorData.transfersOut)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">In:</span>
                            <span className="text-sm font-medium text-green-600">
                              {formatCurrency(myDirectorData.transfersIn)}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Final Balance</CardTitle>
                        <Wallet className="h-4 w-4 text-purple-600" />
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${
                          myDirectorData.balance >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(myDirectorData.balance)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Net position
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : null}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ProtectedRoute>
  );
}
