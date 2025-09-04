import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import AdminRecentTransactionsPanel from '../components/admin/AdminRecentTransactionsPanel';
import ReactMemo = React.memo;

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
  const [dropRetraining, setDropRetraining] = useState(false);
  const [dropRetrainMetrics, setDropRetrainMetrics] = useState<{ feature_rows?: number; events_30d?: number; retailers_30d?: number } | null>(null);
  const [budgets, setBudgets] = useState<Array<{ slug: string; qpm: number; source: string; key: string; limiter?: { count: number; ttl: number } }>>([]);
  const [budgetsLoading, setBudgetsLoading] = useState(false);
  const [budgetsDirty, setBudgetsDirty] = useState<Record<string, number>>({});
  const [clfMetrics, setClfMetrics] = useState<{ exists?: boolean; trainedAt?: string; metrics?: { rows?: number; auc?: number; precisionAt10?: number } }|null>(null);
  const [clfFlags, setClfFlags] = useState<{ primaryEnabled: boolean; threshold: number }>({ primaryEnabled: false, threshold: 0.5 });
  const [clfSaving, setClfSaving] = useState(false);
  const [tsData, setTsData] = useState<{ times: string[]; data: Record<string, { requests: number[]; blocked: number[]; errors: number[] }> } | null>(null);
  const [liveSummary, setLiveSummary] = useState<{ hours: string[]; urlLive: number[]; inStock: number[]; total: number } | null>(null);

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
      (async () => {
        try {
          setBudgetsLoading(true);
          const res = await apiClient.get<{ success: boolean; data: { budgets: Array<{ slug: string; qpm: number; source: string; key: string; limiter?: { count: number; ttl: number } }> } }>('/monitoring/drop-budgets');
          setBudgets(res.data.data.budgets);
        } catch (e) {
          // ignore
        } finally {
          setBudgetsLoading(false);
        }
      })();
      (async () => {
        try {
          const [statusRes, flagRes] = await Promise.all([
            apiClient.get<{ success: boolean; data: any }>('/monitoring/drop-classifier'),
            apiClient.get<{ success: boolean; data: { primaryEnabled: boolean; threshold: number } }>('/monitoring/drop-classifier/flags')
          ]);
          setClfMetrics(statusRes.data.data || null);
          setClfFlags(flagRes.data.data);
        } catch {}
      })();
      (async () => {
        try {
          // If budgets already loaded, use their slugs; else omit slugs to fetch all
          const slugsParam = budgets.length ? budgets.map(b=>b.slug).join(',') : '';
          const res = await apiClient.get<{ success:boolean; data: { times: string[]; data: Record<string, { requests: number[]; blocked: number[]; errors: number[] }> } }>('/monitoring/drop-timeseries', { params: { minutes: 60, slugs: slugsParam } });
          setTsData(res.data.data);
        } catch {}
      })();
      (async () => {
        try {
          const res = await apiClient.get<{ success: boolean; data: { hours: string[]; urlLive: number[]; inStock: number[]; total: number } }>('/monitoring/drop-live-summary');
          setLiveSummary(res.data.data);
        } catch {}
      })();
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

  const handleRetrainDrops = async () => {
    try {
      setDropRetraining(true);
      setMlError(null);
      setDropRetrainMetrics(null);
      // Optional config can include horizon/lookback
      const res = await apiClient.post<{ success: boolean; data: { metrics?: { feature_rows?: number; events_30d?: number; retailers_30d?: number } } }>(
        '/admin/ml/models/drop-windows/retrain',
        { lookbackDays: 30, horizonDays: 30 },
        { timeout: 180000 }
      );
      const metrics = res.data?.data?.metrics || null;
      setDropRetrainMetrics(metrics);
      if (metrics) {
        const parts: string[] = [];
        if (metrics.feature_rows !== undefined) parts.push(`features ${metrics.feature_rows}`);
        if (metrics.events_30d !== undefined) parts.push(`events30d ${metrics.events_30d}`);
        if (metrics.retailers_30d !== undefined) parts.push(`retailers ${metrics.retailers_30d}`);
        toast.success(parts.length ? `Drop model retrained: ${parts.join(', ')}` : 'Drop model retrained');
      } else {
        toast.success('Drop model retrained');
      }
    } catch (e) {
      setMlError(e instanceof Error ? e.message : 'Failed to retrain drop model');
      toast.error('Drop retrain failed');
    } finally {
      setDropRetraining(false);
    }
  };

  const updateBudgetValue = (slug: string, val: string) => {
    const num = parseInt(val || '0', 10);
    setBudgetsDirty(prev => ({ ...prev, [slug]: isNaN(num) ? 0 : num }));
  };

  const saveBudgets = async () => {
    try {
      const updates = Object.entries(budgetsDirty).filter(([_, v]) => v > 0).map(([slug, qpm]) => ({ slug, qpm }));
      if (updates.length === 0) return;
      await apiClient.put('/monitoring/drop-budgets', { budgets: updates });
      toast.success('Budgets updated');
      setBudgetsDirty({});
      const res = await apiClient.get<{ success: boolean; data: { budgets: any[] } }>('/monitoring/drop-budgets');
      setBudgets(res.data.data.budgets);
    } catch (e) {
      toast.error('Failed to update budgets');
    }
  };

  const saveClfFlags = async () => {
    try {
      setClfSaving(true);
      await apiClient.put('/monitoring/drop-classifier/flags', clfFlags);
      toast.success('Classifier flags updated');
    } catch {
      toast.error('Failed to update classifier flags');
    } finally {
      setClfSaving(false);
    }
  };

  const runDryRun = async () => {
    try {
      const res = await apiClient.post('/admin/catalog/ingestion/dry-run', {} , { timeout: 180000 });
      toast.success(`Dry-run OK: discovered ${res.data?.data?.discovered ?? '?'} items`);
    } catch (e) {
      toast.error('Dry-run failed');
    }
  };

  const runIngestion = async () => {
    try {
      const res = await apiClient.post('/admin/catalog/ingestion/run', {}, { timeout: 300000 });
      toast.success(`Ingestion OK: upserted ${res.data?.data?.upserted ?? '?'} items`);
    } catch (e) {
      toast.error('Ingestion failed');
    }
  };

  const [adminToolsEmail, setAdminToolsEmail] = React.useState('');
  const [adminToolsPassword, setAdminToolsPassword] = React.useState('');
  const setPassword = async () => {
    try {
      if (!adminToolsEmail || !adminToolsPassword) { toast.error('Email and new password required'); return; }
      await apiClient.post('/admin/users/set-password', { email: adminToolsEmail, newPassword: adminToolsPassword });
      toast.success('Password updated');
    } catch { toast.error('Failed to set password'); }
  };
  const grantAdmin = async () => {
    try {
      if (!adminToolsEmail) { toast.error('Email required'); return; }
      await apiClient.post('/admin/users/grant-admin', { email: adminToolsEmail, role: 'admin' });
      toast.success('Granted admin role');
    } catch { toast.error('Failed to grant role'); }
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
                  <button
                    onClick={handleRetrainDrops}
                    disabled={dropRetraining}
                    className={`w-full mt-3 py-2 px-3 rounded text-white ${dropRetraining ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                  >
                    {dropRetraining ? 'Retraining…' : 'Retrain Drop Windows'}
                  </button>
                  <RunCheckerCard />
                  {retrainMetrics && (
                    <div className="mt-4 text-sm">
                      <div className="text-gray-500">Last Retrain Metrics</div>
                      <div className="flex gap-2"><span className="w-20 text-gray-500">Rows:</span><span className="text-gray-900">{retrainMetrics.rows ?? '—'}</span></div>
                      <div className="flex gap-2"><span className="w-20 text-gray-500">R²:</span><span className="text-gray-900">{retrainMetrics.r2 !== undefined ? Number(retrainMetrics.r2).toFixed(4) : '—'}</span></div>
                    </div>
                  )}
                  {dropRetrainMetrics && (
                    <div className="mt-4 text-sm">
                      <div className="text-gray-500">Drop Windows Metrics</div>
                      <div className="flex gap-2"><span className="w-32 text-gray-500">Features:</span><span className="text-gray-900">{dropRetrainMetrics.feature_rows ?? '—'}</span></div>
                      <div className="flex gap-2"><span className="w-32 text-gray-500">Events 30d:</span><span className="text-gray-900">{dropRetrainMetrics.events_30d ?? '—'}</span></div>
                      <div className="flex gap-2"><span className="w-32 text-gray-500">Retailers 30d:</span><span className="text-gray-900">{dropRetrainMetrics.retailers_30d ?? '—'}</span></div>
                    </div>
                  )}
                  <p className="mt-3 text-xs text-gray-500">Requires admin role with ML train permission.</p>
                </div>
              </div>
            </div>

            {/* Drop Budgets Card */}
            <div className="mt-6 border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">Drop Candidate Budgets</h4>
                <button onClick={saveBudgets} disabled={Object.keys(budgetsDirty).length===0} className={`text-sm px-3 py-1 rounded ${Object.keys(budgetsDirty).length===0 ? 'bg-gray-300 text-gray-600' : 'bg-green-600 text-white hover:bg-green-700'}`}>Save</button>
              </div>
              {budgetsLoading ? (
                <div className="text-sm text-gray-600">Loading budgets…</div>
              ) : budgets.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-2 pr-4">Retailer</th>
                        <th className="py-2 pr-4">QPM</th>
                        <th className="py-2 pr-4">Source</th>
                        <th className="py-2 pr-4">Limiter</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budgets.map(b => (
                        <tr key={b.slug} className="border-t">
                          <td className="py-2 pr-4 font-medium text-gray-900">{b.slug}</td>
                          <td className="py-2 pr-4">
                            <input type="number" min={1} className="w-24 border rounded px-2 py-1"
                              defaultValue={b.qpm}
                              onChange={e => updateBudgetValue(b.slug, e.target.value)} />
                          </td>
                          <td className="py-2 pr-4 text-gray-700">{b.source}</td>
                          <td className="py-2 pr-4 text-gray-700">{b.limiter ? `${b.limiter.count} req, ttl ${b.limiter.ttl}s` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-xs text-gray-500">Updates are stored in Redis at keys: config:url_candidate:qpm:&lt;slug&gt; (takes effect immediately).</p>
                </div>
              ) : (
                <div className="text-sm text-gray-600">No retailers found.</div>
              )}
            </div>

            {/* Rate Status Sparklines */}
            <div className="mt-6 border rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">Budgets / Rate Status</h4>
              {tsData ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  {Object.keys(tsData.data).map(slug => (
                    <div key={slug} className="p-3 bg-gray-50 rounded">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">{slug}</span>
                        <span className="text-xs text-gray-500">last 60m</span>
                      </div>
                      <Sparkline label="requests" values={tsData.data[slug].requests} color="#2563eb" />
                      <Sparkline label="blocked" values={tsData.data[slug].blocked} color="#dc2626" />
                      <Sparkline label="errors" values={tsData.data[slug].errors} color="#f59e0b" />
                      <RateRow slug={slug} ts={tsData} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-600">Loading sparkline data…</div>
              )}
            </div>

            {/* Classifier Metrics & Rollout */}
            <div className="mt-6 border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">Drop Classifier (Shadow)</h4>
              </div>
              <CalibrateClassifierCard />
              {clfMetrics?.exists ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-gray-500">Trained</div>
                    <div className="text-gray-900">{clfMetrics?.trainedAt ? new Date(clfMetrics.trainedAt).toLocaleString() : '—'}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-gray-500">AUC</div>
                    <div className="text-gray-900">{clfMetrics?.metrics?.auc ?? '—'}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-gray-500">Precision@10%</div>
                    <div className="text-gray-900">{clfMetrics?.metrics?.precisionAt10 ?? '—'}</div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600">No classifier calibration found yet.</div>
              )}

              <div className="mt-4 flex items-center gap-4">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={clfFlags.primaryEnabled} onChange={e => setClfFlags(prev => ({ ...prev, primaryEnabled: e.target.checked }))} />
                  Use classifier as primary (rollout)
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  Threshold
                  <input type="number" min={0} max={1} step={0.01} value={clfFlags.threshold} onChange={e => setClfFlags(prev => ({ ...prev, threshold: Math.max(0, Math.min(1, parseFloat(e.target.value || '0'))) }))} className="w-24 border rounded px-2 py-1" />
                </label>
                <button onClick={saveClfFlags} disabled={clfSaving} className={`text-sm px-3 py-1 rounded ${clfSaving ? 'bg-gray-300 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>Save</button>
              </div>
              <p className="mt-2 text-xs text-gray-500">When enabled, primary confidence may be driven by the classifier probability with the specified threshold. Suggest enabling after AUC/precision meet targets.</p>
            </div>

            {/* Live Promotions Summary */}
            <div className="mt-6 border rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">Live Promotions (last 24h)</h4>
              {liveSummary ? (
                <div className="text-sm">
                  <div className="flex items-center gap-6 mb-2">
                    <div className="p-2 bg-gray-50 rounded">
                      <div className="text-gray-500">Total</div>
                      <div className="text-gray-900 font-medium">{liveSummary.total}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Sparkline label="url_live" values={liveSummary.urlLive} color="#16a34a" height={40} />
                    </div>
                    <div>
                      <Sparkline label="in_stock" values={liveSummary.inStock} color="#0ea5e9" height={40} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600">Loading summary…</div>
              )}
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

// Minimal inline sparkline component for small time-series
const Sparkline: React.FC<{ label: string; values: number[]; color?: string; height?: number }> = React.memo(({ label, values, color = '#2563eb', height = 32 }) => {
  const max = Math.max(1, ...values);
  const w = Math.max(60, values.length);
  const h = height;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1 || 1)) * (w - 2) + 1;
    const y = h - 1 - (v / max) * (h - 2);
    return `${x},${y}`;
  }).join(' ');
  return (
    <div className="mt-1">
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts} />
      </svg>
    </div>
  );
});

