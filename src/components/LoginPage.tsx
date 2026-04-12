'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BarChart3, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    if (isForgot) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setError(error.message);
      } else {
        setMessage('Check your email for a password reset link!');
      }
      setLoading(false);
      return;
    }

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) {
        setError(error.message);
      } else {
        setMessage('Check your email for a confirmation link!');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      }
    }

    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{
          background: 'var(--bg-surface)',
          boxShadow: 'var(--shadow-card)',
          border: '1px solid var(--border-color)',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="flex items-center justify-center w-12 h-12 rounded-xl mb-3"
            style={{ background: 'var(--accent-purple)' }}
          >
            <BarChart3 size={24} color="#fff" />
          </div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Spendwise
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {isForgot ? 'Reset your password' : isSignUp ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && !isForgot && (
            <div>
              <label
                className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Name
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-tertiary)' }}
                />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>
          )}

          <div>
            <label
              className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Email
            </label>
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-tertiary)' }}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          {!isSignUp && !isForgot && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                className="block text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => { setIsForgot(true); setError(''); setMessage(''); }}
                className="text-xs font-semibold"
                style={{ color: 'var(--accent-purple)' }}
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-tertiary)' }}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>
          )}

          {isSignUp && !isForgot && (
          <div>
            <label
              className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Password
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-tertiary)' }}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>
          )}

          {error && (
            <p className="text-sm font-medium px-3 py-2 rounded-lg" style={{ background: '#fef2f2', color: '#dc2626' }}>
              {error}
            </p>
          )}

          {message && (
            <p className="text-sm font-medium px-3 py-2 rounded-lg" style={{ background: '#f0fdf4', color: '#059669' }}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: 'var(--accent-purple)',
              color: '#fff',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                {isForgot ? 'Send Reset Link' : isSignUp ? 'Create Account' : 'Sign In'}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Toggle */}
        <div className="mt-6 text-center">
          {isForgot ? (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Remember your password?{' '}
              <button
                onClick={() => { setIsForgot(false); setError(''); setMessage(''); }}
                className="font-semibold underline"
                style={{ color: 'var(--accent-purple)' }}
              >
                Sign In
              </button>
            </p>
          ) : (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
                setMessage('');
              }}
              className="font-semibold underline"
              style={{ color: 'var(--accent-purple)' }}
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
          )}
        </div>
      </div>
    </div>
  );
}
