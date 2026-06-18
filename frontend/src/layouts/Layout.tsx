import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/store';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  ShoppingCart, 
  LogOut, 
  Menu, 
  X,
  UserCheck
} from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'customer'] },
    { name: 'Products', path: '/products', icon: Package, roles: ['admin', 'customer'] },
    { name: 'Customers', path: '/customers', icon: Users, roles: ['admin'] },
    { name: 'Orders', path: '/orders', icon: ShoppingCart, roles: ['admin', 'customer'] },
  ];

  const filteredNavItems = navItems.filter(
    item => user?.role && item.roles.includes(user.role)
  );

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Top Bar */}
      <div className="flex md:hidden items-center justify-between px-4 py-3 bg-card border-b border-border z-20">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-primary" />
          <span className="font-bold text-lg tracking-wider text-white">ETHARA</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1 text-foreground hover:text-white transition-colors"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar - Desktop */}
      <aside className={`
        fixed inset-y-0 left-0 transform md:relative md:translate-x-0 transition-transform duration-200 ease-in-out
        w-64 bg-card border-r border-border flex flex-col z-30
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Brand Section */}
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="p-2 bg-accent rounded-lg">
            <ShoppingCart className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-extrabold text-xl tracking-tight text-white">Ethara</h1>
            <p className="text-xs text-muted-foreground font-medium">Inventory System</p>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                  ${active 
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-white/5' 
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }
                `}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User context footer in Sidebar */}
        <div className="p-4 border-t border-border bg-card">
          <div className="flex items-center gap-3 px-2 py-3 rounded-lg mb-2">
            <div className="p-2 bg-accent rounded-full text-muted-foreground">
              <UserCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{user?.email}</p>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize mt-0.5">
                {user?.role}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/5 transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Header */}
        <header className="hidden md:flex items-center justify-between px-8 py-5 border-b border-border bg-background z-10">
          <div>
            <h2 className="text-lg font-semibold text-white capitalize">
              {location.pathname.substring(1).split('/')[0] || 'Dashboard'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs font-medium text-muted-foreground">Logged in as</p>
              <p className="text-sm font-semibold text-white">{user?.email}</p>
            </div>
            <div className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
              {user?.role}
            </div>
          </div>
        </header>

        {/* View Layout Container */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto animate-fade-in">
          {children}
        </main>
      </div>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden"
        />
      )}
    </div>
  );
};
