import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { apiClient } from '../services/apiClient';

const ResetPasswordPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const urlToken = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('token') || '';
  }, [location.search]);

  const [token, setToken] = useState(urlToken);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'resetting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    if (!token) {
      setStatus('error');
      setMessage('Missing reset token.');
      return;
    }
    if (!password || password.length < 8) {
      setStatus('error');
      setMessage('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setStatus('error');
      setMessage('Passwords do not match.');
      return;
    }
    try {
      setStatus('resetting');
      await apiClient.post('/auth/reset-password', { token, password });
      setStatus('success');
      setMessage('Password reset successful. Redirecting to login…');
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message || 'Failed to reset password.');
    }
  };

  return (
    <div className="min-h-screen bg-background-primary flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-display font-bold text-white">Reset Password</h1>
          <p className="mt-2 text-gray-400">Enter a new password to regain access.</p>
        </div>

        <div className="card-dark p-8">
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm font-medium text-gray-300">Reset token</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="input-dark w-full"
              placeholder="Paste your token or use the link"
            />

            <label className="block text-sm font-medium text-gray-300">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-dark w-full"
              placeholder="********"
            />

            <label className="block text-sm font-medium text-gray-300">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input-dark w-full"
              placeholder="********"
            />

            <button type="submit" className="btn btn-primary w-full" disabled={status === 'resetting'}>
              {status === 'resetting' ? <LoadingSpinner size="sm" /> : 'Reset Password'}
            </button>
          </form>

          {status !== 'idle' && message && (
            <p className={`mt-4 text-sm ${status === 'error' ? 'text-red-500' : 'text-green-400'}`}>{message}</p>
          )}

          <div className="text-center mt-6">
            <Link to="/login" className="text-primary-400 hover:text-primary-300">Back to login</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;

