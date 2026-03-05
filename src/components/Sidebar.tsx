/**
 * Sidebar.tsx
 * ===========
 * Site navigation sidebar for the TRSMS dashboard.
 *
 * Displays a list of monitored telecom sites with:
 * - Colour-coded status indicators (green/amber/red/grey)
 * - Site name, location, and last update timestamp
 * - Active site highlighting with animated indicator bar
 *
 * On mobile, renders as a slide-out drawer with backdrop overlay.
 */

import React from 'react';
import { SiteStatus } from '../types';
import { MapPin, Activity, Clock, X } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface SidebarProps {
  sites: SiteStatus[];
  selectedSiteId: string;
  onSelectSite: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
}

export const Sidebar: React.FC<SidebarProps> = ({
  sites,
  selectedSiteId,
  onSelectSite,
  isOpen,
  onClose,
  theme
}) => {
  const lightFavicon = "https://uxwing.com/wp-content/themes/uxwing/download/internet-network-technology/signal-tower-icon.svg";
  const darkFavicon = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQgxqMcLnCsAYeb5yMsDZwS_A6Nyf5lrQq1IA&s";
  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "fixed inset-y-0 left-0 w-80 border-r border-[var(--border-subtle)] bg-[var(--bg-sidebar)] flex flex-col h-screen transition-all duration-300 z-50 lg:relative lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-[var(--border-subtle)] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
              <img
                src={theme === 'dark' ? darkFavicon : lightFavicon}
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">TERMS</h1>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--border-subtle)] rounded-lg lg:hidden text-[var(--text-secondary)]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="px-2 mb-4">
            <h2 className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest opacity-50">Active Sites</h2>
          </div>
          {sites.map((site) => (
            <button
              key={site.id}
              onClick={() => onSelectSite(site.id)}
              className={cn(
                "w-full text-left p-4 rounded-xl transition-all group relative overflow-hidden",
                selectedSiteId === site.id
                  ? "bg-[var(--border-subtle)] border border-[var(--border-hover)]"
                  : "hover:bg-[var(--border-subtle)] border border-transparent"
              )}
            >
              {selectedSiteId === site.id && (
                <motion.div
                  layoutId="active-site-indicator"
                  className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"
                />
              )}

              <div className="flex justify-between items-start mb-2">
                <h3 className={cn(
                  "font-medium transition-colors",
                  selectedSiteId === site.id ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
                )}>
                  {site.name}
                </h3>
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  (() => {
                    // Use WebSocket connected field if available, else fall back to timeout
                    const isOffline = site.connected === false ||
                      (site.connected === undefined && (Date.now() - site.lastUpdate) > 5 * 60 * 1000);
                    const status = isOffline ? 'offline' : site.status;
                    if (status === 'online') return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]";
                    if (status === 'warning') return "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]";
                    if (status === 'critical') return "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse";
                    return "bg-[var(--text-muted)] opacity-50";
                  })()
                )} />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                  <MapPin size={10} />
                  <span>{site.location}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                  <Clock size={10} />
                  <span>
                    {(() => {
                      const date = new Date(site.lastUpdate);
                      const today = new Date();
                      const isToday = date.getDate() === today.getDate() &&
                        date.getMonth() === today.getMonth() &&
                        date.getFullYear() === today.getFullYear();
                      return isToday
                        ? `Today at ${format(date, 'HH:mm:ss')}`
                        : format(date, 'MMM d, HH:mm:ss');
                    })()}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--border-subtle)]/30 flex justify-center">
          <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest opacity-40">
            TRSMS
          </span>
        </div>
      </aside>
    </>
  );
};
