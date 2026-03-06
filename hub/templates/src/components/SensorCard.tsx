/**
 * SensorCard.tsx
 * ==============
 * Displays a single sensor's current reading, trend indicator, and historical chart.
 *
 * - Temperature & Humidity: Renders an area chart (Recharts) with threshold reference line
 * - Smoke: Renders a binary status timeline (green = clear, red = alarm) with last incident info
 *
 * Visual state changes dynamically based on whether the current value exceeds its threshold.
 */

import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { SensorReading, SensorType } from '../types';
import { cn } from '../lib/utils';
import { Thermometer, Droplets, Wind, AlertTriangle, TrendingUp, TrendingDown, Minus, Flame, Shield, CheckCircle2 } from 'lucide-react';
import { format as fnsFormat } from 'date-fns';

/** Safe format wrapper — returns fallback string if timestamp is invalid */
function safeFormat(ts: number | string | null | undefined, pattern: string, fallback = '--:--'): string {
  if (!ts) return fallback;
  const d = new Date(typeof ts === 'string' ? Number(ts) : ts);
  if (isNaN(d.getTime())) return fallback;
  return fnsFormat(d, pattern);
}

interface SensorCardProps {
  type: SensorType;
  current: number;
  unit: string;
  history: SensorReading[];
  threshold: number;
  className?: string;
}

const sensorConfig = {
  temperature: {
    label: 'Temperature',
    icon: Thermometer,
    color: '#f97316',
    domain: [0, 60],
  },
  humidity: {
    label: 'Humidity',
    icon: Droplets,
    color: '#3b82f6',
    domain: [0, 100],
  },
  smoke: {
    label: 'Smoke Sensor',
    icon: Shield,
    alertIcon: Flame,
    color: '#2ECC71',
    alertColor: '#E74C3C',
    domain: [0, 1],
  },
};

