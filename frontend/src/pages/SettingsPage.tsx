import React, { useEffect, useState } from 'react';
import { Settings, Lock } from 'lucide-react';
import { useSubscription } from '../context/SubscriptionContext';
import { apiClient } from '../services/apiClient';

const SettingsPage: React.FC = () => {
  const { isProUser } = useSubscription();

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwStatus, setPwStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [pwMessage, setPwMessage] = useState('');

  // Email analytics
  const [emailStats, setEmailStats] = useState<{
    totalSent: number; totalDelivered: number; totalBounced: number; totalComplained: number; deliveryRate: number; lastEmailSent?: string;
  } | null>(null);
  const [emailStatsError, setEmailStatsError] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/email/analytics');
        if (res.data?.userStats) setEmailStats(res.data.userStats);
      } catch (e: any) {
        setEmailStatsError(e?.message || 'Failed to load email analytics');
      }
    })();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage('');
    if (!currentPassword || !newPassword) {
      setPwStatus('error');
      setPwMessage('Please fill out all fields.');
      return;
    }
    if (newPassword.length < 8) {
      setPwStatus('error');
      setPwMessage('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwStatus('error');
      setPwMessage('New passwords do not match.');
      return;
    }
    try {
      setPwStatus('saving');
      await apiClient.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword });
      setPwStatus('success');
      setPwMessage('Password changed successfully.');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: any) {
      setPwStatus('error');
      setPwMessage(err?.message || 'Failed to change password.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center">
        <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h1 className="text-3xl font-display font-bold text-white mb-4">
          Settings
        </h1>
        <p className="text-gray-400 mb-6">Manage your notification and account preferences.</p>
      </div>

      {/* Notification Channels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-dark p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Notification Channels</h2>
          <div className="space-y-3 text-gray-300">
            <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
              <span>Web Push</span>
              <input type="checkbox" defaultChecked className="accent-pokemon-electric" />
            </label>
            <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
              <span>Email</span>
              <input type="checkbox" defaultChecked className="accent-pokemon-electric" />
            </label>
            {isProUser() ? (
              <>
                <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <span>SMS (Pro)</span>
                  <input type="checkbox" className="accent-pokemon-electric" />
                </label>
                <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <span>Discord (Pro)</span>
                  <input type="checkbox" className="accent-pokemon-electric" />
                </label>
              </>
            ) : (
              <div className="p-3 bg-gray-900 rounded-lg text-sm text-gray-400">
                SMS and Discord are available for Pro subscribers.
              </div>
            )}
          </div>
        </div>

        {/* Change Password */}
        <div className="card-dark p-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-gray-300" /> Change Password
          </h2>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input-dark w-full"
              placeholder="Current password"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input-dark w-full"
              placeholder="New password (min 8 chars)"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-dark w-full"
              placeholder="Confirm new password"
            />
            <button type="submit" className="btn btn-primary" disabled={pwStatus === 'saving'}>
              {pwStatus === 'saving' ? 'Saving…' : 'Update Password'}
            </button>
            {pwMessage && (
              <p className={`text-sm ${pwStatus === 'error' ? 'text-red-500' : 'text-green-400'}`}>{pwMessage}</p>
            )}
          </form>
        </div>
      </div>

      {/* Email Analytics */}
      <div className="card-dark p-6 mt-6">
        <h2 className="text-xl font-semibold text-white mb-4">Email Analytics</h2>
        {emailStats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-gray-200 text-sm">
            <div className="bg-gray-800 rounded p-3">Sent: <span className="text-white font-semibold">{emailStats.totalSent}</span></div>
            <div className="bg-gray-800 rounded p-3">Delivered: <span className="text-white font-semibold">{emailStats.totalDelivered}</span></div>
            <div className="bg-gray-800 rounded p-3">Bounced: <span className="text-white font-semibold">{emailStats.totalBounced}</span></div>
            <div className="bg-gray-800 rounded p-3">Complaints: <span className="text-white font-semibold">{emailStats.totalComplained}</span></div>
            <div className="bg-gray-800 rounded p-3">Delivery Rate: <span className="text-white font-semibold">{(emailStats.deliveryRate ?? 0).toFixed(2)}%</span></div>
            <div className="bg-gray-800 rounded p-3">Last Sent: <span className="text-white font-semibold">{emailStats.lastEmailSent ? new Date(emailStats.lastEmailSent).toLocaleString() : '—'}</span></div>
          </div>
        ) : (
          <p className="text-gray-400">{emailStatsError || 'No analytics available yet.'}</p>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
