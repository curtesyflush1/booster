import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import AdminRecentTransactionsPanel from '../components/admin/AdminRecentTransactionsPanel';

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
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'ml' | 'system' | 'purchases'>('overview');

  // ML model state
  interface PriceModelMetadata {
    trainedAt: string;
    features: string[];
    coef: number[];
    file: { path: string; sizeBytes: number; modifiedAt: string };
  }
  const [priceModel, setPriceModel] = useState<PriceModelMetadata | null>(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlError, setMlError] = useState<string | null>(null);
  const [retraining, setRetraining] = useState(false);
  const [retrainMetrics, setRetrainMetrics] = useState<{ rows?: number; r2?: number } | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [statsResponse, usersResponse] = await Promise.all([
        apiClient.get<{ data: DashboardStats }>('/admin/dashboard/stats'),
        apiClient.get<{ data: { users: User[] } }>('/admin/users', { params: { page: 1, limit: 10 } })
      ]);

      setStats(statsResponse.data.data);
      setUsers(usersResponse.data.data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const loadPriceModelMetadata = useCallback(async () => {
    try {
      setMlLoading(true);
      setMlError(null);
      setRetrainMetrics(null);
      const res = await apiClient.get<{ success: boolean; data: PriceModelMetadata }>(
        '/admin/ml/models/price/metadata'
      );
      setPriceModel(res.data.data);
    } catch (e) {
      setMlError(e instanceof Error ? e.message : 'Failed to load model metadata');
    } finally {
      setMlLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'ml') {
      loadPriceModelMetadata();
    }
  }, [activeTab, loadPriceModelMetadata]);

  const handleRetrain = async () => {
    try {
      setRetraining(true);
      setMlError(null);
      setRetrainMetrics(null);
      const res = await apiClient.post<{ success: boolean; data: { metrics?: { rows?: number; r2?: number } } }>(
        '/admin/ml/models/price/retrain',
        {},
        { timeout: 120000 }
      );
      const metrics = res.data?.data?.metrics || null;
      setRetrainMetrics(metrics);
      await loadPriceModelMetadata();
      if (metrics && (metrics.rows !== undefined || metrics.r2 !== undefined)) {
        const rowsTxt = metrics.rows !== undefined ? `rows ${metrics.rows}` : '';
        const r2Txt = metrics.r2 !== undefined ? `R² ${(Number(metrics.r2)).toFixed(4)}` : '';
        const parts = [rowsTxt, r2Txt].filter(Boolean).join(', ');
        toast.success(parts ? `Model retrained: ${parts}` : 'Model retrained successfully');
      } else {
        toast.success('Model retrained successfully');
      }
    } catch (e) {
      setMlError(e instanceof Error ? e.message : 'Failed to retrain model');
      toast.error('Retrain failed');
    } finally {
      setRetraining(false);
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
              { key: 'purchases', label: 'Purchases' },
              { key: 'system', label: 'System Health' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'overview' | 'users' | 'ml' | 'system' | 'purchases')}
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

        {/* Purchases Tab */}
        {activeTab === 'purchases' && (
          <AdminRecentTransactionsPanel />
        )}

        {/* ML Models Tab */}
        {activeTab === 'ml' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">ML Model Management</h3>
            {mlError && (
              <div className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm">{mlError}</div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Metadata Card */}
              <div className="lg:col-span-2">
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900">Price Prediction Model</h4>
                    <button
                      onClick={loadPriceModelMetadata}
                      className="text-sm text-blue-600 hover:underline disabled:text-gray-400"
                      disabled={mlLoading || retraining}
                    >
                      Refresh
                    </button>
                  </div>
                  {mlLoading ? (
                    <div className="text-gray-600 text-sm">Loading model metadata…</div>
                  ) : priceModel ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex gap-2"><span className="text-gray-500 w-28">Trained At:</span><span className="text-gray-900">{new Date(priceModel.trainedAt).toLocaleString()}</span></div>
                      <div className="flex gap-2"><span className="text-gray-500 w-28">Features:</span><span className="text-gray-900">{priceModel.features.join(', ')}</span></div>
                      <div className="flex gap-2 items-start">
                        <span className="text-gray-500 w-28">Coefficients:</span>
                        <span className="text-gray-900">
                          {priceModel.coef.slice(0, 6).map((c, i) => (
                            <span key={i} className="inline-block mr-2">{c.toFixed(4)}</span>
                          ))}
                          {priceModel.coef.length > 6 && <span className="text-gray-500">… (+{priceModel.coef.length - 6} more)</span>}
                        </span>
                      </div>
                      <div className="flex gap-2"><span className="text-gray-500 w-28">Model File:</span><span className="text-gray-900 break-all">{priceModel.file.path} • {(priceModel.file.sizeBytes/1024).toFixed(1)} KB</span></div>
                    </div>
                  ) : (
                    <div className="text-gray-600 text-sm">No model metadata found.</div>
                  )}
                </div>
              </div>

              {/* Actions Card */}
              <div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Actions</h4>
                  <button
                    onClick={handleRetrain}
                    disabled={retraining}
                    className={`w-full py-2 px-3 rounded text-white ${retraining ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                  >
                    {retraining ? 'Retraining…' : 'Retrain Price Model'}
                  </button>
                  {retrainMetrics && (
                    <div className="mt-4 text-sm">
                      <div className="text-gray-500">Last Retrain Metrics</div>
                      <div className="flex gap-2"><span className="w-20 text-gray-500">Rows:</span><span className="text-gray-900">{retrainMetrics.rows ?? '—'}</span></div>
                      <div className="flex gap-2"><span className="w-20 text-gray-500">R²:</span><span className="text-gray-900">{retrainMetrics.r2 !== undefined ? Number(retrainMetrics.r2).toFixed(4) : '—'}</span></div>
                    </div>
                  )}
                  <p className="mt-3 text-xs text-gray-500">Requires admin role with ML train permission.</p>
                </div>
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
