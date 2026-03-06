/**
 * AlertPanel.tsx
 * ==============
 * Scrollable panel displaying alert history fetched from the server.
 * Shows both active (unresolved) and historical (resolved) alerts.
 */

import React from 'react';
import { Alert } from '../types';
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { format as fnsFormat } from 'date-fns';

function safeFormat(ts: number | string | null | undefined, pattern: string, fallback = '--:--'): string {
  if (!ts) return fallback;
  const d = new Date(typeof ts === 'string' ? Number(ts) : ts);
  if (isNaN(d.getTime())) return fallback;
  return fnsFormat(d, pattern);
}

interface AlertPanelProps {
  alerts: Alert[];
  onClose?: () => void;
}

export const AlertPanel: React.FC<AlertPanelProps> = ({ alerts, onClose }) => {
  const openAlerts = alerts.filter(a => !a.resolved_at);
  const resolvedAlerts = alerts.filter(a => a.resolved_at);

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden flex flex-col h-full shadow-sm transition-colors duration-300">
      <div className="p-4 border-b border-[var(--border-subtle)] flex justify-between items-center bg-[var(--bg-header)]/50">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500" />
          Alerts
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono bg-red-500/10 text-red-500 px-2 py-0.5 rounded">
            {openAlerts.length} Active
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-[var(--border-subtle)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors lg:hidden"
              title="Close Panel"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <CheckCircle2 size={32} className="text-emerald-500/20 mb-2" />
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest">No alerts yet</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {openAlerts.length > 0 && (
              <div className="px-4 pt-3 pb-1">
                <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest">Active</span>
              </div>
            )}
            {openAlerts.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
            {resolvedAlerts.length > 0 && (
              <div className="px-4 pt-3 pb-1">
                <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">History</span>
              </div>
            )}
            {resolvedAlerts.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const AlertRow: React.FC<{ alert: Alert }> = ({ alert }) => {
  const isResolved = !!alert.resolved_at;
  return (
    <div className={cn(
      "p-4 transition-colors hover:bg-[var(--border-subtle)]/50",
      !isResolved && alert.severity === 'critical' && "bg-red-500/[0.03]",
      isResolved && "opacity-60"
    )}>
      <div className="flex gap-3">
        <div className={cn(
          "mt-1",
          isResolved ? "text-emerald-500" :
          alert.severity === 'critical' ? "text-red-500" : "text-amber-500"
        )}>
          {isResolved ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
              {alert.site_name}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
              <Clock size={10} />
              {safeFormat(alert.created_at, 'HH:mm')}
            </span>
          </div>
          <p className="text-xs text-[var(--text-primary)] opacity-80 leading-relaxed mb-2">
            {alert.message}
          </p>
          <div className="flex justify-between items-center">
            <span className={cn(
              "text-[9px] font-mono uppercase px-1.5 py-0.5 rounded",
              alert.severity === 'critical' ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
            )}>
              {alert.severity}
            </span>
            {isResolved ? (
              <span className="text-[9px] text-emerald-500 font-mono uppercase">
                Resolved {safeFormat(alert.resolved_at, 'HH:mm')}
              </span>
            ) : (
              <span className="text-[9px] text-red-400 font-mono uppercase animate-pulse">
                Active
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
