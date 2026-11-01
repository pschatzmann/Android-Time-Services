/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Clock,
  Radio,
  Satellite,
  Activity,
  Settings,
  RefreshCw,
  Sun,
  Moon,
  ShieldCheck,
} from 'lucide-react';

export type ScreenId = 'clock' | 'publish' | 'sources' | 'metrics' | 'settings';

interface MaterialNavigationProps {
  activeScreen: ScreenId;
  onSelectScreen: (screen: ScreenId) => void;
  onForceSync: () => void;
  isSyncing: boolean;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  activeStratum?: number;
  lockedRefId?: string;
  offsetNs?: number;
}

export const MaterialNavigation: React.FC<MaterialNavigationProps> = ({
  activeScreen,
  onSelectScreen,
  onForceSync,
  isSyncing,
  theme,
  toggleTheme,
  activeStratum = 1,
  lockedRefId = 'GPS',
  offsetNs = 84,
}) => {
  const destinations: { id: ScreenId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'clock', label: 'Clock', icon: Clock },
    { id: 'publish', label: 'Publish', icon: Radio },
    { id: 'sources', label: 'Sources', icon: Satellite },
    { id: 'metrics', label: 'Metrics', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const getScreenTitle = (screen: ScreenId) => {
    switch (screen) {
      case 'clock':
        return 'Precision Clock';
      case 'publish':
        return 'Time Publishing';
      case 'sources':
        return 'Reference Sources';
      case 'metrics':
        return 'Telemetry & Drift';
      case 'settings':
        return 'System Settings';
    }
  };

  return (
    <>
      {/* Material 3 Top App Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200/10 dark:border-slate-800/80 px-4 sm:px-6 py-3 transition-colors">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Leading brand & active screen name */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-white text-base">Chronos</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono font-medium">
                  v2.4
                </span>
              </div>
              <h1 className="text-xs font-medium text-slate-400">
                {getScreenTitle(activeScreen)}
              </h1>
            </div>
          </div>

          {/* Center Stratum & Lock Indicator (visible on medium+ screens) */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-mono text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Stratum {activeStratum}</span>
            <span className="text-slate-600">·</span>
            <span className="text-cyan-400 font-semibold">{lockedRefId}</span>
            <span className="text-slate-600">·</span>
            <span className="text-emerald-400">{offsetNs >= 0 ? `+${offsetNs}ns` : `${offsetNs}ns`}</span>
          </div>

          {/* Trailing actions: Sync & Theme */}
          <div className="flex items-center gap-2">
            <button
              onClick={onForceSync}
              disabled={isSyncing}
              title="Discipline local clock with active sources"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden xs:inline">{isSyncing ? 'Disciplining...' : 'Discipline'}</span>
            </button>

            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/70 border border-slate-800 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Material 3 Bottom Navigation Bar */}
      <nav
        aria-label="Bottom Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/80 px-2 sm:px-6 py-2 transition-all shadow-2xl"
      >
        <div className="max-w-md mx-auto flex items-center justify-around">
          {destinations.map((dest) => {
            const Icon = dest.icon;
            const isActive = activeScreen === dest.id;
            return (
              <button
                key={dest.id}
                onClick={() => {
                  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                    navigator.vibrate(15);
                  }
                  onSelectScreen(dest.id);
                }}
                className={`group flex flex-col items-center justify-center py-1 px-3 sm:px-4 rounded-2xl transition-all cursor-pointer ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {/* M3 Active Pill Indicator */}
                <div
                  className={`flex items-center justify-center w-14 h-8 rounded-full transition-all duration-200 ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-400 scale-105 shadow-inner shadow-cyan-500/30'
                      : 'group-hover:bg-slate-800/50 text-slate-400'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.8]'}`} />
                </div>
                <span
                  className={`text-[11px] mt-1 font-medium tracking-tight transition-colors ${
                    isActive ? 'text-cyan-400 font-semibold' : 'text-slate-400'
                  }`}
                >
                  {dest.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