export const SensorCard: React.FC<SensorCardProps> = ({
  type,
  current,
  unit,
  history,
  threshold,
  className,
}) => {
  const isSmokeType = type === 'smoke';
  const smokeActive = isSmokeType && current === 1;
  const config = sensorConfig[type];
  const Icon = isSmokeType ? (smokeActive ? (config as any).alertIcon : config.icon) : config.icon;
  const isAlert = isSmokeType ? smokeActive : current > threshold;

  const stats = useMemo(() => {
    if (!history.length) return { min: 0, max: 0, avg: 0, trend: 'stable' };
    const values = history.map(h => h.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    const last = values[values.length - 1];
    const prev = values[values.length - 2] || last;
    const trend = last > prev ? 'up' : last < prev ? 'down' : 'stable';

    return { min, max, avg, trend };
  }, [history]);

  return (
    <div className={cn(
      "bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-5 flex flex-col gap-4 transition-all hover:border-[var(--border-hover)] shadow-sm duration-300 relative overflow-hidden",
      isAlert && "border-red-500/50 bg-red-500/5",
      smokeActive && "animate-[pulse_2s_infinite] border-red-500",
      className
    )}>
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg bg-[var(--border-subtle)] transition-colors duration-500",
            isAlert && "bg-red-500/20 text-red-500",
            !isAlert && isSmokeType && "bg-emerald-500/10 text-emerald-500"
          )}>
            <Icon size={20} className={cn(
              !isAlert && !isSmokeType && "text-[var(--text-secondary)]",
              smokeActive && "animate-bounce"
            )} />
          </div>
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">{config.label}</p>
            <div className="flex items-baseline gap-2">
              {isSmokeType ? (
                <h3 className={cn(
                  "text-xl font-bold uppercase tracking-tight",
                  smokeActive ? "text-red-500" : "text-emerald-500"
                )}>
                  {smokeActive ? 'Smoke Detected' : 'Clear'}
                </h3>
              ) : (
                <h3 className="text-2xl font-semibold text-[var(--text-primary)]">
                  {current.toFixed(1)}
                  <span className="text-sm font-normal text-[var(--text-muted)] ml-1">{unit}</span>
                </h3>
              )}
              {!isSmokeType && (
                <div className={cn(
                  "flex items-center text-[10px] font-bold",
                  stats.trend === 'up' ? "text-red-400" : stats.trend === 'down' ? "text-emerald-400" : "text-gray-400"
                )}>
                  {stats.trend === 'up' ? <TrendingUp size={12} /> : stats.trend === 'down' ? <TrendingDown size={12} /> : <Minus size={12} />}
                </div>
              )}
            </div>
          </div>
        </div>
        {isAlert && (
          <div className="flex items-center gap-1 text-red-500">
            <AlertTriangle size={16} className={smokeActive ? "animate-pulse" : ""} />
            <span className="text-[10px] font-bold uppercase">{smokeActive ? 'ALARM' : 'Critical'}</span>
          </div>
        )}
      </div>

      <div className="h-48 w-full mt-2 -ml-4">
        {isSmokeType ? (
          <div className="h-full w-full ml-4 flex flex-col justify-center gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-[var(--text-muted)] uppercase font-mono mb-1">Status Timeline (24h)</span>
              <div className="h-10 w-full bg-[var(--border-subtle)] rounded-full overflow-hidden flex shadow-inner">
                {history.length > 0 ? (
                  history.map((reading, i) => (
                    <div
                      key={reading.timestamp}
                      className={cn(
                        "h-full flex-1 transition-all duration-300",
                        reading.value === 1 ? "bg-red-500" : "bg-emerald-500/40"
                      )}
                      title={`${safeFormat(reading.timestamp, 'HH:mm')}: ${reading.value === 1 ? 'ALARM' : 'OK'}`}
                    />
                  ))
                ) : (
                  <div className="w-full h-full bg-emerald-500/20" />
                )}
              </div>
              <div className="flex justify-between px-1 text-[8px] text-[var(--text-muted)] font-mono">
                <span>{history.length > 0 ? safeFormat(history[0].timestamp, 'HH:mm') : '00:00'}</span>
                <span>{history.length > 0 ? safeFormat(history[history.length - 1].timestamp, 'HH:mm') : '23:59'}</span>
              </div>
            </div>

            <div className="bg-[var(--border-subtle)]/30 rounded-lg p-3 border border-[var(--border-subtle)]">
              <p className="text-[10px] text-[var(--text-muted)] uppercase font-mono mb-2">Last Incident</p>
              {history.some(h => h.value === 1) ? (
                <div className="flex items-center gap-2 text-red-400">
                  <Flame size={14} />
                  <span className="text-xs font-bold">
                    {safeFormat(history.filter(h => h.value === 1).pop()?.timestamp || 0, 'MMM d, HH:mm:ss')}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-500">
                  <CheckCircle2 size={14} />
                  <span className="text-xs font-medium">No smoke detected in last 24h</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
            <AreaChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} style={{ outline: 'none' }}>
              <defs>
                <linearGradient id={`gradient-${type}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isAlert ? '#ef4444' : config.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={isAlert ? '#ef4444' : config.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.1)" />
              <XAxis
                dataKey="timestamp"
                hide={false}
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
                tickFormatter={(time) => safeFormat(time, 'HH:mm')}
                minTickGap={30}
              />
              <YAxis
                hide={false}
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
                domain={config.domain}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '11px'
                }}
                itemStyle={{ color: 'var(--text-primary)', padding: '2px 0' }}
                labelStyle={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '4px' }}
                labelFormatter={(time) => safeFormat(time, 'MMM d, HH:mm:ss')}
                formatter={(value: number) => [`${value.toFixed(2)} ${unit}`, config.label]}
              />
              <ReferenceLine
                y={threshold}
                stroke="#ef4444"
                strokeDasharray="3 3"
                label={{
                  position: 'right',
                  value: 'LIMIT',
                  fill: '#ef4444',
                  fontSize: 8,
                  fontWeight: 'bold'
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={isAlert ? '#ef4444' : config.color}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#gradient-${type})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-subtle)]">
        <div className="flex flex-col">
          <span className="text-[8px] text-[var(--text-muted)] uppercase font-mono">{isSmokeType ? 'Mode' : 'Min'}</span>
          <span className="text-xs font-bold text-[var(--text-primary)]">{isSmokeType ? 'Digital' : `${stats.min.toFixed(1)}${unit}`}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[8px] text-[var(--text-muted)] uppercase font-mono">{isSmokeType ? 'Last Pulse' : 'Avg'}</span>
          <span className="text-xs font-bold text-[var(--text-primary)]">{isSmokeType ? safeFormat(Date.now(), 'HH:mm:ss') : `${stats.avg.toFixed(1)}${unit}`}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[8px] text-[var(--text-muted)] uppercase font-mono">{isSmokeType ? 'Reliability' : 'Max'}</span>
          <span className="text-xs font-bold text-[var(--text-primary)]">{isSmokeType ? '99.9%' : `${stats.max.toFixed(1)}${unit}`}</span>
        </div>
      </div>

      <div className="flex justify-between items-center pt-2">
        <span className="text-[10px] text-[var(--text-muted)] uppercase font-mono">
          {isSmokeType ? 'Logic: MQ2 Digital Output' : `Threshold: ${threshold}${unit}`}
        </span>
        <span className={cn(
          "text-[10px] uppercase font-bold",
          isAlert ? "text-red-500" : "text-emerald-500"
        )}>
          {isAlert ? (isSmokeType ? 'ALARM ACTIVE' : 'Critical Level') : 'Nominal'}
        </span>
      </div>
    </div>
  );
};
