/**
 * Shippers.tsx
 * ============
 * Management UI for logistics providers (Shippers).
 * Connects to GET/POST/DELETE /api/shippers — requires JWT.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../constants';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Truck, Plus, Trash2, Loader2, Phone, Mail, MapPin, User } from 'lucide-react';
import { cn } from '../lib/utils';

interface Shipper {
    id: number;
    name: string;
    contact_person: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
}

const EMPTY_FORM = { name: '', contact_person: '', phone: '', email: '', address: '' };

export default function Shippers() {
    const { token } = useAuth();
    const [shippers, setShippers] = useState<Shipper[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const fetchShippers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/shippers`, { headers: authHeaders });
            if (res.ok) setShippers(await res.json());
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => { fetchShippers(); }, [fetchShippers]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name) return;
        setSaving(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE_URL}/api/shippers`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            const newShipper = await res.json();
            setShippers(prev => [newShipper, ...prev]);
            setForm(EMPTY_FORM);
            setShowForm(false);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        await fetch(`${API_BASE_URL}/api/shippers/${id}`, { method: 'DELETE', headers: authHeaders });
        setShippers(prev => prev.filter(s => s.id !== id));
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                            <Truck className="text-emerald-500 w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[var(--text-primary)]">Shippers</h2>
                            <p className="text-xs text-[var(--text-muted)]">Logistics providers linked to monitoring sites</p>
                        </div>
                    </div>
                    <button
                        id="add-shipper-btn"
                        onClick={() => setShowForm(s => !s)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all',
                            showForm ? 'bg-[var(--border-subtle)] text-[var(--text-muted)]' : 'bg-emerald-500 text-white hover:bg-emerald-600'
                        )}
                    >
                        <Plus size={14} />
                        Add Shipper
                    </button>
                </div>

                {/* Add Form */}
                <AnimatePresence>
                    {showForm && (
                        <motion.form
                            onSubmit={handleSubmit}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden mb-6"
                        >
                            <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-5 space-y-4">
                                <h3 className="text-sm font-bold text-[var(--text-primary)]">New Shipper</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {[
                                        { key: 'name', label: 'Company Name *', placeholder: 'Logistics Co.' },
                                        { key: 'contact_person', label: 'Contact Person', placeholder: 'Lucy Mbwewe' },
                                        { key: 'phone', label: 'Phone', placeholder: '+1 555 000 0000' },
                                        { key: 'email', label: 'Email', placeholder: 'contact@logistics.co' },
                                    ].map(f => (
                                        <div key={f.key} className="space-y-1.5">
                                            <label className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">{f.label}</label>
                                            <input
                                                value={(form as any)[f.key]}
                                                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                                placeholder={f.placeholder}
                                                className="w-full bg-[var(--bg-dashboard)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                                            />
                                        </div>
                                    ))}
                                    <div className="sm:col-span-2 space-y-1.5">
                                        <label className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Address</label>
                                        <input
                                            value={form.address}
                                            onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
                                            placeholder="123 Industrial Ave, City"
                                            className="w-full bg-[var(--bg-dashboard)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                                        />
                                    </div>
                                </div>
                                {error && <p className="text-xs text-red-400">{error}</p>}
                                <div className="flex justify-end gap-2 pt-2">
                                    <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-xs rounded-lg bg-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">Cancel</button>
                                    <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60 transition-all">
                                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                                        Save Shipper
                                    </button>
                                </div>
                            </div>
                        </motion.form>
                    )}
                </AnimatePresence>

                {/* Shippers grid */}
                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="animate-spin text-emerald-500" size={28} /></div>
                ) : shippers.length === 0 ? (
                    <div className="text-center py-16 text-[var(--text-muted)]">
                        <Truck className="mx-auto mb-3 opacity-30" size={36} />
                        <p className="text-sm">No shippers yet. Add the first one above.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <AnimatePresence>
                            {shippers.map(s => (
                                <motion.div
                                    key={s.id}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4 group relative"
                                >
                                    <button
                                        onClick={() => handleDelete(s.id)}
                                        className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 text-[var(--text-muted)] transition-all"
                                        title="Delete shipper"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                    <div className="flex items-start gap-3 mb-3">
                                        <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
                                            <Truck size={16} className="text-emerald-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-semibold text-sm text-[var(--text-primary)] truncate">{s.name}</h3>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 text-[11px] text-[var(--text-muted)]">
                                        {s.contact_person && (
                                            <div className="flex items-center gap-2"><User size={11} /><span>{s.contact_person}</span></div>
                                        )}
                                        {s.phone && (
                                            <div className="flex items-center gap-2"><Phone size={11} /><span>{s.phone}</span></div>
                                        )}
                                        {s.email && (
                                            <div className="flex items-center gap-2"><Mail size={11} /><span className="truncate">{s.email}</span></div>
                                        )}
                                        {s.address && (
                                            <div className="flex items-center gap-2"><MapPin size={11} /><span className="truncate">{s.address}</span></div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}
