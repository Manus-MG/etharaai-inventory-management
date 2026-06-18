import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/store';
import { api } from '../services/api';
import { 
  ShoppingCart, 
  Trash2, 
  X, 
  Search, 
  AlertTriangle,
  CheckCircle,
  Eye,
  Plus,
  Loader
} from 'lucide-react';

export const Orders: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState<any | null>(null);
  
  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // React Query: Fetch Orders
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const res = await api.get('/orders');
      return res.data;
    },
  });

  // Fetch Products (to map product names/SKUs inside order details)
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await api.get('/products');
      return res.data;
    },
  });

  // Fetch Customers (only if admin, to map customer names instead of IDs)
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const res = await api.get('/customers');
      return res.data;
    },
    enabled: isAdmin,
  });

  const getProductDetails = (productId: number) => {
    const product = products.find((p: any) => p.id === productId);
    return product ? { name: product.name, sku: product.sku } : { name: `Product #${productId}`, sku: 'UNKNOWN' };
  };

  const getCustomerName = (customerId: number) => {
    const customer = customers.find((c: any) => c.id === customerId);
    return customer ? customer.full_name : `Customer ID #${customerId}`;
  };

  // React Query Mutations: Cancel Order
  const cancelMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); // Refetch stock quantity changes
      showToast('Order cancelled successfully! Stock levels restored.', 'success');
      setCancelConfirmOpen(null);
      setSelectedOrder(null);
    },
    onError: (err: any) => {
      const errMsg = err.response?.data?.detail || 'Failed to cancel the order.';
      showToast(errMsg, 'error');
    },
  });

  const filteredOrders = orders.filter((o: any) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesId = `#${o.id}`.includes(searchLower) || o.id.toString().includes(searchLower);
    const matchesCustomer = getCustomerName(o.customer_id).toLowerCase().includes(searchLower);
    return matchesId || matchesCustomer;
  });

  return (
    <div className="space-y-8 relative">
      {/* Toast Notifier */}
      {toast && (
        <div className={`
          fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3.5 rounded-2xl shadow-xl border animate-fade-in
          ${toast.type === 'success' 
            ? 'bg-emerald-950/90 text-emerald-400 border-emerald-500/20' 
            : 'bg-red-950/90 text-red-400 border-red-500/20'
          }
        `}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Orders</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Browse transaction records, detailed product counts, and handle order cancellations.
          </p>
        </div>

        {!isAdmin && (
          <button
            onClick={() => navigate('/orders/new')}
            className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-white/5"
          >
            <Plus className="w-5 h-5" />
            Place Order
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by Order ID or Customer Name..."
          className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-xl text-sm text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
        />
      </div>

      {/* Order Logs table */}
      {ordersLoading ? (
        <div className="h-96 rounded-2xl bg-card border border-border animate-pulse" />
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="font-bold text-white text-lg">No Orders Found</h3>
          <p className="text-muted-foreground text-sm font-medium mt-1">
            Try adjusting your search criteria or create a new order layout.
          </p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-white/[0.01]">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order ID</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer Name</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Placed On</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Price</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items Count</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredOrders.map((order: any) => (
                  <tr key={order.id} className="group hover:bg-white/[0.01] transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-white">#{order.id}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground font-semibold">
                      {getCustomerName(order.customer_id)}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground font-medium">
                      {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 text-sm font-black text-emerald-400">${parseFloat(order.total_amount).toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground font-medium">
                      {order.items?.length || 0} unique items
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="p-2 text-muted-foreground hover:text-white hover:bg-accent rounded-lg transition-all"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setCancelConfirmOpen(order)}
                          className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-all"
                          title="Cancel Order"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border p-6 rounded-2xl max-w-sm w-full shadow-2xl space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="text-red-400 w-5 h-5" />
                Cancel Order
              </h3>
              <p className="text-sm text-muted-foreground mt-2">
                Are you sure you want to cancel order <span className="font-semibold text-white">"#{cancelConfirmOpen.id}"</span>?
                This action is permanent and will return all items back to inventory stock.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setCancelConfirmOpen(null)}
                className="px-4 py-2 bg-accent text-white text-sm font-semibold rounded-xl hover:opacity-95"
              >
                No, Back
              </button>
              <button
                onClick={() => cancelMutation.mutate(cancelConfirmOpen.id)}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-500 active:scale-[0.98] transition-all"
              >
                {cancelMutation.isPending ? <Loader className="w-4 h-4 animate-spin" /> : 'Yes, Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over Detail Drawer Overlay */}
      {selectedOrder && (
        <div 
          onClick={() => setSelectedOrder(null)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
        />
      )}

      {/* Slide-over Detail Drawer Content */}
      <div className={`
        fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-card border-l border-border shadow-2xl p-6 flex flex-col justify-between
        transform transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1)
        ${selectedOrder ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {selectedOrder && (
          <div className="flex-1 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-xl font-extrabold text-white">Order Details</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Order ID #{selectedOrder.id}</p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 text-muted-foreground hover:text-white rounded-lg hover:bg-accent transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Customer summary metadata */}
              <div className="p-4 rounded-xl bg-accent/40 border border-white/5 space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer Context</h4>
                <p className="text-sm font-bold text-white">{getCustomerName(selectedOrder.customer_id)}</p>
                <p className="text-xs text-muted-foreground">Reference ID: Customer #{selectedOrder.customer_id}</p>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order Items</h4>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item: any) => {
                    const prod = getProductDetails(item.product_id);
                    return (
                      <div 
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-white/[0.01] rounded-xl border border-border"
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">{prod.name}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">{prod.sku}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-white">
                            {item.quantity} x ${parseFloat(item.unit_price).toFixed(2)}
                          </p>
                          <p className="text-xs text-emerald-400 font-bold mt-0.5">
                            ${(item.quantity * parseFloat(item.unit_price)).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer Summary */}
            <div className="border-t border-border pt-4 mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Grand Total</span>
                <span className="text-2xl font-black text-emerald-400">
                  ${parseFloat(selectedOrder.total_amount).toFixed(2)}
                </span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="flex-1 py-3 border border-border text-white text-sm font-semibold rounded-xl hover:bg-accent transition-all"
                >
                  Close Drawer
                </button>
                <button
                  onClick={() => setCancelConfirmOpen(selectedOrder)}
                  className="flex-1 py-3 bg-red-600/10 border border-red-500/20 text-red-400 font-semibold rounded-xl hover:bg-red-500/20 active:scale-[0.98] transition-all"
                >
                  Cancel Order
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
