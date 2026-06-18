import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../store/store';
import { api } from '../services/api';
import { 
  Plus, 
  Edit, 
  Trash2, 
  X, 
  Search, 
  AlertTriangle,
  CheckCircle,
  PackagePlus,
  Loader
} from 'lucide-react';

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
  price: z.coerce.number().gt(0, 'Price must be greater than 0'),
  quantity_in_stock: z.coerce.number().int().nonnegative('Quantity cannot be negative'),
});

type ProductFields = z.infer<typeof productSchema>;

export const Products: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'all';

  // State Management
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState(initialFilter);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<any | null>(null);
  
  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // React Query: Fetch Products
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await api.get('/products');
      return res.data;
    },
  });

  // React Query Mutations
  const createMutation = useMutation({
    mutationFn: (newProduct: ProductFields) => api.post('/products', newProduct),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      showToast('Product created successfully!', 'success');
      closeDrawer();
    },
    onError: (err: any) => {
      const errMsg = err.response?.data?.detail || 'Failed to create product.';
      showToast(errMsg, 'error');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (updatedData: { id: number; data: ProductFields }) => 
      api.put(`/products/${updatedData.id}`, updatedData.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      showToast('Product updated successfully!', 'success');
      closeDrawer();
    },
    onError: (err: any) => {
      const errMsg = err.response?.data?.detail || 'Failed to update product.';
      showToast(errMsg, 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      showToast('Product deleted successfully!', 'success');
      setDeleteConfirmOpen(null);
    },
    onError: (err: any) => {
      const errMsg = err.response?.data?.detail || 'Failed to delete product.';
      showToast(errMsg, 'error');
    },
  });

  // Form Setup
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ProductFields>({
    resolver: zodResolver(productSchema) as any,
  });

  const openAddDrawer = () => {
    reset();
    setEditingProduct(null);
    setDrawerOpen(true);
  };

  const openEditDrawer = (product: any) => {
    setValue('name', product.name);
    setValue('sku', product.sku);
    setValue('price', product.price);
    setValue('quantity_in_stock', product.quantity_in_stock);
    setEditingProduct(product);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    reset();
    setDrawerOpen(false);
    setEditingProduct(null);
  };

  const onFormSubmit = (data: ProductFields) => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Filtered Products
  const filteredProducts = products.filter((p: any) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (stockFilter === 'low-stock') {
      return matchesSearch && p.quantity_in_stock <= 10;
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-8 relative">
      {/* Toast Notification Container */}
      {toast && (
        <div className={`
          fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-5 py-3.5 rounded-2xl shadow-xl border animate-fade-in
          ${toast.type === 'success' 
            ? 'bg-primary/10 text-primary border border-primary/20 backdrop-blur-md' 
            : 'bg-red-500/10 text-red-500 border border-red-500/20 backdrop-blur-md'
          }
        `}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Manage your stock quantities, prices, SKUs, and core catalog variables.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openAddDrawer}
            className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-primary/5 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            Add Product
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or SKU..."
            className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
          />
        </div>
        
        {/* Filter Selection */}
        <div className="flex gap-2">
          <button
            onClick={() => setStockFilter('all')}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              stockFilter === 'all' 
                ? 'bg-primary text-primary-foreground border border-primary/20' 
                : 'text-muted-foreground hover:bg-card border border-transparent'
            }`}
          >
            All Products
          </button>
          <button
            onClick={() => setStockFilter('low-stock')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              stockFilter === 'low-stock' 
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                : 'text-muted-foreground hover:bg-card border border-transparent'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Low Stock (≤10)
          </button>
        </div>
      </div>

      {/* Products Table */}
      {isLoading ? (
        <div className="h-96 rounded-2xl bg-card border border-border animate-pulse" />
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="font-bold text-foreground text-lg">No Products Found</h3>
          <p className="text-muted-foreground text-sm font-medium mt-1">
            Try adjusting your search criteria or register a new product profile.
          </p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-card/50">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product Name</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">SKU</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Price</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stock Status</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quantity</th>
                  {isAdmin && <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredProducts.map((product: any) => {
                  const isLowStock = product.quantity_in_stock <= 10;
                  return (
                    <tr 
                      key={product.id} 
                      className={`
                        group hover:bg-card/40 transition-colors
                        ${isLowStock ? 'bg-amber-500/[0.02]' : ''}
                      `}
                    >
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-foreground">{product.name}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground font-mono">{product.sku}</td>
                      <td className="px-6 py-4 text-sm font-bold text-primary">₹{parseFloat(product.price).toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          product.quantity_in_stock === 0 
                            ? 'bg-red-500/10 text-red-500 border-red-500/20'
                            : isLowStock 
                              ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                              : 'bg-primary/10 text-primary border-primary/20'
                        }`}>
                          {product.quantity_in_stock === 0 ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-sm font-semibold ${isLowStock ? 'text-amber-400 font-bold' : 'text-foreground'}`}>
                        {product.quantity_in_stock} units
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditDrawer(product)}
                              className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-all cursor-pointer"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmOpen(product)}
                              className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-all cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border p-6 rounded-2xl max-w-sm w-full shadow-2xl space-y-6">
            <div>
              <h3 className="text-lg font-bold text-foreground">Delete Product</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Are you sure you want to delete <span className="font-semibold text-foreground">"{deleteConfirmOpen.name}"</span>? This action is permanent.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmOpen(null)}
                className="px-4 py-2 bg-accent text-foreground text-sm font-semibold rounded-xl hover:opacity-95 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirmOpen.id)}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-500 active:scale-[0.98] transition-all cursor-pointer"
              >
                {deleteMutation.isPending ? <Loader className="w-4 h-4 animate-spin" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over Drawer Backdrop */}
      {drawerOpen && (
        <div 
          onClick={closeDrawer}
          className="fixed inset-0 bg-white/60 backdrop-blur-sm z-40 animate-fade-in"
        />
      )}

      {/* Slide-over Drawer Content */}
      <div className={`
        fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card border-l border-border shadow-2xl p-6 flex flex-col justify-between
        transform transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1)
        ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-muted-foreground" />
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h2>
            <button
              onClick={closeDrawer}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form id="product-form" onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Product Name
              </label>
              <input
                type="text"
                {...register('name')}
                placeholder="e.g. Wireless Mouse"
                className={`w-full px-4 py-2.5 rounded-xl bg-background border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                  errors.name ? 'border-red-500/50' : 'border-border focus:border-primary/50'
                }`}
              />
              {errors.name && (
                <p className="text-xs text-red-400 font-medium mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                SKU / Code
              </label>
              <input
                type="text"
                {...register('sku')}
                disabled={!!editingProduct}
                placeholder="e.g. MOUSE-WL-01"
                className={`w-full px-4 py-2.5 rounded-xl bg-background border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50 ${
                  errors.sku ? 'border-red-500/50' : 'border-border focus:border-primary/50'
                }`}
              />
              {errors.sku && (
                <p className="text-xs text-red-400 font-medium mt-1">{errors.sku.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Unit Price (₹)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('price')}
                placeholder="e.g. 29.99"
                className={`w-full px-4 py-2.5 rounded-xl bg-background border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                  errors.price ? 'border-red-500/50' : 'border-border focus:border-primary/50'
                }`}
              />
              {errors.price && (
                <p className="text-xs text-red-400 font-medium mt-1">{errors.price.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Quantity in Stock
              </label>
              <input
                type="number"
                {...register('quantity_in_stock')}
                placeholder="e.g. 150"
                className={`w-full px-4 py-2.5 rounded-xl bg-background border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                  errors.quantity_in_stock ? 'border-red-500/50' : 'border-border focus:border-primary/50'
                }`}
              />
              {errors.quantity_in_stock && (
                <p className="text-xs text-red-400 font-medium mt-1">{errors.quantity_in_stock.message}</p>
              )}
            </div>
          </form>
        </div>

        <div className="border-t border-border pt-4 flex gap-3">
          <button
            type="button"
            onClick={closeDrawer}
            className="flex-1 py-3 border border-border text-foreground text-sm font-semibold rounded-xl hover:bg-accent transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="product-form"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="flex-1 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
          >
            {createMutation.isPending || updateMutation.isPending ? (
              <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mx-auto" />
            ) : editingProduct ? (
              'Save Changes'
            ) : (
              'Create Product'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
