'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Pencil, Trash2, Check, X, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';

export default function DirectorsPage() {
  const [directors, setDirectors] = useState([]);
  const [pendingDirectors, setPendingDirectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDirector, setEditingDirector] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  useEffect(() => {
    fetchDirectors();
    fetchPendingDirectors();
  }, []);

  const fetchDirectors = async () => {
    try {
      const response = await apiRequest('/api/directors');
      if (response.ok) {
        const data = await response.json();
        setDirectors(data);
      }
    } catch (error) {
      console.error('Failed to fetch directors:', error);
      toast.error('Failed to load directors');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingDirectors = async () => {
    try {
      const response = await apiRequest('/api/directors/pending');
      if (response.ok) {
        const data = await response.json();
        setPendingDirectors(data);
      }
    } catch (error) {
      console.error('Failed to fetch pending directors:', error);
    }
  };

  const handleApprove = async (id) => {
    try {
      const response = await apiRequest(`/api/directors/approve/${id}`, {
        method: 'POST'
      });

      if (response.ok) {
        toast.success('Director approved!');
        fetchDirectors();
        fetchPendingDirectors();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to approve director');
      }
    } catch (error) {
      console.error('Failed to approve director:', error);
      toast.error('Failed to approve director');
    }
  };

  const handleReject = async (id) => {
    if (!confirm('Are you sure you want to reject this director registration?')) return;

    try {
      const response = await apiRequest(`/api/directors/reject/${id}`, {
        method: 'POST'
      });

      if (response.ok) {
        toast.success('Director registration rejected');
        fetchPendingDirectors();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to reject director');
      }
    } catch (error) {
      console.error('Failed to reject director:', error);
      toast.error('Failed to reject director');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const url = editingDirector ? `/api/directors/${editingDirector.id}` : '/api/directors';
      const method = editingDirector ? 'PUT' : 'POST';

      const body = editingDirector 
        ? { name: formData.name, email: formData.email }
        : formData;

      const response = await apiRequest(url, {
        method,
        body: JSON.stringify(body)
      });

      if (response.ok) {
        toast.success(editingDirector ? 'Director updated!' : 'Director added!');
        setDialogOpen(false);
        resetForm();
        fetchDirectors();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save director');
      }
    } catch (error) {
      console.error('Failed to save director:', error);
      toast.error('Failed to save director');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this director? This action cannot be undone.')) return;

    try {
      const response = await apiRequest(`/api/directors/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Director deleted!');
        fetchDirectors();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete director');
      }
    } catch (error) {
      console.error('Failed to delete director:', error);
      toast.error('Failed to delete director');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: ''
    });
    setEditingDirector(null);
  };

  const openEditDialog = (director) => {
    setEditingDirector(director);
    setFormData({
      name: director.name,
      email: director.email,
      password: ''
    });
    setDialogOpen(true);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Directors</h1>
              <p className="text-muted-foreground mt-1">Company directors with equal ownership</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Director
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingDirector ? 'Edit Director' : 'Add Director'}</DialogTitle>
                  <DialogDescription>
                    {editingDirector ? 'Update director information' : 'Add a new director to the company'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>
                    {!editingDirector && (
                      <div className="space-y-2">
                        <Label htmlFor="password">Password *</Label>
                        <Input
                          id="password"
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          required={!editingDirector}
                          minLength={6}
                        />
                      </div>
                    )}
                    {editingDirector && (
                      <p className="text-sm text-muted-foreground">
                        Note: Password cannot be changed through edit. Director must reset it through their account.
                      </p>
                    )}
                  </div>
                  <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingDirector ? 'Update' : 'Add'}
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
          ) : (
            <Tabs defaultValue="approved" className="space-y-4">
              <TabsList>
                <TabsTrigger value="approved">
                  Approved Directors ({directors.length})
                </TabsTrigger>
                <TabsTrigger value="pending">
                  Pending Approvals ({pendingDirectors.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="approved">
                {directors.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-12">
                      <p className="text-muted-foreground">No approved directors yet.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {directors.map((director) => {
                      const sharePercentage = directors.length > 0 ? (100 / directors.length).toFixed(1) : 0;
                      return (
                        <Card key={director.id}>
                          <CardHeader>
                            <div className="flex items-center space-x-4">
                              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                                <Users className="w-6 h-6 text-primary-foreground" />
                              </div>
                              <div className="flex-1">
                                <CardTitle className="text-lg">{director.name}</CardTitle>
                                <p className="text-sm text-muted-foreground">{director.email}</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Share:</span>
                                <span className="font-medium">{sharePercentage}% (Equal)</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Joined:</span>
                                <span>{formatDate(director.created_at)}</span>
                              </div>
                            </div>
                            <div className="flex space-x-2 mt-4">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() => openEditDialog(director)}
                              >
                                <Pencil className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-red-600 hover:text-red-700"
                                onClick={() => handleDelete(director.id)}
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="pending">
                {pendingDirectors.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-12">
                      <p className="text-muted-foreground">No pending director registrations</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {pendingDirectors.map((director) => (
                      <Card key={director.id} className="border-orange-200 bg-orange-50/50">
                        <CardHeader>
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                              <Clock className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-lg">{director.name}</CardTitle>
                              <p className="text-sm text-muted-foreground">{director.email}</p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Status:</span>
                              <Badge variant="outline" className="bg-orange-100">
                                <Clock className="w-3 h-3 mr-1" />
                                Pending
                              </Badge>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Requested:</span>
                              <span>{formatDate(director.created_at)}</span>
                            </div>
                          </div>
                          <div className="flex space-x-2 mt-4">
                            <Button
                              size="sm"
                              className="flex-1 bg-green-600 hover:bg-green-700"
                              onClick={() => handleApprove(director.id)}
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-red-600 hover:text-red-700"
                              onClick={() => handleReject(director.id)}
                            >
                              <X className="w-3 h-3 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
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
