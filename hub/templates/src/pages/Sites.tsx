/**
 * Sites.tsx
 * =========
 * Management UI for manually registering and managing monitoring sites.
 * Connects to GET/POST/PUT/DELETE /api/sites — requires JWT.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../constants';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import {
    Radio, Plus, Trash2, Loader2, MapPin, Edit2, Check, X,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Site {
    id: string;
    name: string;
    location: string;
    status: 'online' | 'offline' | 'warning' | 'critical';
}

const EMPTY_FORM = { id: '', name: '', location: '' };

const STATUS_COLORS: Record<string, string> = {
    online: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
    warning: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    critical: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse',
    offline: 'bg-gray-500 opacity-50',
};

export default function Sites() {
    const { token } = useAuth();
    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Inline edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: '', location: '' });

    const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const fetchSites = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/sites`);
            if (res.ok) setSites(await res.json());
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchSites(); }, [fetchSites]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.id || !form.name) return;
        setSaving(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE_URL}/api/sites`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            await fetchSites();
            setForm(EMPTY_FORM);
            setShowForm(false);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (site: Site) => {
        setEditingId(site.id);
        setEditForm({ name: site.name, location: site.location });
    };

    const saveEdit = async (id: string) => {
        try {
            await fetch(`${API_BASE_URL}/api/sites/${id}`, {
                method: 'PUT',
                headers: authHeaders,
                body: JSON.stringify(editForm),
            });
            setSites(prev => prev.map(s => s.id === id ? { ...s, ...editForm } : s));
        } catch { }
        setEditingId(null);
    };

    const handleDelete = async (id: string) => {
        if (!confirm(`Delete site "${id}" and all its sensor history?`)) return;
        await fetch(`${API_BASE_URL}/api/sites/${id}`, { method: 'DELETE', headers: authHeaders });
        setSites(prev => prev.filter(s => s.id !== id));
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
            <div className="max-w-5xl mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                            <Radio className="text-emerald-500 w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[var(--text-primary)]">Sites</h2>
                            <p className="text-xs text-[var(--text-muted)]">Registered monitoring sites — auto-populated when a Raspberry Pi connects</p>
                        </div>
                    </div>
                    <button
                        id="add-site-btn"
                        onClick={() => setShowForm(s => !s)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all',
                            showForm ? 'bg-[var(--border-subtle)] text-[var(--text-muted)]' : 'bg-emerald-500 text-white hover:bg-emerald-600'
                        )}
                    >
                        <Plus size={14} />
                        Register Site
                    </button>
                </div>

                {/* Registration form */}
                <AnimatePresence>
                    {showForm && (
                        <motion.form
                            onSubmit={handleCreate}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden mb-6"
                        >
                            <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-5 space-y-4">
                                <h3 className="text-sm font-bold text-[var(--text-primary)]">Register New Site</h3>
                                <p className="text-xs text-[var(--text-muted)]">
                                    The Site ID must match the <code className="bg-[var(--border-subtle)] px-1 rounded">siteId</code> used by the Raspberry Pi's transmitter config.
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {[
                                        { key: 'id', label: 'Site ID *', placeholder: 'site-001' },
                                        { key: 'name', label: 'Site Name *', placeholder: 'North Ridge Tower' },
                                        { key: 'location', label: 'Location / Coordinates', placeholder: '-1.2921° S, 36.8219° E' },
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
                                </div>
                                {error && <p className="text-xs text-red-400">{error}</p>}
                                <div className="flex justify-end gap-2 pt-2">
                                    <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-xs rounded-lg bg-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">Cancel</button>
                                    <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60 transition-all">
                                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                                        Register Site
                                    </button>
                                </div>
                            </div>
                        </motion.form>
                    )}
                </AnimatePresence>

                {/* Sites table */}
                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="animate-spin text-emerald-500" size={28} /></div>
                ) : sites.length === 0 ? (
                    <div className="text-center py-16 text-[var(--text-muted)]">
                        <Radio className="mx-auto mb-3 opacity-30" size={36} />
                        <p className="text-sm">No sites registered yet.</p>
                        <p className="text-xs mt-1 opacity-60">Sites appear automatically when a Raspberry Pi connects, or you can register one manually above.</p>
                    </div>
                ) : (
                    <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[var(--border-subtle)]">
                                    {['Status', 'Site ID', 'Name', 'Location', ''].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence>
                                    {sites.map(site => (
                                        <motion.tr
                                            key={site.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--border-subtle)]/40 transition-colors group"
                                        >
                                            {/* Status dot */}
                                            <td className="px-4 py-3">
                                                <div className={cn('w-2 h-2 rounded-full', STATUS_COLORS[site.status] || STATUS_COLORS.offline)} />
                                            </td>

                                            {/* Site ID (non-editable) */}
                                            <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">{site.id}</td>

                                            {/* Name (editable) */}
                                            <td className="px-4 py-3 text-[var(--text-primary)]">
                                                {editingId === site.id ? (
                                                    <input
                                                        value={editForm.name}
                                                        onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                                                        className="w-full bg-[var(--bg-dashboard)] border border-emerald-500 rounded-lg px-2 py-1 text-sm focus:outline-none"
                                                        autoFocus
                                                    />
                                                ) : site.name}
                                            </td>

                                            {/* Location (editable) */}
                                            <td className="px-4 py-3 text-[var(--text-muted)]">
                                                {editingId === site.id ? (
                                                    <input
                                                        value={editForm.location}
                                                        onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))}
                                                        className="w-full bg-[var(--bg-dashboard)] border border-emerald-500 rounded-lg px-2 py-1 text-sm focus:outline-none"
                                                    />
                                                ) : (
                                                    <span className="flex items-center gap-1"><MapPin size={11} />{site.location}</span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {editingId === site.id ? (
                                                        <>
                                                            <button onClick={() => saveEdit(site.id)} className="p-1.5 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-400 text-[var(--text-muted)] transition-colors" title="Save"><Check size={14} /></button>
                                                            <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg hover:bg-[var(--border-subtle)] text-[var(--text-muted)] transition-colors" title="Cancel"><X size={14} /></button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => startEdit(site)} className="p-1.5 rounded-lg hover:bg-[var(--border-subtle)] hover:text-[var(--text-primary)] text-[var(--text-muted)] transition-colors" title="Edit"><Edit2 size={14} /></button>
                                                            <button onClick={() => handleDelete(site.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 text-[var(--text-muted)] transition-colors" title="Delete"><Trash2 size={14} /></button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Help box */}
                <div className="mt-6 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
                    <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider mb-2">How auto-registration works</p>
                    <p className="text-xs text-[var(--text-muted)]">
                        When a Raspberry Pi runs the transmitter script, it connects to the backend with its <code className="bg-[var(--border-subtle)] px-1 py-0.5 rounded font-mono">SITE_ID</code>, <code className="bg-[var(--border-subtle)] px-1 py-0.5 rounded font-mono">SITE_NAME</code>, and <code className="bg-[var(--border-subtle)] px-1 py-0.5 rounded font-mono">LOCATION</code> from <code className="bg-[var(--border-subtle)] px-1 py-0.5 rounded font-mono">config.py</code>. The hub automatically saves the site to the database if it doesn't exist yet.
                    </p>
                </div>
            </div>
        </div>
    );
}
