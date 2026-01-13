import React, { useState } from 'react';
import { User, AuthSession } from '../types';
import { User as UserIcon, Lock, Eye, EyeOff, Shield, Package } from './Icons';

// Default users - in production, these would be stored securely on a server
const DEFAULT_USERS: User[] = [
  {
    id: 'admin-001',
    username: 'admin',
    password: 'admin123',
    displayName: 'Administrator',
    role: 'admin',
    createdAt: Date.now()
  },
  {
    id: 'user-001',
    username: 'mandu',
    password: 'mandu123',
    displayName: 'Mandu User',
    role: 'user',
    createdAt: Date.now()
  }
];

interface LoginPageProps {
  onLogin: (session: AuthSession) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Get users from localStorage or use defaults
  const getUsers = (): User[] => {
    const saved = localStorage.getItem('qs_users');
    if (saved) {
      return JSON.parse(saved);
    }
    // Initialize with default users
    localStorage.setItem('qs_users', JSON.stringify(DEFAULT_USERS));
    return DEFAULT_USERS;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate network delay for better UX
    await new Promise(resolve => setTimeout(resolve, 800));

    const users = getUsers();
    const user = users.find(
      u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
    );

    if (user) {
      const session: AuthSession = {
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          createdAt: user.createdAt
        },
        loginAt: Date.now()
      };
      onLogin(session);
    } else {
      setError('Invalid username or password');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-20 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
        <div className="absolute top-40 right-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: '50px 50px'
      }}></div>

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl shadow-2xl shadow-indigo-500/30 mb-6 transform hover:scale-105 transition-transform">
            <Package size={40} className="text-white" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">
            Inventory Mandu
          </h1>
          <p className="text-slate-400 text-sm font-medium">
            Sign in to manage your inventory
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/10">
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-2xl flex items-center gap-3">
              <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
              <p className="text-red-300 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Username Field */}
          <div className="mb-5">
            <label className="block text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">
              Username
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <UserIcon size={20} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-medium"
                placeholder="Enter your username"
                required
                autoComplete="username"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="mb-6">
            <label className="block text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Lock size={20} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-12 py-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-medium"
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider hover:from-indigo-500 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-indigo-500/25 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Signing In...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Security Badge */}
        <div className="mt-6 flex items-center justify-center gap-2 text-slate-500 text-xs">
          <Shield size={14} />
          <span>Secure Authentication</span>
        </div>

        {/* Demo Credentials Hint */}
        <div className="mt-6 p-4 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
          <p className="text-slate-400 text-xs text-center mb-2 font-medium">Demo Credentials</p>
          <div className="flex flex-wrap justify-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Admin:</span>
              <code className="bg-slate-800 px-2 py-1 rounded text-indigo-300 font-mono">admin / admin123</code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">User:</span>
              <code className="bg-slate-800 px-2 py-1 rounded text-purple-300 font-mono">mandu / mandu123</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