const RateRow: React.FC<{ slug: string; ts: { times: string[]; data: Record<string, { requests: number[]; blocked: number[]; errors: number[] }> } }> = React.memo(({ slug, ts }) => {
  const series = ts.data[slug];
  const n = series.requests.length;
  const half = Math.floor(Math.min(10, Math.max(1, n/2)));
  const sum = (arr: number[], start: number, end: number) => arr.slice(start, end).reduce((a,b)=>a+b,0);
  const lastReq = sum(series.requests, n - half, n);
  const prevReq = sum(series.requests, Math.max(0, n - 2*half), n - half);
  const lastBlk = sum(series.blocked, n - half, n);
  const prevBlk = sum(series.blocked, Math.max(0, n - 2*half), n - half);
  const lastErr = sum(series.errors, n - half, n);
  const prevErr = sum(series.errors, Math.max(0, n - 2*half), n - half);
  const rate = lastReq > 0 ? ((lastBlk + lastErr) / lastReq) : 0;
  const prevRate = prevReq > 0 ? ((prevBlk + prevErr) / prevReq) : 0;
  const trend = rate > prevRate + 0.02 ? 'up' : rate < prevRate - 0.02 ? 'down' : 'flat';
  const arrow = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '■';
  const color = trend === 'up' ? 'text-red-600' : trend === 'down' ? 'text-green-600' : 'text-gray-600';
  return (
    <div className="mt-2 text-xs text-gray-700">
      <span>blocked/errors rate (10m): </span>
      <span className={`font-medium ${color}`}>{(rate*100).toFixed(1)}% {arrow}</span>
    </div>
  );
});

