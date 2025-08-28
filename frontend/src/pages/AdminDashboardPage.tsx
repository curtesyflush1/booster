import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface DashboardStats {
  users: {
    total: number;
    active: number;
    new_today: number;
    new_this_week: number;
    pro_subscribers: number;
    conversion_rate: number;
  };
  alerts: {
    total_sent: number;
    sent_today: number;
    pending: number;
    failed: number;
    success_rate: number;
    avg_delivery_time: number;
  };
  system: {
    uptime: number;
    cpu_usage: number;
    memory_usage: number;
    disk_usage: number;
    api_response_time: number;
    error_rate: number;
  };
  ml_models: {
    active_models: number;
    training_models: number;
    last_training: string | null;
    prediction_accuracy: number;
  };
}

interface User {
  id: string;
  email: string;
  role: string;
  subscription_tier: string;
  email_verified: boolean;
  watch_count: number;
  alert_count: number;
  created_at: string;
  last_activity?: string;
}

const AdminDashboardPage: React.FC = () => {
  const { user, token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'ml' | 'system'>('overview');

  // Check if user is admin
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access the admin dashboard.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const [statsResponse, usersResponse] = await Promise.all([
        fetch('/api/admin/dashboard/stats', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/admin/users?limit=10', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (!statsResponse.ok || !usersResponse.ok) {
        throw new Error('Failed to fetch admin data');
      }

      const statsData = await statsResponse.json();
      const usersData = await usersResponse.json();

      setStats(statsData.data);
      setUsers(usersData.data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="mt-2 text-gray-600">Manage users, monitor system health, and oversee ML operations</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'users', label: 'Users' },
              { key: 'ml', label: 'ML Models' },
              { key: 'system', label: 'System Health' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Users</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total:</span>
                    <span className="font-semibold">{stats.users.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Active:</span>
                    <span className="font-semibold">{stats.users.active}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">New Today:</span>
                    <span className="font-semibold text-green-600">{stats.users.new_today}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pro Subscribers:</span>
                    <span className="font-semibold text-blue-600">{stats.users.pro_subscribers}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Alerts</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Sent:</span>
                    <span className="font-semibold">{stats.alerts.total_sent}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Today:</span>
                    <span className="font-semibold">{stats.alerts.sent_today}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pending:</span>
                    <span className="font-semibold text-yellow-600">{stats.alerts.pending}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Success Rate:</span>
                    <span className="font-semibold text-green-600">{stats.alerts.success_rate}%</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">System</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Uptime:</span>
                    <span className="font-semibold">{formatUptime(stats.system.uptime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">CPU:</span>
                    <span className="font-semibold">{stats.system.cpu_usage.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Memory:</span>
                    <span className="font-semibold">{stats.system.memory_usage.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Response Time:</span>
                    <span className="font-semibold">{stats.system.api_response_time.toFixed(0)}ms</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">ML Models</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Active:</span>
                    <span className="font-semibold text-green-600">{stats.ml_models.active_models}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Training:</span>
                    <span className="font-semibold text-yellow-600">{stats.ml_models.training_models}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Accuracy:</span>
                    <span className="font-semibold">{stats.ml_models.prediction_accuracy}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Training:</span>
                    <span className="font-semibold text-xs">
                      {stats.ml_models.last_training ? formatDate(stats.ml_models.last_training) : 'Never'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Recent Users</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subscription
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Watches
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Alerts
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.email}</div>
                          <div className="text-sm text-gray-500">
                            {user.email_verified ? (
                              <span className="text-green-600">✓ Verified</span>
                            ) : (
                              <span className="text-red-600">✗ Unverified</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.role === 'super_admin' ? 'bg-red-100 text-red-800' :
                          user.role === 'admin' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.subscription_tier === 'pro' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.subscription_tier}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.watch_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.alert_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(user.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ML Models Tab */}
        {activeTab === 'ml' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">ML Model Management</h3>
            <p className="text-gray-600">ML model management interface would go here.</p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="font-medium">Price Prediction Model</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-sm rounded">Active</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="font-medium">Sellout Risk Model</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-sm rounded">Active</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="font-medium">ROI Estimation Model</span>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-sm rounded">Training</span>
              </div>
            </div>
          </div>
        )}

        {/* System Health Tab */}
        {activeTab === 'system' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">System Health</h3>
            <p className="text-gray-600">System health monitoring interface would go here.</p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-800">API Server</h4>
                <p className="text-sm text-green-600">Healthy</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-800">Database</h4>
                <p className="text-sm text-green-600">Healthy</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-800">Retailer Monitoring</h4>
                <p className="text-sm text-green-600">Healthy</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboardPage;