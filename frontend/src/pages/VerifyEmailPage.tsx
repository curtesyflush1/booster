import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { apiClient } from '../services/apiClient';

type VerifyState = 'idle' | 'verifying' | 'success' | 'error';

const VerifyEmailPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const urlToken = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('token');
  }, [location.search]);

  const [status, setStatus] = useState<VerifyState>(urlToken ? 'verifying' : 'idle');
  const [message, setMessage] = useState<string>('');
  const [tokenInput, setTokenInput] = useState<string>('');
  const [resendEmail, setResendEmail] = useState<string>('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendMessage, setResendMessage] = useState<string>('');

  useEffect(() => {
    const verifyFromUrl = async () => {
      if (!urlToken) return;
      try {
        setStatus('verifying');
        setMessage('');
        await apiClient.post('/auth/verify-email', { token: urlToken });
        setStatus('success');
        setMessage('Your email has been verified successfully. You can now log in.');
      } catch (err: any) {
        setStatus('error');
        setMessage(err?.message || 'Verification failed. The link may be invalid or expired.');
      }
    };
    verifyFromUrl();
  }, [urlToken]);

  // Auto-redirect to login after successful verification
  useEffect(() => {
    if (status !== 'success') return;
    const t = setTimeout(() => {
      navigate('/login', { replace: true });
    }, 3000);
    return () => clearTimeout(t);
  }, [status, navigate]);

  const extractToken = (input: string): string => {
    // Try to parse token from full URL or treat input as raw token
    try {
      // If input looks like a URL, parse it
      if (input.startsWith('http://') || input.startsWith('https://')) {
        const u = new URL(input);
        const qp = u.searchParams.get('token');
        if (qp) return qp;
        const parts = u.pathname.split('/').filter(Boolean);
        const idx = parts.findIndex(p => p === 'verify-email');
        if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
      }
      // Fallback: token=... embedded in text
      const match = input.match(/token=([^&\s]+)/i);
      if (match?.[1]) return match[1];
    } catch (_) {
      // ignore parsing errors and fall through
    }
    return input.trim();
  };

  const handleManualVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = extractToken(tokenInput);
    if (!token) {
      setStatus('error');
      setMessage('Please provide a verification token or link.');
      return;
    }
    try {
      setStatus('verifying');
      setMessage('');
      await apiClient.post('/auth/verify-email', { token });
      setStatus('success');
      setMessage('Your email has been verified successfully. You can now log in.');
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message || 'Verification failed. The token may be invalid or expired.');
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendMessage('');
    if (!resendEmail || !/\S+@\S+\.\S+/.test(resendEmail)) {
      setResendStatus('error');
      setResendMessage('Please enter a valid email address.');
      return;
    }
    try {
      setResendStatus('sending');
      await apiClient.post('/auth/resend-verification', { email: resendEmail });
      setResendStatus('sent');
      setResendMessage('Verification email sent. Please check your inbox.');
    } catch (err: any) {
      setResendStatus('error');
      setResendMessage(err?.message || 'Failed to resend verification email.');
    }
  };

  return (
    <div className="min-h-screen bg-background-primary flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-display font-bold text-white">Verify Your Email</h1>
          <p className="mt-2 text-gray-400">Confirm your email to start using all features.</p>
        </div>

        <div className="card-dark p-8 space-y-6">
          {status === 'verifying' && (
            <div className="flex flex-col items-center text-center space-y-3">
              <LoadingSpinner />
              <p className="text-gray-300">Verifying your email, please wait…</p>
            </div>
          )}

          {status === 'success' && (
            <div className="rounded-md bg-green-50 border border-green-200 p-4">
              <p className="text-green-800">{message || 'Email verified successfully.'}</p>
              <p className="text-green-700 mt-2">Redirecting to login…</p>
            </div>
          )}

          {status === 'error' && (
            <div className="rounded-md bg-red-50 border border-red-200 p-4">
              <p className="text-red-700">{message || 'Verification failed.'}</p>
            </div>
          )}

          {/* Manual verify form (visible when no token in URL or after an error) */}
          {(status === 'idle' || status === 'error') && (
            <form onSubmit={handleManualVerify} className="space-y-4">
              <label htmlFor="token" className="block text-sm font-medium text-gray-300">
                Paste your verification link or token
              </label>
              <input
                id="token"
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste the link or token here"
                className="input-dark w-full"
              />
              <button type="submit" className="btn btn-pokemon-electric w-full">
                Verify Email
              </button>
            </form>
          )}

          {/* Resend verification email */}
          <div className="pt-2 border-t border-gray-800">
            <h2 className="text-lg font-semibold text-white mb-2">Need a new verification email?</h2>
            <form onSubmit={handleResend} className="space-y-3">
              <label htmlFor="resend-email" className="block text-sm font-medium text-gray-300">
                Enter your email address
              </label>
              <input
                id="resend-email"
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-dark w-full"
              />
              <button
                type="submit"
                className="btn btn-primary w-full flex items-center justify-center"
                disabled={resendStatus === 'sending'}
              >
                {resendStatus === 'sending' ? <LoadingSpinner size="sm" /> : 'Resend Verification Email'}
              </button>
            </form>
            {resendStatus !== 'idle' && resendMessage && (
              <p className={`mt-3 text-sm ${resendStatus === 'error' ? 'text-red-500' : 'text-green-400'}`}>
                {resendMessage}
              </p>
            )}
          </div>

          {/* Login link */}
          <div className="text-center pt-2">
            <p className="text-gray-400">
              Ready to continue?{' '}
              <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">
                Go to login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