// Small helpers to run checker/calibration and smoke tests from UI
const RunCheckerCard: React.FC = () => {
  const [limit, setLimit] = React.useState(10);
  const [timeout, setTimeoutMs] = React.useState(8000);
  const [provider, setProvider] = React.useState<'browser'|'forward'|'direct'|'proxy'|'forward'>('browser');
  const [running, setRunning] = React.useState(false);
  const run = async () => {
    try {
      setRunning(true);
      await apiClient.post('/monitoring/url-candidates/check', { limit, timeout, provider, render: true }, { timeout: Math.max(timeout+2000, 15000) });
      toast.success('Checker batch triggered');
    } catch {
      toast.error('Checker batch failed');
    } finally { setRunning(false); }
  };
  const smoke = async () => {
    try { const r = await apiClient.post('/monitoring/smoke-tests', {}); toast.success(r.data?.success ? 'Smoke OK' : 'Smoke returned'); } catch { toast.error('Smoke tests failed'); }
  };
  return (
              <div className="mt-3 p-3 border rounded">
                <div className="text-sm font-medium text-gray-900 mb-2">Run Candidate Checker</div>
      <div className="flex gap-2 items-center text-sm mb-2">
        <label>Limit <input type="number" min={1} max={50} value={limit} onChange={e=>setLimit(parseInt(e.target.value||'10',10))} className="w-20 border rounded px-2 py-1" /></label>
        <label>Timeout <input type="number" min={1000} max={30000} value={timeout} onChange={e=>setTimeoutMs(parseInt(e.target.value||'8000',10))} className="w-24 border rounded px-2 py-1" /></label>
        <label>Provider
          <select value={provider} onChange={e=>setProvider(e.target.value as any)} className="ml-2 border rounded px-2 py-1">
            <option value="browser">browser</option>
            <option value="forward">forward</option>
            <option value="direct">direct</option>
            <option value="proxy">proxy</option>
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={run} disabled={running} className={`text-sm px-3 py-1 rounded ${running?'bg-gray-300 text-gray-600':'bg-purple-600 text-white hover:bg-purple-700'}`}>Run Checker</button>
                <button onClick={smoke} className="text-sm px-3 py-1 rounded bg-gray-800 text-white hover:bg-gray-900">Run Smoke Tests</button>
              </div>
    </div>
  );
};

const CalibrateClassifierCard: React.FC = () => {
  const [running, setRunning] = React.useState(false);
  const run = async () => {
    try {
      setRunning(true);
      await apiClient.post('/monitoring/drop-classifier/train', { lookbackDays: 30, horizonMinutes: 60, historyWindowDays: 7, sampleStepMinutes: 60, maxSamples: 3000 }, { timeout: 180000 });
      toast.success('Classifier calibration started');
    } catch {
      toast.error('Classifier calibration failed');
    } finally { setRunning(false); }
  };
  return (
    <div className="mb-3">
      <button onClick={run} disabled={running} className={`text-sm px-3 py-1 rounded ${running?'bg-gray-300 text-gray-600':'bg-blue-600 text-white hover:bg-blue-700'}`}>Calibrate Drop Classifier Now</button>
    </div>
  );
};
