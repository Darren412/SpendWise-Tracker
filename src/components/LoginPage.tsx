'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { TrendingUp, Mail, Lock, User, ArrowRight, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]         = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState('');
  const [message, setMessage]   = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setMessage(''); setLoading(true);

    if (isForgot) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      if (error) setError(error.message);
      else setMessage('Check your email for a password reset link!');
      setLoading(false); return;
    }

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
      if (error) setError(error.message);
      else setMessage('Check your email for a confirmation link!');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    }
    setLoading(false);
  };

  const inputStyle = (focused?: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '11px 14px',
    paddingLeft: 40,
    background: focused ? '#fff' : 'var(--bg-subtle)',
    border: `1.5px solid ${focused ? 'var(--brand-500)' : 'var(--border-default)'}`,
    borderRadius: 'var(--r-md)',
    color: 'var(--text-900)',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    outline: 'none',
    boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none',
    transition: 'all 0.15s',
  });

  const features = [
    { icon: '📊', text: 'Real-time analytics' },
    { icon: '🔒', text: 'Secure & private' },
    { icon: '💡', text: 'Spend intelligence' },
    { icon: '☁️', text: 'Cloud sync' },
  ];

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        background: 'var(--bg-canvas)',
      }}
    >
      {/* ── Left branding panel ── */}
      <div
        className="hidden lg:flex"
        style={{
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 52px',
          background: 'linear-gradient(145deg, #4338ca 0%, #6366f1 40%, #8b5cf6 80%, #a78bfa 100%)',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background decoration */}
        <div style={{
          position: 'absolute',
          top: -120,
          right: -80,
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          bottom: -60,
          left: -40,
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 'var(--r-lg)',
            background: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}>
            <TrendingUp size={20} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: '1.375rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Spendwise</span>
        </div>

        {/* Hero copy */}
        <div>
          <h2 style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            marginBottom: 16,
          }}>
            Your personal<br />finance command<br />centre
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '1rem', lineHeight: 1.6, maxWidth: 340 }}>
            Track spending, analyse cash flow, and understand your financial health — all in one premium dashboard.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 32 }}>
            {features.map(f => (
              <div
                key={f.text}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  background: 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(6px)',
                  borderRadius: 'var(--r-lg)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{f.icon}</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom tagline */}
        <div style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.5)' }}>
          Built for clarity · Designed for action
        </div>
      </div>

      {/* ── Right auth panel ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          flex: '0 0 auto',
          width: '100%',
          maxWidth: 480,
        }}
      >
        {/* Mobile logo */}
        <div
          className="flex lg:hidden items-center gap-2.5 mb-10"
          style={{ marginBottom: 40 }}
        >
          <div style={{ width: 38, height: 38, borderRadius: 'var(--r-lg)', background: 'linear-gradient(135deg, var(--brand-600), var(--purple-600))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-brand)' }}>
            <TrendingUp size={18} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-900)', letterSpacing: '-0.02em' }}>Spendwise</span>
        </div>

        <div style={{ width: '100%', maxWidth: 380 }}>

          {/* Heading */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-900)', letterSpacing: '-0.03em', marginBottom: 6 }}>
              {isForgot ? 'Reset password' : isSignUp ? 'Create your account' : 'Welcome back'}
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-500)', lineHeight: 1.5 }}>
              {isForgot
                ? "Enter your email and we'll send a reset link."
                : isSignUp
                  ? 'Get started with Spendwise for free.'
                  : 'Sign in to your Spendwise dashboard.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Name (sign up) */}
            {isSignUp && !isForgot && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)' }}>Full name</label>
                <div style={{ position: 'relative' }}>
                  <User size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-400)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                    style={inputStyle()}
                    onFocus={e => Object.assign(e.target.style, { background: '#fff', borderColor: 'var(--brand-500)', boxShadow: '0 0 0 3px rgba(99,102,241,0.12)' })}
                    onBlur={e => Object.assign(e.target.style, { background: 'var(--bg-subtle)', borderColor: 'var(--border-default)', boxShadow: 'none' })}
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)' }}>Email address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-400)', pointerEvents: 'none' }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  style={inputStyle()}
                  onFocus={e => Object.assign(e.target.style, { background: '#fff', borderColor: 'var(--brand-500)', boxShadow: '0 0 0 3px rgba(99,102,241,0.12)' })}
                  onBlur={e => Object.assign(e.target.style, { background: 'var(--bg-subtle)', borderColor: 'var(--border-default)', boxShadow: 'none' })}
                />
              </div>
            </div>

            {/* Password */}
            {!isForgot && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)' }}>Password</label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => { setIsForgot(true); setError(''); setMessage(''); }}
                      style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--brand-600)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-400)', pointerEvents: 'none' }} />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    style={{ ...inputStyle(), paddingRight: 40 }}
                    onFocus={e => Object.assign(e.target.style, { background: '#fff', borderColor: 'var(--brand-500)', boxShadow: '0 0 0 3px rgba(99,102,241,0.12)' })}
                    onBlur={e => Object.assign(e.target.style, { background: 'var(--bg-subtle)', borderColor: 'var(--border-default)', boxShadow: 'none' })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-400)', padding: 0 }}
                  >
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'var(--red-50)', border: '1px solid var(--red-100)', fontSize: '0.8125rem', color: 'var(--red-600)' }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
                {error}
              </div>
            )}

            {/* Success */}
            {message && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'var(--green-50)', border: '1px solid var(--green-100)', fontSize: '0.8125rem', color: 'var(--green-700)' }}>
                <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                {message}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px',
                borderRadius: 'var(--r-md)',
                border: 'none',
                background: loading ? 'var(--brand-300)' : 'var(--brand-600)',
                color: '#fff',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                boxShadow: loading ? 'none' : 'var(--shadow-brand)',
                transition: 'background 0.15s, box-shadow 0.15s, transform 0.1s',
                transform: 'none',
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget.style.transform = 'translateY(-1px)'); }}
              onMouseLeave={e => { (e.currentTarget.style.transform = 'none'); }}
            >
              {loading
                ? <Loader2 size={16} className="animate-spin" />
                : <>
                    {isForgot ? 'Send Reset Link' : isSignUp ? 'Create Account' : 'Sign In'}
                    <ArrowRight size={15} />
                  </>
              }
            </button>
          </form>

          {/* Toggle sign in/up */}
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            {isForgot ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-500)' }}>
                Remember it?{' '}
                <button
                  onClick={() => { setIsForgot(false); setError(''); setMessage(''); }}
                  style={{ fontWeight: 700, color: 'var(--brand-600)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' }}
                >
                  Sign In
                </button>
              </p>
            ) : (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-500)' }}>
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage(''); }}
                  style={{ fontWeight: 700, color: 'var(--brand-600)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' }}
                >
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </button>
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
