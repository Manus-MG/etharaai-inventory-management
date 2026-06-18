import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/store';
import { api } from '../services/api';
import { 
  Package, 
  Users, 
  ShoppingCart, 
  AlertTriangle,
  ArrowRight,
  TrendingUp
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await api.get('/products');
      return res.data;
    },
  });

  // Fetch customers (only if admin)
  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const res = await api.get('/customers');
      return res.data;
    },
    enabled: isAdmin,
  });

  // Fetch orders
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const res = await api.get('/orders');
      return res.data;
    },
  });

  const isLoading = productsLoading || (isAdmin && customersLoading) || ordersLoading;

  // Calculators
  const totalProducts = products.length;
  const totalCustomers = customers.length;
  const totalOrders = orders.length;
  
  const lowStockThreshold = 10;
  const lowStockProducts = products.filter(
    (p: any) => p.quantity_in_stock <= lowStockThreshold
  );
  const lowStockCount = lowStockProducts.length;

  // Recent 5 orders
  const recentOrders = [...orders]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const stats = [
    {
      name: 'Total Products',
      value: totalProducts,
      icon: Package,
      color: 'text-primary bg-primary/10 border-primary/20',
      action: () => navigate('/products'),
      show: true,
    },
    {
      name: 'Total Customers',
      value: isAdmin ? totalCustomers : 'N/A',
      icon: Users,
      color: 'text-teal-600 bg-teal-600/10 border-teal-600/20 dark:text-teal-400 dark:bg-teal-400/10 dark:border-teal-400/20',
      action: () => isAdmin && navigate('/customers'),
      show: isAdmin,
    },
    {
      name: 'Total Orders',
      value: totalOrders,
      icon: ShoppingCart,
      color: 'text-cyan-600 bg-cyan-600/10 border-cyan-600/20 dark:text-cyan-400 dark:bg-cyan-500/10 dark:border-cyan-500/20',
      action: () => navigate('/orders'),
      show: true,
    },
    {
      name: 'Low Stock Products',
      value: lowStockCount,
      icon: AlertTriangle,
      color: lowStockCount > 0 
        ? 'text-amber-500 bg-amber-500/10 border-amber-500/20 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20 animate-pulse' 
        : 'text-muted-foreground bg-muted border-border',
      action: () => navigate('/products?filter=low-stock'),
      show: true,
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Skeleton grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-card border border-border animate-pulse" />
          ))}
        </div>
        <div className="h-96 rounded-2xl bg-card border border-border animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
          Dashboard Overview <TrendingUp className="w-6 h-6 text-primary" />
        </h1>
        <p className="text-muted-foreground mt-1 text-sm font-medium">
          Real-time metrics, low-stock notifications, and transactional updates.
        </p>
      </div>

      {/* KPI metrics cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.filter(s => s.show).map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              onClick={stat.action}
              className="glass-card p-6 rounded-2xl flex items-center justify-between cursor-pointer"
            >
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {stat.name}
                </p>
                <p className="text-3xl font-black text-foreground">{stat.value}</p>
              </div>
              <div className={`p-4 rounded-xl border ${stat.color}`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity Log */}
      <div className="glass-card rounded-2xl p-6 border border-border">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-foreground">Recent Orders</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Last 5 orders placed on the system</p>
          </div>
          <button
            onClick={() => navigate('/orders')}
            className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors"
          >
            View All Orders <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {recentOrders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground text-sm font-medium">No orders found.</p>
            <button
              onClick={() => navigate('/orders/new')}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-all"
            >
              Place Your First Order
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order ID</th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer ID</th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Price</th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Created At</th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {recentOrders.map((order: any) => (
                  <tr key={order.id} className="group hover:bg-white/[0.01] transition-colors">
                    <td className="py-4 text-sm font-semibold text-foreground">#{order.id}</td>
                    <td className="py-4 text-sm text-muted-foreground font-medium">Customer #{order.customer_id}</td>
                    <td className="py-4 text-sm font-bold text-primary">₹{parseFloat(order.total_amount).toFixed(2)}</td>
                    <td className="py-4 text-sm text-muted-foreground font-medium">
                      {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-4 text-sm text-muted-foreground font-medium">
                      {order.items?.length || 0} items
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
