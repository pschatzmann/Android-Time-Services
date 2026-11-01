/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sun, Moon, RefreshCw, SlidersHorizontal, Radio } from 'lucide-react';

interface HeaderProps {
  onOpenConfig: () => void;
  onForceSync: () => void;
  isSyncing: boolean;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenConfig,
  onForceSync,
  isSyncing,
  theme,
  toggleTheme,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md sticky top-0 z-40 transition-colors">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-cyan-600/10 dark:bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
          <Radio className="w-4 h-4" />
        </div>
        <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
          Chronos Stratum-1 Gateway
        </span>
      </div>

      {/* Zone 2: Clean single menu selection as requested: Dashboard */}
      <nav className="flex items-center gap-6 text-sm font-medium">
        <button
          className="text-cyan-600 dark:text-cyan-400 font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
        >
          <span>Dashboard</span>
        </button>
      </nav>

      {/* Zone 3: Configuration & primary actions */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onOpenConfig}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shadow-sm"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-500" />
          <span>Configuration</span>
        </button>

        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          onClick={onForceSync}
          disabled={isSyncing}
          className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-400 dark:text-slate-950 rounded-lg shadow-sm transition-all whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Disciplining...' : 'Force Re-Discipline'}</span>
        </button>
      </div>
    </header>
  );
};
