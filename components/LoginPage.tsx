import React, { useState, useEffect } from 'react';
import { User, AuthSession } from '../types';
import { User as UserIcon, Lock, Eye, EyeOff, Shield, Package } from './Icons';
import * as db from '../lib/db';
import { isSupabaseConfigured } from '../lib/supabase';

// Default users - will be seeded if database is empty
const DEFAULT_USERS: Omit<User, 'id' | 'createdAt'>[] = [
  {
    username: 'admin',
    password: 'admin123',
    displayName: 'Administrator',
    role: 'admin'
  },
  {
    username: 'mandu',
    password: 'mandu123',
    displayName: 'Mandu User',
    role: 'user'
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
  const [isInitializing, setIsInitializing] = useState(true);
  const [guardBlocked, setGuardBlocked] = useState(false);

  // Initialize default users if none exist
  useEffect(() => {
    const initUsers = async () => {
      try {
        const users = await db.getUsers();
        if (users.length === 0) {
          const guardOverride = localStorage.getItem('qs_guard_override') === 'true';
          if (isSupabaseConfigured() && db.hasCachedCloudData() && !guardOverride) {
            setGuardBlocked(true);
            setIsInitializing(false);
            return;
          }
          // Seed default users
          for (const user of DEFAULT_USERS) {
            try {
              await db.createUser(user);
            } catch (userError) {
              console.error('Failed to create default user:', userError);
              // Continue with other users even if one fails
            }
          }
        }
      } catch (error) {
        console.error('Error initializing users:', error);
        setError('Failed to initialize. Please refresh the page.');
      } finally {
        setIsInitializing(false);
      }
    };
    initUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = await db.authenticateUser(username, password);

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
      }
    } catch (err) {
      setError('Connection error. Please try again.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Package size={32} className="text-white" />
          </div>
          <p className="text-slate-400 font-bold">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
          <img src="/nimaya-logo.jpg" alt="" className="w-96 h-96 object-contain grayscale" />
        </div>
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
          <div className="inline-flex items-center justify-center w-32 h-32 bg-white rounded-3xl shadow-2xl shadow-indigo-500/30 mb-6 transform hover:scale-105 transition-transform p-4">
            <img src="/nimaya-logo.jpg" alt="Nimaya" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">
            Inventory Mandu
          </h1>
          <p className="text-slate-400 text-sm font-medium">
            Sign in to manage your inventory
          </p>
          {isSupabaseConfigured() && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 rounded-full">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span className="text-emerald-400 text-xs font-bold">Cloud Connected</span>
            </div>
          )}
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/10">
          {guardBlocked && (
            <div className="mb-6 p-4 bg-amber-500/20 border border-amber-500/30 rounded-2xl flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                <p className="text-amber-200 text-sm font-medium">
                  Data safety check blocked automatic setup. Verify your cloud database or continue to unlock setup.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('qs_guard_override', 'true');
                  window.location.reload();
                }}
                className="w-full bg-amber-500/30 text-amber-100 py-3 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-amber-500/40 transition-all"
              >
                Continue Anyway
              </button>
            </div>
          )}
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
          <span>{isSupabaseConfigured() ? 'Cloud Database Active' : 'Local Storage Mode'}</span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
