import React from 'react';
import { Alert } from '../types';
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface AlertPanelProps {
  alerts: Alert[];
  onClose?: () => void;
}

export const AlertPanel: React.FC<AlertPanelProps> = ({ alerts, onClose }) => {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden flex flex-col h-full shadow-sm transition-colors duration-300">
      <div className="p-4 border-b border-[var(--border-subtle)] flex justify-between items-center bg-[var(--bg-header)]/50">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500" />
          Active Alerts
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono bg-red-500/10 text-red-500 px-2 py-0.5 rounded">
            {alerts.filter(a => !a.resolved).length} Unresolved
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
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest">No active alerts</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {alerts.map((alert) => (
              <div key={alert.id} className={cn(
                "p-4 transition-colors hover:bg-[var(--border-subtle)]/50",
                !alert.resolved && alert.severity === 'critical' && "bg-red-500/[0.03]"
              )}>
                <div className="flex gap-3">
                  <div className={cn(
                    "mt-1",
                    alert.severity === 'critical' ? "text-red-500" : "text-amber-500"
                  )}>
                    <AlertTriangle size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
                        {alert.siteName}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                        <Clock size={10} />
                        {format(alert.timestamp, 'HH:mm')}
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
                      <button className="text-[9px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] uppercase font-bold transition-colors">
                        Acknowledge
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
