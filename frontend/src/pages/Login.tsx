import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/store';
import { api } from '../services/api';
import { ShoppingCart, LogIn } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

type LoginFields = z.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFields>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFields) => {
    setIsLoading(true);
    setError(null);
    try {
      // OAuth2 password request body format
      const params = new URLSearchParams();
      params.append('username', data.email);
      params.append('password', data.password);

      const response = await api.post('/auth/login', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token } = response.data;

      // Fetch user profile info
      const meResponse = await api.get('/auth/me', {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      // Update global auth store
      setAuth(access_token, {
        email: meResponse.data.email,
        role: meResponse.data.role,
      });

      navigate('/dashboard');
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Connection failed. Please check your credentials or backend server status.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-background to-background">
      <div className="w-full max-w-md p-8 rounded-2xl glass-panel relative shadow-2xl border border-white/5 animate-slide-in">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-accent rounded-2xl mb-4 border border-white/5 shadow-lg shadow-blue-500/10">
            <ShoppingCart className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Welcome Back</h2>
          <p className="text-sm text-muted-foreground mt-2 font-medium">Sign in to manage inventory & orders</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Email Address
            </label>
            <input
              type="email"
              {...register('email')}
              placeholder="e.g. admin@inventory.com"
              className={`w-full px-4 py-3 rounded-xl bg-card border text-sm text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                errors.email ? 'border-red-500/50' : 'border-border focus:border-primary/50'
              }`}
            />
            {errors.email && (
              <p className="text-xs text-red-400 font-medium mt-1.5">{errors.email.message}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Password
              </label>
            </div>
            <input
              type="password"
              {...register('password')}
              placeholder="••••••••"
              className={`w-full px-4 py-3 rounded-xl bg-card border text-sm text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                errors.password ? 'border-red-500/50' : 'border-border focus:border-primary/50'
              }`}
            />
            {errors.password && (
              <p className="text-xs text-red-400 font-medium mt-1.5">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Sign In
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm">
          <p className="text-muted-foreground font-medium">
            New customer?{' '}
            <Link to="/register" className="text-white font-bold hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
