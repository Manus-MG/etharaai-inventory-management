import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { ShoppingCart, UserPlus } from 'lucide-react';

const registerSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Please enter a valid email address'),
  phoneNumber: z.string().min(5, 'Phone number must be at least 5 digits'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

type RegisterFields = z.infer<typeof registerSchema>;

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFields>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFields) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await api.post('/auth/register', {
        email: data.email,
        password: data.password,
        full_name: data.fullName,
        phone_number: data.phoneNumber,
      });

      setSuccess('Registration successful! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Registration failed. Please check your credentials or backend server status.');
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
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Create Account</h2>
          <p className="text-sm text-muted-foreground mt-2 font-medium">Join as an inventory customer</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 font-medium animate-fade-in">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400 font-medium animate-fade-in">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              {...register('fullName')}
              placeholder="e.g. John Doe"
              className={`w-full px-4 py-2.5 rounded-xl bg-card border text-sm text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
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
              placeholder="e.g. john@example.com"
              className={`w-full px-4 py-2.5 rounded-xl bg-card border text-sm text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
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
              placeholder="e.g. 555-0199"
              className={`w-full px-4 py-2.5 rounded-xl bg-card border text-sm text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                errors.phoneNumber ? 'border-red-500/50' : 'border-border focus:border-primary/50'
              }`}
            />
            {errors.phoneNumber && (
              <p className="text-xs text-red-400 font-medium mt-1">{errors.phoneNumber.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Password
            </label>
            <input
              type="password"
              {...register('password')}
              placeholder="••••••••"
              className={`w-full px-4 py-2.5 rounded-xl bg-card border text-sm text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                errors.password ? 'border-red-500/50' : 'border-border focus:border-primary/50'
              }`}
            />
            {errors.password && (
              <p className="text-xs text-red-400 font-medium mt-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 mt-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                Sign Up
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <p className="text-muted-foreground font-medium">
            Already have an account?{' '}
            <Link to="/login" className="text-white font-bold hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
