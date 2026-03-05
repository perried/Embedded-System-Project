/**
 * AlarmBanner.tsx
 * ===============
 * Full-width emergency banner displayed when smoke is detected at any site.
 *
 * Features:
 * - Animated pulsing red background for high visibility
 * - "Silence Siren" button to mute the audio alarm (visual alert persists)
 * - Displays the affected site name
 *
 * The audio siren is controlled by App.tsx; this component only handles the visual banner.
 */

import React from 'react';
import { Shield, VolumeX, AlertTriangle, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface AlarmBannerProps {
  active: boolean;
  isSilenced: boolean;
  onSilence: () => void;
  siteName?: string;
}

export const AlarmBanner: React.FC<AlarmBannerProps> = ({ 
  active, 
  isSilenced, 
  onSilence,
  siteName 
}) => {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-red-600 text-white overflow-hidden shadow-lg z-50 relative"
        >
          <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="bg-white/20 p-2 rounded-full"
              >
                <Flame className="w-5 h-5 text-white" />
              </motion.div>
              
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest leading-none mb-0.5">
                  Critical Smoke Alert
                </h2>
                <p className="text-xs font-medium text-red-100 italic">
                  Smoke detected {siteName ? `at ${siteName}` : 'on-site'}. Action required immediately!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isSilenced ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-700/50 rounded-lg border border-red-400/30 text-[10px] font-bold uppercase tracking-wider">
                  <VolumeX className="w-3.5 h-3.5" />
                  Siren Silenced
                </div>
              ) : (
                <button
                  onClick={onSilence}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-red-600 hover:bg-red-50 rounded-lg shadow-sm transition-all active:scale-95 text-[11px] font-bold uppercase tracking-wider"
                >
                  <VolumeX className="w-4 h-4" />
                  Silence Siren
                </button>
              )}
              
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg text-[10px] font-medium border border-white/10">
                <AlertTriangle className="w-3.5 h-3.5" />
                Logic: MQ2 Digital Output
              </div>
            </div>
          </div>
          
          {/* Animated background pulse */}
          <motion.div 
            animate={{ opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 bg-red-500 pointer-events-none -z-10"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
