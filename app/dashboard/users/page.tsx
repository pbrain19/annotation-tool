'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, RefreshCw, Key, Mail as MailIcon, Copy, Check } from 'lucide-react';

interface User {
  id: string;
  username: string;
  role: 'ADMIN' | 'HDM';
  createdAt: string;
  updatedAt: string;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'HDM' as 'ADMIN' | 'HDM', generatePassword: false });
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [resetPasswordModal, setResetPasswordModal] = useState<{ show: boolean; username: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');

      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    setError(null);
    setGeneratedPassword(null);

    try {
      const token = localStorage.getItem('auth_token');

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUser),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      if (data.generatedPassword) {
        setGeneratedPassword(data.generatedPassword);
      }

      setNewUser({ username: '', password: '', role: 'HDM', generatePassword: false });
      await fetchUsers();

      if (!data.generatedPassword) {
        setShowCreateModal(false);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');

      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete user');
      }

      await fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleResetPassword = async (userId: string, username: string) => {
    if (!confirm(`Reset password for user "${username}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');

      const response = await fetch(`/api/users/${userId}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setResetPasswordModal({ show: true, username, password: data.newPassword });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const copyPassword = async (password: string) => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy password:', err);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-zinc-800/50 rounded-xl shadow-2xl p-8 border border-zinc-700">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-indigo-400" />
              <h1 className="text-3xl font-bold text-white">User Management</h1>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create User
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-zinc-400">Loading users...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="text-left py-3 px-4 text-zinc-300 font-semibold">Username</th>
                    <th className="text-left py-3 px-4 text-zinc-300 font-semibold">Role</th>
                    <th className="text-left py-3 px-4 text-zinc-300 font-semibold">Created</th>
                    <th className="text-right py-3 px-4 text-zinc-300 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-zinc-700/50 hover:bg-zinc-800/30">
                      <td className="py-3 px-4 text-zinc-100">{user.username}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          user.role === 'ADMIN'
                            ? 'bg-purple-900/40 text-purple-300 border border-purple-600'
                            : 'bg-blue-900/40 text-blue-300 border border-blue-600'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-400 text-sm">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleResetPassword(user.id, user.username)}
                            className="p-2 hover:bg-zinc-700 rounded transition-colors text-yellow-400 hover:text-yellow-300"
                            title="Reset Password"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id, user.username)}
                            className="p-2 hover:bg-zinc-700 rounded transition-colors text-red-400 hover:text-red-300"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {users.length === 0 && (
                <div className="text-center py-12 text-zinc-400">
                  No users found. Create your first user to get started.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reset Password Modal */}
      {resetPasswordModal?.show && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-4">Password Reset Successfully</h2>

            <div className="mb-4 p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
              <p className="text-yellow-300 font-semibold mb-2">User: {resetPasswordModal.username}</p>
              <p className="text-yellow-200 text-sm mb-2">New password:</p>
              <div className="bg-zinc-900 p-3 rounded font-mono text-yellow-400 break-all">
                {resetPasswordModal.password}
              </div>
              <p className="text-yellow-200 text-xs mt-2">Please save this password securely. It won't be shown again.</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => copyPassword(resetPasswordModal.password)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Password
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setResetPasswordModal(null);
                  setCopied(false);
                }}
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white py-2 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-4">Create New User</h2>

            {generatedPassword && (
              <div className="mb-4 p-4 bg-green-900/20 border border-green-700 rounded-lg">
                <p className="text-green-300 font-semibold mb-2">User created successfully!</p>
                <p className="text-green-200 text-sm mb-2">Generated password:</p>
                <div className="bg-zinc-900 p-3 rounded font-mono text-green-400 break-all">
                  {generatedPassword}
                </div>
                <p className="text-green-200 text-xs mt-2">Please save this password securely. It won't be shown again.</p>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setGeneratedPassword(null);
                  }}
                  className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            )}

            {!generatedPassword && (
              <form onSubmit={handleCreateUser}>
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-zinc-300 mb-2">
                    Username / Email
                  </label>
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="user@example.com"
                    className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-semibold text-zinc-300 mb-2">
                    Role
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'ADMIN' | 'HDM' })}
                    className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    <option value="HDM">HDM</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={newUser.generatePassword}
                      onChange={(e) => setNewUser({ ...newUser, generatePassword: e.target.checked, password: '' })}
                      className="w-4 h-4"
                    />
                    Generate random password
                  </label>
                </div>

                {!newUser.generatePassword && (
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-zinc-300 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      placeholder="Enter password"
                      className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      required={!newUser.generatePassword}
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewUser({ username: '', password: '', role: 'HDM', generatePassword: false });
                    }}
                    className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white py-2 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingUser}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg transition-colors disabled:bg-zinc-700 disabled:cursor-not-allowed"
                  >
                    {creatingUser ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
