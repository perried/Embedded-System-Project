/**
 * App.tsx
 * =======
 * Root component for the TRSMS NOC Dashboard.
 *
 * Responsibilities:
 * - Fetches initial site data via REST (GET /api/sites) for history hydration
 * - Subscribes to Socket.IO events for real-time sensor data, site status, and threshold updates
 * - Manages global state: sites list, selected site, theme, alerts, smoke alarm
 * - Renders the sidebar, sensor cards, alert panel, threshold editor, and alarm banner
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { API_BASE_URL } from './constants';
import { SiteStatus, Alert, SensorType } from './types';
import { cn } from './lib/utils';
import {
  onSiteData,
  onSiteStatus,
  subscribeSite,
  disconnectSocket,
  SiteDataEvent,
  SiteStatusEvent,
  onThresholdsUpdated,
} from './lib/socket';
import Sites from './pages/Sites';
import { Sidebar } from './components/Sidebar';
import { SensorCard } from './components/SensorCard';
import { AlertPanel } from './components/AlertPanel';
import { AlarmBanner } from './components/AlarmBanner';
import { ThresholdEditor } from './components/ThresholdEditor';
import {
  Bell,
  RefreshCw,
  Sun,
  Moon,
  Menu,
  SlidersHorizontal,
  Radio,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activePage, setActivePage] = useState<'dashboard' | 'sites'>('dashboard');

  const [sites, setSites] = useState<SiteStatus[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>(() => {
    return localStorage.getItem('trsms_selected_site_id') || '';
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (localStorage.getItem('trsms_theme') as 'light' | 'dark') || 'dark'
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAlerts, setShowAlerts] = useState(false);

  const [hasSmokeAlert, setHasSmokeAlert] = useState(false);
  const [isSilenced, setIsSilenced] = useState(false);
  const [showThresholds, setShowThresholds] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchSites = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sites`);
      const data = await response.json();
      const sortedData = (data as SiteStatus[]).sort((a, b) => a.id.localeCompare(b.id));
      setSites(sortedData);

      const smokeAlertActive = sortedData.some(site => site.sensors.smoke?.current === 1);
      if (!smokeAlertActive) setIsSilenced(false);
      setHasSmokeAlert(smokeAlertActive);

      if (data.length > 0 && !localStorage.getItem('trsms_selected_site_id')) {
        const firstId = data[0].id;
        setSelectedSiteId(firstId);
        localStorage.setItem('trsms_selected_site_id', firstId);
      }
    } catch (error) {
      console.error('Failed to fetch sites:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();

    const offData = onSiteData((event: SiteDataEvent) => {
      setSites(prev => {
        const updated = prev.map(site => {
          if (site.id !== event.siteId) return site;
          const newSensors = { ...site.sensors };
          for (const [type, value] of Object.entries(event.sensors) as [string, number][]) {
            if (type in newSensors) {
              const sensor = newSensors[type as keyof typeof newSensors];
              newSensors[type as keyof typeof newSensors] = {
                ...sensor,
                current: value,
                history: [...sensor.history.slice(-99), { timestamp: event.timestamp, value }],
              };
            }
          }
          return {
            ...site,
            status: event.status as SiteStatus['status'],
            lastUpdate: event.timestamp,
            sensors: newSensors,
          };
        });

        const smokeActive = updated.some(s => s.sensors.smoke?.current === 1);
        if (!smokeActive) setIsSilenced(false);
        setHasSmokeAlert(smokeActive);

        return updated;
      });
    });

    const offStatus = onSiteStatus((event: SiteStatusEvent) => {
      setSites(prev => {
        const exists = prev.some(s => s.id === event.siteId);
        if (!exists && event.connected) {
          fetchSites();
          return prev;
        }
        return prev.map(site => {
          if (site.id !== event.siteId) return site;
          return { ...site, status: event.status as SiteStatus['status'], connected: event.connected };
        });
      });
    });

    const offThresholds = onThresholdsUpdated((event) => {
      setSites(prev => prev.map(site => {
        if (site.id !== event.siteId) return site;
        return { ...site, thresholds: event.thresholds };
      }));
    });

    return () => {
      offData();
      offStatus();
      offThresholds();
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    if (selectedSiteId) subscribeSite(selectedSiteId);
  }, [selectedSiteId]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('trsms_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (hasSmokeAlert && !isSilenced) {
      if (!audioRef.current) {
        audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3');
        audioRef.current.loop = true;
      }
      audioRef.current.play().catch(() => { });
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [hasSmokeAlert, isSilenced]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const selectedSite = useMemo(() => {
    const site = sites.find(s => s.id === selectedSiteId) || sites[0];
    if (!site) return null;
    const isOffline = site.connected === false ||
      (site.connected === undefined && site.lastUpdate ? (Date.now() - site.lastUpdate) > 5 * 60 * 1000 : false);
    return { ...site, status: (isOffline ? 'offline' : site?.status || 'offline') as SiteStatus['status'] };
  }, [sites, selectedSiteId]);

  const alertingSite = useMemo(() => {
    return sites.find(site => site.sensors.smoke?.current === 1)?.name;
  }, [sites]);

  const alerts = useMemo(() => {
    const allAlerts: Alert[] = [];
    if (!sites.length) return allAlerts;
    sites.forEach(site => {
      (Object.entries(site.sensors) as [SensorType, any][]).forEach(([type, sensor]) => {
        const isAlert = type === 'smoke' ? sensor.current === 1 : sensor.current > sensor.threshold;
        if (isAlert) {
          allAlerts.push({
            id: `alert-${site.id}-${type}`,
            siteId: site.id,
            siteName: site.name,
            type,
            severity: (type === 'smoke' || sensor.current > sensor.threshold * 1.2) ? 'critical' : 'warning',
            message: type === 'smoke'
              ? `SMOKE DETECTED at ${site.name}!`
              : `${type.charAt(0).toUpperCase() + type.slice(1)} at ${site.name} is ${sensor.current}${sensor.unit} — threshold: ${sensor.threshold}${sensor.unit}`,
            timestamp: Date.now() - Math.random() * 3600000,
            resolved: false,
          });
        }
      });
    });
    return allAlerts.sort((a, b) => b.timestamp - a.timestamp);
  }, [sites]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchSites().finally(() => setTimeout(() => setIsRefreshing(false), 800));
  };

  if (loading && sites.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--bg-dashboard)] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="text-emerald-500"
        >
          <RefreshCw className="w-8 h-8" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[var(--bg-dashboard)] text-[var(--text-primary)] font-sans selection:bg-emerald-500/30 transition-colors duration-300 overflow-hidden">
      <Sidebar
        sites={sites}
        selectedSiteId={selectedSiteId}
        onSelectSite={(id) => {
          setSelectedSiteId(id);
          localStorage.setItem('trsms_selected_site_id', id);
          setIsSidebarOpen(false);
          setActivePage('dashboard');
        }}
        isOpen={isSidebarOpen}
        theme={theme}
        onClose={() => setIsSidebarOpen(false)}
        activePage={activePage}
        onNavigate={(page) => { setActivePage(page as any); setIsSidebarOpen(false); }}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <AlarmBanner
          active={hasSmokeAlert}
          isSilenced={isSilenced}
          onSilence={() => setIsSilenced(true)}
          siteName={alertingSite}
        />

        {/* Header */}
        <header className="h-16 border-b border-[var(--border-subtle)] bg-[var(--bg-header)] flex items-center justify-between px-4 lg:px-8 shrink-0 transition-colors duration-300">
          <div className="flex items-center gap-3 lg:gap-6">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-[var(--border-subtle)] rounded-lg lg:hidden text-[var(--text-secondary)]"
            >
              <Menu size={20} />
            </button>
            <div className="flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-3 min-w-0">
              <span className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate leading-tight">
                {activePage === 'sites' ? 'Sites' : selectedSite?.name || 'No Sites'}
              </span>
              {activePage === 'dashboard' && selectedSite && (
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    selectedSite.status === 'online' ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]' :
                      selectedSite.status === 'warning' ? 'bg-amber-500' :
                        selectedSite.status === 'critical' ? 'bg-red-500 animate-pulse' :
                          'bg-[var(--text-muted)] opacity-50'
                  )} />
                  <span className={cn(
                    "text-[9px] sm:text-[10px] font-bold uppercase tracking-widest leading-none",
                    selectedSite.status === 'online' ? 'text-emerald-500' :
                      selectedSite.status === 'warning' ? 'text-amber-500' :
                        selectedSite.status === 'critical' ? 'text-red-500' :
                          'text-[var(--text-muted)]'
                  )}>
                    {selectedSite.status}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-[var(--border-subtle)] text-[var(--text-secondary)] transition-colors"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              onClick={handleRefresh}
              className={cn(
                "p-2 rounded-full hover:bg-[var(--border-subtle)] text-[var(--text-secondary)] transition-colors",
                isRefreshing && "animate-spin text-emerald-500"
              )}
              title="Refresh data"
            >
              <RefreshCw size={18} />
            </button>
            {activePage === 'dashboard' && (
              <>
                <button
                  onClick={() => setShowThresholds(!showThresholds)}
                  className={cn(
                    "p-2 rounded-full hover:bg-[var(--border-subtle)] transition-all relative",
                    showThresholds ? "bg-emerald-500/10 text-emerald-500" : "text-[var(--text-secondary)]"
                  )}
                  title="Thresholds"
                >
                  <SlidersHorizontal size={18} />
                </button>
                <button
                  onClick={() => setShowAlerts(!showAlerts)}
                  className={cn(
                    "p-2 rounded-full hover:bg-[var(--border-subtle)] transition-all relative",
                    showAlerts ? "bg-emerald-500/10 text-emerald-500" : "text-[var(--text-secondary)]"
                  )}
                  title="Alerts"
                >
                  <Bell size={18} />
                  {alerts.length > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-[var(--bg-header)]" />
                  )}
                </button>
              </>
            )}
          </div>
        </header>

        {/* Content */}
        {activePage === 'sites' ? (
          <Sites />
        ) : !selectedSite ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <Radio className="w-16 h-16 text-[var(--text-muted)] mx-auto opacity-30" />
              <h2 className="text-xl font-bold text-[var(--text-muted)]">No Sites Connected</h2>
              <p className="text-sm text-[var(--text-muted)] opacity-60">Connect a Raspberry Pi or add a site manually from the Sites page.</p>
              <button onClick={() => setActivePage('sites')} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors">Manage Sites</button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 lg:p-8">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <RefreshCw className="animate-spin text-emerald-500" size={32} />
              </div>
            ) : (
              <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-12 gap-6 relative">
                  {/* Sensor Cards */}
                  <div className={cn(
                    "col-span-12 transition-all duration-500",
                    showAlerts ? "lg:col-span-8" : "lg:col-span-12"
                  )}>
                    <div className={cn(
                      "grid grid-cols-1 md:grid-cols-2 gap-6 transition-all duration-500",
                      !showAlerts && "lg:grid-cols-3"
                    )}>
                      <AnimatePresence mode="wait">
                        {selectedSite.sensors?.temperature && (
                          <motion.div
                            key={`${selectedSiteId}-temp`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className={cn(
                              "col-span-1 md:col-span-2 transition-all duration-500",
                              !showAlerts && "lg:col-span-1"
                            )}
                          >
                            <SensorCard
                              type="temperature"
                              current={selectedSite.sensors.temperature.current}
                              unit={selectedSite.sensors.temperature.unit}
                              history={selectedSite.sensors.temperature.history}
                              threshold={selectedSite.sensors.temperature.threshold}
                            />
                          </motion.div>
                        )}

                        {selectedSite.sensors?.humidity && (
                          <motion.div
                            key={`${selectedSiteId}-hum`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ delay: 0.1 }}
                            className="col-span-1"
                          >
                            <SensorCard
                              type="humidity"
                              current={selectedSite.sensors.humidity.current}
                              unit={selectedSite.sensors.humidity.unit}
                              history={selectedSite.sensors.humidity.history}
                              threshold={selectedSite.sensors.humidity.threshold}
                            />
                          </motion.div>
                        )}

                        {selectedSite.sensors?.smoke && (
                          <motion.div
                            key={`${selectedSiteId}-smoke`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ delay: 0.2 }}
                            className="col-span-1"
                          >
                            <SensorCard
                              type="smoke"
                              current={selectedSite.sensors.smoke.current}
                              unit={selectedSite.sensors.smoke.unit}
                              history={selectedSite.sensors.smoke.history}
                              threshold={selectedSite.sensors.smoke.threshold}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Threshold Editor */}
                    <AnimatePresence>
                      {showThresholds && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-6 overflow-hidden"
                        >
                          <ThresholdEditor
                            site={selectedSite}
                            onClose={() => setShowThresholds(false)}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Alerts Panel */}
                  <AnimatePresence>
                    {showAlerts && (
                      <>
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setShowAlerts(false)}
                          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] lg:hidden"
                        />
                        <motion.div
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className={cn(
                            "transition-all duration-500 z-[60]",
                            "fixed top-20 right-4 left-4 bottom-4 lg:relative lg:top-0 lg:left-0 lg:right-0 lg:bottom-0 lg:col-span-4 lg:z-auto lg:h-[700px]"
                          )}
                        >
                          <AlertPanel alerts={alerts} onClose={() => setShowAlerts(false)} />
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
