import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/store';
import { api } from '../services/api';
import { 
  ShoppingCart, 
  ArrowLeft, 
  ArrowRight,
  Plus, 
  Trash2, 
  AlertTriangle,
  CheckCircle,
  Package,
  UserCheck,
  ClipboardList,
  Loader
} from 'lucide-react';

interface SelectedItem {
  productId: number;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  stockAvailable: number;
}

export const CreateOrder: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isCustomer = user?.role === 'customer';
  // Retrieve customer_id resolved from the `/auth/me` payload
  const customerId = (user as any)?.customer_id;

  // Step wizard state: 1 = Customer review, 2 = Add Items, 3 = Finalize & Submit
  const [step, setStep] = useState(1);
  
  // Products selection states
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [currentProductId, setCurrentProductId] = useState<number | string>('');
  const [currentQuantity, setCurrentQuantity] = useState(1);
  const [stockError, setStockError] = useState<string | null>(null);
  
  // Submit actions state
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Admin-specific states for customer selection/registration
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | string>('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [validationErrors, setValidationErrors] = useState<{ name?: string; email?: string; phone?: string }>({});

  // GST slab state
  const [gstRate, setGstRate] = useState<number>(0);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch products for dropdown
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await api.get('/products');
      return res.data;
    },
  });

  // Fetch customer details if they are customer
  const { data: customerDetails = null, isLoading: customerLoading } = useQuery({
    queryKey: ['customer-me', customerId],
    queryFn: async () => {
      const res = await api.get(`/customers/${customerId}`);
      return res.data;
    },
    enabled: !!customerId && isCustomer,
  });

  // Fetch all customers if user is admin
  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const res = await api.get('/customers');
      return res.data;
    },
    enabled: !isCustomer,
  });

  const selectedCustomerObj = customers.find((c: any) => c.id === Number(selectedCustomerId));

  // React Query Mutation: Create Order
  const createOrderMutation = useMutation({
    mutationFn: (payload: any) => api.post('/orders', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); // Stock changed
      showToast('Order placed successfully!', 'success');
      setTimeout(() => navigate('/orders'), 2000);
    },
    onError: (err: any) => {
      const errMsg = err.response?.data?.detail || 'Failed to place order.';
      setError(errMsg);
    },
  });

  const selectedProduct = products.find((p: any) => p.id === Number(currentProductId));

  const handleAddItem = () => {
    if (!selectedProduct) return;
    setStockError(null);

    // Validate stock levels
    const existingItem = selectedItems.find(item => item.productId === selectedProduct.id);
    const totalQtyRequested = (existingItem?.quantity || 0) + currentQuantity;

    if (selectedProduct.quantity_in_stock < totalQtyRequested) {
      setStockError(`Insufficient stock. Only ${selectedProduct.quantity_in_stock} units available.`);
      return;
    }

    if (existingItem) {
      // Update quantity
      setSelectedItems(selectedItems.map(item => 
        item.productId === selectedProduct.id 
          ? { ...item, quantity: totalQtyRequested } 
          : item
      ));
    } else {
      // Add new item
      setSelectedItems([...selectedItems, {
        productId: selectedProduct.id,
        name: selectedProduct.name,
        sku: selectedProduct.sku,
        price: parseFloat(selectedProduct.price),
        quantity: currentQuantity,
        stockAvailable: selectedProduct.quantity_in_stock
      }]);
    }

    // Reset items input selectors
    setCurrentProductId('');
    setCurrentQuantity(1);
  };

  const handleRemoveItem = (productId: number) => {
    setSelectedItems(selectedItems.filter(item => item.productId !== productId));
  };

  // Pricing calculations
  const calculateTotal = () => {
    return selectedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  };

  const isCheckoutDisabled = selectedItems.length === 0 || selectedItems.some(item => item.quantity > item.stockAvailable);

  const handleSubmitOrder = () => {
    if (isCheckoutDisabled) return;
    if (isCustomer && !customerId) return;
    if (!isCustomer && customerMode === 'existing' && !selectedCustomerId) return;
    if (!isCustomer && customerMode === 'new' && (!newCustomerName || !newCustomerEmail || !newCustomerPhone)) return;

    setError(null);

    const payload: any = {
      gst_rate: gstRate,
      items: selectedItems.map(item => ({
        product_id: item.productId,
        quantity: item.quantity
      }))
    };

    if (isCustomer) {
      payload.customer_id = customerId;
    } else {
      if (customerMode === 'existing') {
        payload.customer_id = Number(selectedCustomerId);
      } else {
        payload.customer_details = {
          full_name: newCustomerName.trim(),
          email: newCustomerEmail.trim(),
          phone_number: newCustomerPhone.trim()
        };
      }
    }

    createOrderMutation.mutate(payload);
  };

  const isLoading = productsLoading || 
    (isCustomer && customerLoading) || 
    (!isCustomer && customersLoading);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="w-10 h-10 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto relative">
      {/* Toast Notification */}
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
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/orders')}
          className="p-2 border border-border rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Create Order</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Place transactions with stock checking.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 font-medium">
          {error}
        </div>
      )}

      {/* Step Progress Indicators */}
      <div className="flex items-center justify-between bg-card p-4 rounded-xl border border-border">
        {[
          { label: 'Customer Info', stepNumber: 1 },
          { label: 'Select Products', stepNumber: 2 },
          { label: 'Finalize & Review', stepNumber: 3 },
        ].map((s) => (
          <div key={s.stepNumber} className="flex items-center gap-2">
            <span className={`
              w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
              ${step === s.stepNumber 
                ? 'bg-primary text-primary-foreground' 
                : step > s.stepNumber 
                  ? 'bg-primary/20 text-primary border border-primary/20' 
                  : 'bg-accent text-muted-foreground'
              }
            `}>
              {s.stepNumber}
            </span>
            <span className={`text-xs font-semibold ${step === s.stepNumber ? 'text-foreground font-extrabold' : 'text-muted-foreground'}`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* STEP 1: CUSTOMER VIEW */}
      {step === 1 && (
        <div className="glass-card p-6 rounded-2xl border border-border space-y-6">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <UserCheck className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-bold text-foreground text-lg">
              {isCustomer ? 'Billing & Shipping Profile' : 'Customer Account Association'}
            </h3>
          </div>

          {!isCustomer && (
            <div className="flex border border-border rounded-xl overflow-hidden p-1 bg-accent/45 mb-4">
              <button
                type="button"
                onClick={() => {
                  setCustomerMode('existing');
                  setValidationErrors({});
                }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                  customerMode === 'existing'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Existing Customer
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomerMode('new');
                  setValidationErrors({});
                }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                  customerMode === 'new'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Register New Customer
              </button>
            </div>
          )}

          {isCustomer ? (
            <div className="space-y-4 animate-fade-in">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account Name</p>
                <p className="text-base font-bold text-foreground mt-1">{customerDetails?.full_name || 'Loading Name...'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</p>
                <p className="text-sm text-muted-foreground font-mono mt-1">{customerDetails?.email}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone Number</p>
                <p className="text-sm text-muted-foreground mt-1">{customerDetails?.phone_number}</p>
              </div>
            </div>
          ) : customerMode === 'existing' ? (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Choose Customer
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    setValidationErrors({});
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">-- Select Customer --</option>
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.email})
                    </option>
                  ))}
                </select>
                {validationErrors.name && (
                  <p className="text-xs text-red-500 mt-1.5 font-medium">{validationErrors.name}</p>
                )}
              </div>

              {selectedCustomerObj && (
                <div className="p-4 rounded-xl bg-accent/20 border border-border/60 space-y-3 mt-4 animate-fade-in">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Selected Customer Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Full Name</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{selectedCustomerObj.full_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Email Address</p>
                      <p className="text-sm font-mono text-muted-foreground mt-0.5">{selectedCustomerObj.email}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Phone Number</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{selectedCustomerObj.phone_number}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => {
                      setNewCustomerName(e.target.value);
                      if (validationErrors.name) setValidationErrors({ ...validationErrors, name: undefined });
                    }}
                    placeholder="John Doe"
                    className="w-full px-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {validationErrors.name && (
                    <p className="text-xs text-red-500 mt-1.5 font-medium">{validationErrors.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={newCustomerPhone}
                    onChange={(e) => {
                      setNewCustomerPhone(e.target.value);
                      if (validationErrors.phone) setValidationErrors({ ...validationErrors, phone: undefined });
                    }}
                    placeholder="+1 (555) 019-2834"
                    className="w-full px-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {validationErrors.phone && (
                    <p className="text-xs text-red-500 mt-1.5 font-medium">{validationErrors.phone}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={newCustomerEmail}
                  onChange={(e) => {
                    setNewCustomerEmail(e.target.value);
                    if (validationErrors.email) setValidationErrors({ ...validationErrors, email: undefined });
                  }}
                  placeholder="john.doe@example.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {validationErrors.email && (
                  <p className="text-xs text-red-500 mt-1.5 font-medium">{validationErrors.email}</p>
                )}
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  A new customer profile will be automatically registered upon order confirmation.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-border">
            <button
              onClick={() => {
                if (!isCustomer) {
                  if (customerMode === 'existing') {
                    if (!selectedCustomerId) {
                      setValidationErrors({ name: 'Please select an existing customer' });
                      return;
                    }
                  } else {
                    const errors: any = {};
                    if (!newCustomerName.trim()) errors.name = 'Full Name is required';
                    if (!newCustomerEmail.trim()) {
                      errors.email = 'Email Address is required';
                    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newCustomerEmail)) {
                      errors.email = 'Invalid email address format';
                    }
                    if (!newCustomerPhone.trim()) errors.phone = 'Phone Number is required';

                    if (Object.keys(errors).length > 0) {
                      setValidationErrors(errors);
                      return;
                    }
                  }
                }
                setValidationErrors({});
                setStep(2);
              }}
              className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
            >
              Continue to Products
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: PRODUCTS SELECTION */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Add Item form panel */}
          <div className="glass-card p-6 rounded-2xl border border-border space-y-4">
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <Package className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-bold text-foreground text-lg">Add Products to Cart</h3>
            </div>

            {stockError && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 font-medium">
                {stockError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Select Product
                </label>
                <select
                  value={currentProductId}
                  onChange={(e) => {
                    setCurrentProductId(e.target.value);
                    setStockError(null);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">-- Choose Product --</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id} disabled={p.quantity_in_stock <= 0}>
                      {p.name} (SKU: {p.sku}) - ₹{parseFloat(p.price).toFixed(2)} [Stock: {p.quantity_in_stock}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  value={currentQuantity}
                  onChange={(e) => {
                    setCurrentQuantity(Math.max(1, Number(e.target.value)));
                    setStockError(null);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleAddItem}
                disabled={!currentProductId}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-accent text-foreground text-xs font-bold rounded-xl border border-border hover:bg-accent/80 active:scale-[0.98] transition-all disabled:opacity-40 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add to Cart
              </button>
            </div>
          </div>

          {/* Cart Table panel */}
          <div className="glass-card p-6 rounded-2xl border border-border space-y-4">
            <h3 className="font-bold text-foreground text-lg">Your Cart Items</h3>
            
            {selectedItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm font-medium">
                Cart is empty. Choose a product and add units to check out.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="divide-y divide-border/30 border-b border-border/30">
                  {selectedItems.map((item) => {
                    const isExceedingStock = item.quantity > item.stockAvailable;
                    return (
                      <div 
                        key={item.productId}
                        className={`
                          flex items-center justify-between py-4
                          ${isExceedingStock ? 'text-red-500 bg-red-500/[0.01] px-2 rounded-xl border border-red-500/10' : ''}
                        `}
                      >
                        <div>
                          <p className="text-sm font-semibold text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.sku}</p>
                          {isExceedingStock && (
                            <p className="text-[10px] text-red-500 font-bold mt-1">
                              Exceeds stock limits! Available: {item.stockAvailable} units
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-sm font-bold text-foreground">
                              {item.quantity} x ₹{item.price.toFixed(2)}
                            </p>
                            <p className="text-xs text-primary font-bold mt-0.5">
                              Subtotal: ₹{(item.quantity * item.price).toFixed(2)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveItem(item.productId)}
                            className="p-2 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-red-500/5 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-4 border-t border-border/40 space-y-3">
                  {!isCustomer && (
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Apply GST Slab
                      </label>
                      <select
                        value={gstRate}
                        onChange={(e) => setGstRate(Number(e.target.value))}
                        className="px-3 py-1.5 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value={0}>0% (No GST)</option>
                        <option value={5}>5% GST</option>
                        <option value={12}>12% GST</option>
                        <option value={18}>18% GST</option>
                        <option value={28}>28% GST</option>
                      </select>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-sm pt-2 border-t border-border/20">
                    <span className="font-semibold text-muted-foreground">Subtotal</span>
                    <span className="font-bold text-foreground">₹{calculateTotal().toFixed(2)}</span>
                  </div>

                  {gstRate > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-semibold text-muted-foreground">GST ({gstRate}%)</span>
                      <span className="font-bold text-foreground">₹{(calculateTotal() * gstRate / 100).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t border-border/40">
                    <span className="text-sm font-bold text-foreground">Estimated Total</span>
                    <span className="text-xl font-black text-primary">
                      ₹{(calculateTotal() * (1 + gstRate / 100)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Controls */}
          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-5 py-3 border border-border text-foreground font-semibold rounded-xl hover:bg-accent transition-all cursor-pointer"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={selectedItems.length === 0 || selectedItems.some(item => item.quantity > item.stockAvailable)}
              className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 cursor-pointer"
            >
              Review Order
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: RECAP & SUBMISSION */}
      {step === 3 && (
        <div className="glass-card p-6 rounded-2xl border border-border space-y-6">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <ClipboardList className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-bold text-foreground text-lg">Final Order Review</h3>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-accent/40 rounded-xl border border-border">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Customer Profile</h4>
              {isCustomer ? (
                <>
                  <p className="text-sm font-bold text-foreground">{customerDetails?.full_name}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{customerDetails?.email}</p>
                </>
              ) : customerMode === 'existing' ? (
                <>
                  <p className="text-sm font-bold text-foreground">{selectedCustomerObj?.full_name || 'No Customer Selected'}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{selectedCustomerObj?.email}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-foreground">
                    {newCustomerName}{' '}
                    <span className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full uppercase ml-1">
                      New Profile
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{newCustomerEmail}</p>
                </>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item Details Summary</h4>
              <div className="divide-y divide-border/20 border-b border-border/20">
                {selectedItems.map((item) => (
                  <div key={item.productId} className="flex justify-between py-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.sku} (x{item.quantity})</p>
                    </div>
                    <span className="text-sm font-bold text-foreground">₹{(item.quantity * item.price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold text-muted-foreground">Subtotal</span>
                <span className="font-bold text-foreground">₹{calculateTotal().toFixed(2)}</span>
              </div>
              {gstRate > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-muted-foreground">GST ({gstRate}%)</span>
                  <span className="font-bold text-foreground">₹{(calculateTotal() * gstRate / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-border/40">
                <span className="text-sm font-semibold text-muted-foreground">Order Total Amount</span>
                <span className="text-3xl font-black text-primary">
                  ₹{(calculateTotal() * (1 + gstRate / 100)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation and Submit */}
          <div className="flex justify-between pt-4 border-t border-border">
            <button
              onClick={() => setStep(2)}
              className="px-5 py-3 border border-border text-foreground font-semibold rounded-xl hover:bg-accent transition-all cursor-pointer"
            >
              Modify Items
            </button>
            <button
              onClick={handleSubmitOrder}
              disabled={createOrderMutation.isPending || isCheckoutDisabled}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-primary/5 cursor-pointer"
            >
              {createOrderMutation.isPending ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ShoppingCart className="w-5 h-5" />
                  Checkout Order
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
