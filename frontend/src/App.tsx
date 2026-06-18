import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './layouts/Layout';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { Customers } from './pages/Customers';
import { Orders } from './pages/Orders';
import { CreateOrder } from './pages/CreateOrder';

// Create a query client for React Query server caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes wrapped with Sidebar layout */}
          <Route element={<ProtectedRoute />}>
            <Route
              path="/dashboard"
              element={
                <Layout>
                  <Dashboard />
                </Layout>
              }
            />
            <Route
              path="/products"
              element={
                <Layout>
                  <Products />
                </Layout>
              }
            />
            <Route
              path="/orders"
              element={
                <Layout>
                  <Orders />
                </Layout>
              }
            />
            <Route
              path="/orders/new"
              element={
                <Layout>
                  <CreateOrder />
                </Layout>
              }
            />
          </Route>

          {/* Admin Restricted routes */}
          <Route element={<ProtectedRoute requiredRole="admin" />}>
            <Route
              path="/customers"
              element={
                <Layout>
                  <Customers />
                </Layout>
              }
            />
          </Route>

          {/* Fallback route redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
