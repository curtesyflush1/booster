import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { apiClient } from '../services/apiClient';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setStatus('error');
      setMessage('Please enter a valid email address.');
      return;
    }
    try {
      setStatus('sending');
      await apiClient.post('/auth/forgot-password', { email });
      setStatus('sent');
      setMessage('If an account exists, a reset link has been sent.');
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message || 'Failed to request password reset.');
    }
  };

  return (
    <div className="min-h-screen bg-background-primary flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-display font-bold text-white">Forgot Password</h1>
          <p className="mt-2 text-gray-400">Enter your email to receive a reset link.</p>
        </div>

        <div className="card-dark p-8">
          <form onSubmit={submit} className="space-y-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-300">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-dark w-full"
              placeholder="you@example.com"
            />
            <button type="submit" className="btn btn-primary w-full" disabled={status === 'sending'}>
              {status === 'sending' ? <LoadingSpinner size="sm" /> : 'Send Reset Link'}
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

export default ForgotPasswordPage;

