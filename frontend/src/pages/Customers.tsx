import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../services/api';
import { 
  Plus, 
  Trash2, 
  X, 
  Search, 
  AlertTriangle,
  CheckCircle,
  UserPlus,
  Loader,
  Users
} from 'lucide-react';

const customerSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Please enter a valid email address'),
  phoneNumber: z.string().min(5, 'Phone number must be at least 5 digits'),
});

type CustomerFields = z.infer<typeof customerSchema>;

export const Customers: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<any | null>(null);
  
  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500); // slightly longer to read potential DB warnings
  };

  // React Query: Fetch Customers
  const { data: customers = [], isLoading, error: fetchError } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const res = await api.get('/customers');
      return res.data;
    },
  });

  // React Query Mutations
  const createMutation = useMutation({
    mutationFn: (newCustomer: CustomerFields) => 
      api.post('/customers', {
        full_name: newCustomer.fullName,
        email: newCustomer.email,
        phone_number: newCustomer.phoneNumber
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      showToast('Customer created successfully!', 'success');
      closeModal();
    },
    onError: (err: any) => {
      const errMsg = err.response?.data?.detail || 'Failed to create customer profile.';
      showToast(errMsg, 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      showToast('Customer deleted successfully!', 'success');
      setDeleteConfirmOpen(null);
    },
    onError: (err: any) => {
      const errMsg = err.response?.data?.detail || 'Cannot delete customer. Please check if they have orders associated.';
      showToast(errMsg, 'error');
      setDeleteConfirmOpen(null);
    },
  });

  // Form Setup
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerFields>({
    resolver: zodResolver(customerSchema),
  });

  const openAddModal = () => {
    reset();
    setModalOpen(true);
  };

  const closeModal = () => {
    reset();
    setModalOpen(false);
  };

  const onFormSubmit = (data: CustomerFields) => {
    createMutation.mutate(data);
  };

  // Filtered Customers
  const filteredCustomers = customers.filter((c: any) => 
    c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`
          fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3.5 rounded-2xl shadow-xl border max-w-sm animate-fade-in
          ${toast.type === 'success' 
            ? 'bg-emerald-950/90 text-emerald-400 border-emerald-500/20' 
            : 'bg-red-950/90 text-red-400 border-red-500/20'
          }
        `}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Customers</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Manage your customer database, email listings, and phone number logs.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-white/5"
        >
          <Plus className="w-5 h-5" />
          Add Customer
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-xl text-sm text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
        />
      </div>

      {/* Content View */}
      {isLoading ? (
        <div className="h-96 rounded-2xl bg-card border border-border animate-pulse" />
      ) : fetchError ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-red-500/20">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="font-bold text-white text-lg">Access Denied / Connection Failure</h3>
          <p className="text-muted-foreground text-sm font-medium mt-1">
            Ensure you have administrative privileges to manage customer lists.
          </p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="font-bold text-white text-lg">No Customers Found</h3>
          <p className="text-muted-foreground text-sm font-medium mt-1">
            Try adjusting your search criteria or register a new customer profile.
          </p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-white/[0.01]">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Full Name</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone Number</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredCustomers.map((customer: any) => (
                  <tr key={customer.id} className="group hover:bg-white/[0.01] transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-white">{customer.full_name}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground font-mono">{customer.email}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground font-medium">{customer.phone_number}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setDeleteConfirmOpen(customer)}
                        className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border p-6 rounded-2xl max-w-sm w-full shadow-2xl space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white">Delete Customer</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Are you sure you want to delete <span className="font-semibold text-white">"{deleteConfirmOpen.full_name}"</span>?
                This operation will fail if this customer is linked to existing transactions.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmOpen(null)}
                className="px-4 py-2 bg-accent text-white text-sm font-semibold rounded-xl hover:opacity-95"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirmOpen.id)}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-500 active:scale-[0.98] transition-all"
              >
                {deleteMutation.isPending ? <Loader className="w-4 h-4 animate-spin" /> : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-muted-foreground" />
                Add New Customer
              </h3>
              <button
                onClick={closeModal}
                className="p-1.5 text-muted-foreground hover:text-white rounded-lg hover:bg-accent transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  {...register('fullName')}
                  placeholder="e.g. Alice Smith"
                  className={`w-full px-4 py-2.5 rounded-xl bg-background border text-sm text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                    errors.fullName ? 'border-red-500/50' : 'border-border focus:border-primary/50'
                  }`}
                />
                {errors.fullName && (
                  <p className="text-xs text-red-400 font-medium mt-1">{errors.fullName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  {...register('email')}
                  placeholder="e.g. alice@example.com"
                  className={`w-full px-4 py-2.5 rounded-xl bg-background border text-sm text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                    errors.email ? 'border-red-500/50' : 'border-border focus:border-primary/50'
                  }`}
                />
                {errors.email && (
                  <p className="text-xs text-red-400 font-medium mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Phone Number
                </label>
                <input
                  type="text"
                  {...register('phoneNumber')}
                  placeholder="e.g. 555-0144"
                  className={`w-full px-4 py-2.5 rounded-xl bg-background border text-sm text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                    errors.phoneNumber ? 'border-red-500/50' : 'border-border focus:border-primary/50'
                  }`}
                />
                {errors.phoneNumber && (
                  <p className="text-xs text-red-400 font-medium mt-1">{errors.phoneNumber.message}</p>
                )}
              </div>

              <div className="border-t border-border pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 border border-border text-white text-sm font-semibold rounded-xl hover:bg-accent transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {createMutation.isPending ? (
                    <Loader className="w-5 h-5 animate-spin mx-auto text-primary-foreground" />
                  ) : (
                    'Add Profile'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
