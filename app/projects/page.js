'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, CircleCheckBig, CircleX } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingIncomes, setLoadingIncomes] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [month, setMonth] = useState(new Date().getMonth().toString());
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [projectIncomeById, setProjectIncomeById] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    salary: '',
    status: 'active',
    start_date: '',
    end_date: '',
    developer_name: ''
  });

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchProjectIncomes();
  }, [month, year]);

  const fetchProjects = async () => {
    try {
      const response = await apiRequest('/api/projects');
      if (response.ok) {
        const data = await response.json();
                setProjects(data);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectIncomes = async () => {
    setLoadingIncomes(true);
    try {
      const response = await apiRequest(
        `/api/transactions?period=month&month=${month}&year=${year}&type=income`
      );
      if (response.ok) {
        const data = await response.json();
        const byId = {};
        data.forEach((t) => {
          if (t.project_id) {
            byId[t.project_id] = (byId[t.project_id] || 0) + (t.amount || 0);
          }
        });
        setProjectIncomeById(byId);
      }
    } catch (error) {
      console.error('Failed to fetch project incomes:', error);
    } finally {
      setLoadingIncomes(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const url = editingProject ? `/api/projects/${editingProject.id}` : '/api/projects';
      const method = editingProject ? 'PUT' : 'POST';

      const response = await apiRequest(url, {
        method,
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success(editingProject ? 'Project updated!' : 'Project created!');
        setDialogOpen(false);
        resetForm();
        fetchProjects();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save project');
      }
    } catch (error) {
      console.error('Failed to save project:', error);
      toast.error('Failed to save project');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      const response = await apiRequest(`/api/projects/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Project deleted!');
        fetchProjects();
      } else {
        toast.error('Failed to delete project');
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast.error('Failed to delete project');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      salary: '',
      status: 'active',
      start_date: '',
      end_date: '',
      developer_name: ''
    });
    setEditingProject(null);
  };

  const openEditDialog = (project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      salary: project.salary || '',
      status: project.status,
      start_date: project.start_date ? new Date(project.start_date).toISOString().split('T')[0] : '',
      end_date: project.end_date ? new Date(project.end_date).toISOString().split('T')[0] : '',
      developer_name: project.developer_name || ''
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

  const hasSalaryForMonth = (projectId) => Boolean(projectIncomeById[projectId]);
  const getSalaryAmountForMonth = (projectId) => projectIncomeById[projectId] || 0;
  const activeProjects = projects.filter((p) => p.status === 'active');
  const inactiveProjects = projects.filter((p) => p.status !== 'active');
  const activeMissingSalaryProjects = activeProjects.filter((p) => !hasSalaryForMonth(p.id));
  const activeReceivedSalaryProjects = activeProjects.filter((p) => hasSalaryForMonth(p.id));

  const renderProjectCard = (project) => (
    <Card key={project.id}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{project.name}</CardTitle>
            <CardDescription className="mt-1">
              {project.developer_name || 'No developer assigned'}
            </CardDescription>
          </div>
          <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
            {project.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Revenue:</span>
            <span className="font-medium">{formatCurrency(project.salary)}</span>
          </div> */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Salary credited amount:</span>
            <span className={`font-semibold ${hasSalaryForMonth(project.id) ? 'text-green-700' : 'text-muted-foreground'}`}>
              {formatCurrency(getSalaryAmountForMonth(project.id))}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Start:</span>
            <span>{formatDate(project.start_date)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">End:</span>
            <span>{formatDate(project.end_date)}</span>
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <span className="text-sm font-medium">
              Salary for {months[parseInt(month, 10)]} {year}
            </span>
            {hasSalaryForMonth(project.id) ? (
              <span className="flex items-center gap-2 text-green-700 font-semibold">
                <CircleCheckBig className="h-6 w-6" />
                Received
              </span>
            ) : (
              <span className="flex items-center gap-2 text-red-700 font-semibold">
                <CircleX className="h-6 w-6" />
                Not received
              </span>
            )}
          </div>
        </div>
        <div className="flex space-x-2 mt-4">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => openEditDialog(project)}
          >
            <Pencil className="w-3 h-3 mr-1" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-red-600 hover:text-red-700"
            onClick={() => handleDelete(project.id)}
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Delete
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() =>
              router.push(
                `/transactions?period=month&month=${month}&year=${year}&project_id=${project.id}`
                + '&history=1'
              )
            }
          >
            History
          </Button>
        </div>
      </CardContent>
    </Card>
  );
  
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Projects</h1>
              <p className="text-muted-foreground mt-1">Manage company projects and revenue sources</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground mr-1">
                Salary status for:
              </span>
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
              {loadingIncomes && (
                <span className="text-xs text-muted-foreground">Checking…</span>
              )}
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Project
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingProject ? 'Edit Project' : 'Create Project'}</DialogTitle>
                  <DialogDescription>
                    {editingProject ? 'Update project details' : 'Add a new project to the system'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Project Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="salary">Salary/Revenue</Label>
                      <Input
                        id="salary"
                        type="number"
                        value={formData.salary}
                        onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="developer_name">Developer Name</Label>
                      <Input
                        id="developer_name"
                        value={formData.developer_name}
                        onChange={(e) => setFormData({ ...formData, developer_name: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="start_date">Start Date</Label>
                        <Input
                          id="start_date"
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="end_date">End Date</Label>
                        <Input
                          id="end_date"
                          type="date"
                          value={formData.end_date}
                          onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingProject ? 'Update' : 'Create'}
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
          ) : projects.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground">No projects yet. Create your first project!</p>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="active" className="space-y-4">
              <TabsList>
                <TabsTrigger value="active">Active ({activeProjects.length})</TabsTrigger>
                <TabsTrigger value="inactive">Inactive ({inactiveProjects.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="space-y-5">
                {activeProjects.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-8 text-muted-foreground">
                      No active projects.
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <div>
                      <h3 className="text-base font-semibold mb-3 text-red-700">
                        Not received salary ({activeMissingSalaryProjects.length})
                      </h3>
                      {activeMissingSalaryProjects.length === 0 ? (
                        <Card>
                          <CardContent className="py-6 text-sm text-muted-foreground">
                            All active projects have salary for selected month.
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {activeMissingSalaryProjects.map(renderProjectCard)}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-base font-semibold mb-3 text-green-700">
                        Salary received ({activeReceivedSalaryProjects.length})
                      </h3>
                      {activeReceivedSalaryProjects.length === 0 ? (
                        <Card>
                          <CardContent className="py-6 text-sm text-muted-foreground">
                            No salary-received active projects for selected month.
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {activeReceivedSalaryProjects.map(renderProjectCard)}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="inactive">
                {inactiveProjects.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-8 text-muted-foreground">
                      No inactive projects.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {inactiveProjects.map(renderProjectCard)}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
