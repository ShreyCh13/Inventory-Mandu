import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { User as UserIcon, Plus, Trash, Eye, EyeOff, Shield } from './Icons';
import * as db from '../lib/db';

interface UserManagerProps {
  currentUserId: string;
}

const UserManager: React.FC<UserManagerProps> = ({ currentUserId }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  
  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [error, setError] = useState('');
  const [showFormPassword, setShowFormPassword] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    const loadedUsers = await db.getUsers();
    setUsers(loadedUsers);
    setIsLoading(false);
  };

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setDisplayName('');
    setRole('user');
    setError('');
    setShowAddUser(false);
    setEditingUser(null);
    setShowFormPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!username.trim() || !displayName.trim()) {
      setError('Username and display name are required');
      return;
    }

    if (!editingUser && !password.trim()) {
      setError('Password is required for new users');
      return;
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    // Check for duplicate username (excluding current user if editing)
    const existingUser = users.find(
      u => u.username.toLowerCase() === username.toLowerCase() && 
           (!editingUser || u.id !== editingUser.id)
    );
    if (existingUser) {
      setError('Username already exists');
      return;
    }

    if (editingUser) {
      // Update existing user
      const success = await db.updateUser(editingUser.id, {
        username: username.trim(),
        displayName: displayName.trim(),
        role,
        ...(password.trim() ? { password: password.trim() } : {})
      });
      
      if (success) {
        await loadUsers();
        resetForm();
      } else {
        setError('Failed to update user');
      }
    } else {
      // Create new user
      const newUser = await db.createUser({
        username: username.trim(),
        password: password.trim(),
        displayName: displayName.trim(),
        role
      });
      
      if (newUser) {
        setUsers(prev => [...prev, newUser]);
        resetForm();
      } else {
        setError('Failed to create user');
      }
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setUsername(user.username);
    setDisplayName(user.displayName);
    setRole(user.role);
    setPassword(''); // Don't show existing password
    setShowAddUser(true);
  };

  const handleDelete = async (userId: string) => {
    if (userId === currentUserId) {
      alert("You cannot delete your own account!");
      return;
    }

    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      const success = await db.deleteUser(userId);
      if (success) {
        setUsers(prev => prev.filter(u => u.id !== userId));
      }
    }
  };

  const togglePasswordVisibility = (userId: string) => {
    setShowPasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <UserIcon size={24} className="text-slate-400" />
        </div>
        <p className="text-slate-400 font-bold">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">User Management</h2>
          <p className="text-slate-500 text-sm mt-1">Add, edit, or remove users and their permissions</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAddUser(true); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          <Plus size={20} />
          Add User
        </button>
      </div>

      {/* Add/Edit User Form */}
      {showAddUser && (
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100">
          <h3 className="text-lg font-black text-slate-900 mb-4">
            {editingUser ? 'Edit User' : 'Add New User'}
          </h3>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. john_doe"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 focus:border-indigo-500 outline-none font-medium"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 focus:border-indigo-500 outline-none font-medium"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Password {editingUser && <span className="text-slate-300">(leave blank to keep current)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showFormPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={editingUser ? "••••••••" : "Enter password"}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 pr-12 focus:border-indigo-500 outline-none font-medium"
                    required={!editingUser}
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormPassword(!showFormPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showFormPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 focus:border-indigo-500 outline-none font-medium appearance-none"
                >
                  <option value="user">User (Can add/edit own entries)</option>
                  <option value="admin">Admin (Full access)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all"
              >
                {editingUser ? 'Update User' : 'Create User'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users List */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {users.length} Users
          </p>
        </div>
        
        <div className="divide-y divide-slate-100">
          {users.map(user => (
            <div key={user.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  user.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {user.role === 'admin' ? <Shield size={24} /> : <UserIcon size={24} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-900">{user.displayName}</p>
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {user.role}
                    </span>
                    {user.id === currentUserId && (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-700">
                        You
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">@{user.username}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Password reveal */}
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl">
                  <span className="text-xs text-slate-400 font-mono">
                    {showPasswords[user.id] ? user.password : '••••••••'}
                  </span>
                  <button
                    onClick={() => togglePasswordVisibility(user.id)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPasswords[user.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Edit button */}
                <button
                  onClick={() => handleEdit(user)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all"
                >
                  Edit
                </button>

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(user.id)}
                  disabled={user.id === currentUserId}
                  className={`p-2 rounded-xl transition-all ${
                    user.id === currentUserId 
                      ? 'bg-slate-50 text-slate-300 cursor-not-allowed' 
                      : 'bg-red-50 text-red-500 hover:bg-red-100'
                  }`}
                >
                  <Trash size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Permissions Info */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-3xl p-6 border border-indigo-100">
        <h3 className="font-black text-indigo-900 mb-3">Permission Levels</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/60 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={18} className="text-purple-600" />
              <span className="font-bold text-slate-900">Admin</span>
            </div>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>• Manage all users</li>
              <li>• View & edit all transactions</li>
              <li>• Delete any entry</li>
              <li>• Full system access</li>
            </ul>
          </div>
          <div className="bg-white/60 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <UserIcon size={18} className="text-slate-500" />
              <span className="font-bold text-slate-900">User</span>
            </div>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>• Add/Take stock from any item</li>
              <li>• Edit & delete own entries only</li>
              <li>• View all inventory</li>
              <li>• User name auto-filled from login</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManager;
