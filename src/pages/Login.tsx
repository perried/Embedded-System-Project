/**
 * Login.tsx
 * =========
 * Login / Register page for the TRSMS NOC Dashboard.
 * Toggles between Sign In and Create Account views.
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Loader2, Eye, EyeOff, UserPlus } from 'lucide-react';

export default function Login() {
    const { login } = useAuth();
    const [mode, setMode] = useState<'login' | 'register'>('login');

    // Shared fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Register-only fields
    const [fullName, setFullName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState<'operator' | 'admin'>('operator');

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const resetForm = () => {
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setFullName('');
        setError('');
        setSuccess('');
    };

    const switchMode = (m: 'login' | 'register') => {
        resetForm();
        setMode(m);
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
        } catch (err: any) {
            setError(err.message || 'Login failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!fullName.trim()) return setError('Full name is required.');
        if (password !== confirmPassword) return setError('Passwords do not match.');
        if (password.length < 6) return setError('Password must be at least 6 characters.');

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name: fullName, email, password, role }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Registration failed.');
            setSuccess('Account created! You can now sign in.');
            setTimeout(() => switchMode('login'), 1800);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const inputClass =
        'w-full bg-[var(--bg-dashboard)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors';
    const labelClass = 'text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]';

    return (
        <div className="min-h-screen bg-[var(--bg-dashboard)] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-sm"
            >
                {/* Logo / Branding */}
                <div className="text-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                        {mode === 'login'
                            ? <Shield className="w-7 h-7 text-emerald-500" />
                            : <UserPlus className="w-7 h-7 text-emerald-500" />
                        }
                    </div>
                    <h1 className="text-2xl font-bold text-[var(--text-primary)]">TRSMS</h1>
                    <p className="text-xs text-[var(--text-muted)] mt-1 uppercase tracking-widest">NOC Dashboard</p>
                </div>

                {/* Mode toggle tabs */}
                <div className="flex bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-1 mb-4">
                    {(['login', 'register'] as const).map(m => (
                        <button
                            key={m}
                            onClick={() => switchMode(m)}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${mode === m
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                        >
                            {m === 'login' ? 'Sign In' : 'Create Account'}
                        </button>
                    ))}
                </div>

                {/* Form card */}
                <AnimatePresence mode="wait">
                    {mode === 'login' ? (
                        <motion.form
                            key="login"
                            onSubmit={handleLogin}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 12 }}
                            transition={{ duration: 0.2 }}
                            className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-6 shadow-xl space-y-4"
                        >
                            <div className="space-y-1.5">
                                <label className={labelClass}>Email</label>
                                <input id="email" type="email" autoComplete="email" required value={email}
                                    onChange={e => setEmail(e.target.value)} placeholder="operator@trsms.local" className={inputClass} />
                            </div>

                            <div className="space-y-1.5">
                                <label className={labelClass}>Password</label>
                                <PasswordInput value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword(p => !p)} />
                            </div>

                            {error && <ErrorBox message={error} />}

                            <button id="login-submit" type="submit" disabled={loading}
                                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white font-bold text-sm py-2.5 rounded-lg transition-all active:scale-95 mt-2">
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                                {loading ? 'Signing in…' : 'Sign In'}
                            </button>
                        </motion.form>
                    ) : (
                        <motion.form
                            key="register"
                            onSubmit={handleRegister}
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -12 }}
                            transition={{ duration: 0.2 }}
                            className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-6 shadow-xl space-y-4"
                        >
                            <div className="space-y-1.5">
                                <label className={labelClass}>Full Name</label>
                                <input id="full_name" type="text" autoComplete="name" required value={fullName}
                                    onChange={e => setFullName(e.target.value)} placeholder="Lucy Mbwewe" className={inputClass} />
                            </div>

                            <div className="space-y-1.5">
                                <label className={labelClass}>Email</label>
                                <input id="reg-email" type="email" autoComplete="email" required value={email}
                                    onChange={e => setEmail(e.target.value)} placeholder="operator@company.local" className={inputClass} />
                            </div>

                            <div className="space-y-1.5">
                                <label className={labelClass}>Password</label>
                                <PasswordInput value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword(p => !p)} />
                            </div>

                            <div className="space-y-1.5">
                                <label className={labelClass}>Confirm Password</label>
                                <input id="confirm_password" type="password" required value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" className={inputClass} />
                            </div>

                            <div className="space-y-1.5">
                                <label className={labelClass}>Role</label>
                                <select value={role} onChange={e => setRole(e.target.value as any)}
                                    className={inputClass}>
                                    <option value="operator">Operator</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>

                            {error && <ErrorBox message={error} />}
                            {success && (
                                <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                                    {success}
                                </p>
                            )}

                            <button id="register-submit" type="submit" disabled={loading}
                                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white font-bold text-sm py-2.5 rounded-lg transition-all active:scale-95 mt-2">
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                                {loading ? 'Creating account…' : 'Create Account'}
                            </button>
                        </motion.form>
                    )}
                </AnimatePresence>

                <p className="text-center text-[10px] text-[var(--text-muted)] mt-6 opacity-40 uppercase tracking-widest">
                    Telecom Remote Site Monitoring System
                </p>
            </motion.div>
        </div>
    );
}

// ── Sub-components ──

function PasswordInput({ value, onChange, show, onToggle }: {
    value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void;
}) {
    return (
        <div className="relative">
            <input
                type={show ? 'text' : 'password'}
                required
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[var(--bg-dashboard)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 pr-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
            />
            <button type="button" onClick={onToggle}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
        </div>
    );
}

function ErrorBox({ message }: { message: string }) {
    return (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {message}
        </p>
    );
}
