import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const ContactPage: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setError(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to send');
      setStatus('sent');
      setName(''); setEmail(''); setSubject(''); setMessage('');
    } catch (err: any) {
      setError(err?.message || 'Failed to send message');
      setStatus('error');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-2 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <Link
          to="/"
          className="text-sm text-gray-300 hover:text-white"
        >
          Home
        </Link>
      </div>
      <h1 className="text-3xl font-display font-bold text-white mb-4">Contact Us</h1>
      <p className="text-gray-300 mb-6">
        We’d love to hear from you. For support, feedback, or partnership inquiries, send us a message.
      </p>

      {status === 'sent' && (
        <div className="mb-6 p-4 rounded bg-green-900/30 border border-green-700 text-green-200">
          Thanks! Your message has been sent.
        </div>
      )}
      {status === 'error' && error && (
        <div className="mb-6 p-4 rounded bg-red-900/30 border border-red-700 text-red-200">
          {error}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-gray-300 text-sm mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100}
                 className="w-full px-3 py-2 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600" />
        </div>
        <div>
          <label className="block text-gray-300 text-sm mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                 className="w-full px-3 py-2 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600" />
        </div>
        <div>
          <label className="block text-gray-300 text-sm mb-1">Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={150}
                 className="w-full px-3 py-2 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600" />
        </div>
        <div>
          <label className="block text-gray-300 text-sm mb-1">Message</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={6} maxLength={5000}
                    className="w-full px-3 py-2 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600" />
        </div>
        <button type="submit" disabled={status === 'sending'}
                className="btn btn-primary">
          {status === 'sending' ? 'Sending…' : 'Send Message'}
        </button>
      </form>
    </div>
  );
};

export default ContactPage;
