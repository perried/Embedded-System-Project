/**
 * ThresholdEditor.tsx
 * ===================
 * Panel for remotely editing a site's sensor thresholds from the NOC dashboard.
 *
 * Emits `thresholds:set` via Socket.IO to the hub server, which persists
 * the values to PostgreSQL and forwards them to the target Raspberry Pi.
 *
 * Shows real-time feedback:
 * - "Saving..." spinner while waiting for server confirmation
 * - "Saved" badge when the server confirms persistence
 * - "Pi confirmed" badge when the Pi acknowledges receipt
 * - "Pi Offline — will apply on next connect" when the Pi is disconnected
 */

import React, { useState, useEffect } from 'react';
import { SiteStatus, Thresholds } from '../types';
import {
  emitThresholdsSet,
  onThresholdsSaved,
  onThresholdsAck,
} from '../lib/socket';
import {
  SlidersHorizontal,
  Check,
  X,
  Thermometer,
  Droplets,
  Fan,
  Loader2,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface ThresholdEditorProps {
  site: SiteStatus;
  onClose: () => void;
}

const DEFAULT_THRESHOLDS: Thresholds = {
  temp_fan_on: 29.5,
  temp_warning: 38,
  temp_critical: 45,
  humidity_warning: 70,
  smoke_critical: 0.5,
};

export const ThresholdEditor: React.FC<ThresholdEditorProps> = ({ site, onClose }) => {
  const [values, setValues] = useState<Thresholds>({
    ...DEFAULT_THRESHOLDS,
    ...(site.thresholds || {}),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [piAck, setPiAck] = useState(false);

  // Update values when site changes
  useEffect(() => {
    setValues({
      ...DEFAULT_THRESHOLDS,
      ...(site.thresholds || {}),
    });
    setSaved(false);
    setPiAck(false);
  }, [site.id, site.thresholds]);

  // Listen for save confirmation and Pi ack
  useEffect(() => {
    const offSaved = onThresholdsSaved((data) => {
      if (data.siteId === site.id) {
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });

    const offAck = onThresholdsAck((data) => {
      if (data.siteId === site.id) {
        setPiAck(true);
        setTimeout(() => setPiAck(false), 5000);
      }
    });

    return () => {
      offSaved();
      offAck();
    };
  }, [site.id]);

  const handleApply = () => {
    setSaving(true);
    setSaved(false);
    setPiAck(false);
    emitThresholdsSet(site.id, values);

    // Timeout fallback in case server doesn't respond
    setTimeout(() => setSaving(false), 5000);
  };

  const handleChange = (key: keyof Thresholds, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setValues(prev => ({ ...prev, [key]: num }));
    }
  };

  const isConnected = site.connected !== false && site.status !== 'offline';

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-5 shadow-sm transition-colors duration-300">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <SlidersHorizontal size={18} className="text-emerald-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Threshold Settings</h3>
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{site.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
            isConnected
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-[var(--border-subtle)] text-[var(--text-muted)]"
          )}>
            {isConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
            {isConnected ? 'Pi Online' : 'Pi Offline'}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[var(--border-subtle)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Fan Activation Temperature */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] uppercase font-mono tracking-wider">
            <Fan size={12} />
            Fan Activation
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.5"
              value={values.temp_fan_on}
              onChange={(e) => handleChange('temp_fan_on', e.target.value)}
              className="w-full bg-[var(--bg-dashboard)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)]">°C</span>
          </div>
        </div>

        {/* Temperature Warning */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] uppercase font-mono tracking-wider">
            <Thermometer size={12} />
            Temp Warning
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.5"
              value={values.temp_warning}
              onChange={(e) => handleChange('temp_warning', e.target.value)}
              className="w-full bg-[var(--bg-dashboard)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)]">°C</span>
          </div>
        </div>

        {/* Temperature Critical */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] uppercase font-mono tracking-wider">
            <Thermometer size={12} />
            Temp Critical
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.5"
              value={values.temp_critical}
              onChange={(e) => handleChange('temp_critical', e.target.value)}
              className="w-full bg-[var(--bg-dashboard)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)]">°C</span>
          </div>
        </div>

        {/* Humidity Warning */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] uppercase font-mono tracking-wider">
            <Droplets size={12} />
            Humidity Warn
          </label>
          <div className="relative">
            <input
              type="number"
              step="1"
              value={values.humidity_warning}
              onChange={(e) => handleChange('humidity_warning', e.target.value)}
              className="w-full bg-[var(--bg-dashboard)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)]">%</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold uppercase">
              <Check size={12} /> Saved to server
            </span>
          )}
          {piAck && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold uppercase">
              <Check size={12} /> Applied on Pi
            </span>
          )}
          {!isConnected && !saving && !saved && (
            <span className="text-[10px] text-amber-500 font-medium">
              Pi is offline — thresholds will apply on next connect
            </span>
          )}
        </div>
        <button
          onClick={handleApply}
          disabled={saving}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all active:scale-95",
            saving
              ? "bg-[var(--border-subtle)] text-[var(--text-muted)] cursor-wait"
              : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm"
          )}
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check size={14} />
              Apply Thresholds
            </>
          )}
        </button>
      </div>
    </div>
  );
};
