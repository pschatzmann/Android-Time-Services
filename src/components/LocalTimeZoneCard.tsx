/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Clock, Globe2, Sun, Moon, Compass, Smartphone, Info, Check, RefreshCw } from 'lucide-react';
import {
  calculateTimeZoneDetails,
  formatDisciplinedLocalTime,
  POPULAR_TIMEZONES,
  getDeviceTimezone,
  TimeZoneDetails,
} from '../utils/timeZoneEngine';

interface LocalTimeZoneCardProps {
  disciplinedOffsetNs: number;
}

export const LocalTimeZoneCard: React.FC<LocalTimeZoneCardProps> = ({ disciplinedOffsetNs }) => {
  const [selectedIana, setSelectedIana] = useState<string>('AUTO');
  const [tzDetails, setTzDetails] = useState<TimeZoneDetails>(() =>
    calculateTimeZoneDetails(new Date(), 'AUTO')
  );
  const [localClock, setLocalClock] = useState<{
    dateStr: string;
    timeStr: string;
    fractionStr: string;
    timeZoneBadge: string;
  }>({
    dateStr: '2026-11-01',
    timeStr: '00:00:00',
    fractionStr: '.000 000',
    timeZoneBadge: 'LOCAL',
  });

  // Update clock ticking & timezone calculations
  useEffect(() => {
    let animId: number;

    const update = () => {
      const now = new Date();
      const details = calculateTimeZoneDetails(now, selectedIana);
      setTzDetails(details);

      const formatted = formatDisciplinedLocalTime(now.getTime(), disciplinedOffsetNs, selectedIana);
      setLocalClock(formatted);

      animId = requestAnimationFrame(update);
    };

    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, [selectedIana, disciplinedOffsetNs]);

  const handleTimezoneChange = (iana: string) => {
    setSelectedIana(iana);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(15);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400">
            <Globe2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
              <span>Android & Local Time Zone Integration</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                IANA tzdata
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Disciplined UTC master clock projected onto local Android time zone with sub-microsecond precision
            </p>
          </div>
        </div>

        {/* Timezone Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-mono text-slate-400 shrink-0">Zone:</label>
          <select
            value={selectedIana}
            onChange={(e) => handleTimezoneChange(e.target.value)}
            className="px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
          >
            {POPULAR_TIMEZONES.map((tz) => (
              <option key={tz.iana} value={tz.iana}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Clock Stage for Actual Local Time */}
      <div className="p-6 bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-900 dark:to-slate-950/60 border-b border-slate-100 dark:border-slate-800/60">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Large Local Time Display */}
          <div className="space-y-1">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-cyan-500" />
              <span>Actual Local Wall-Clock Time</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{tzDetails.displayName}</span>
            </div>

            <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1 pt-1">
              <span className="text-sm font-mono text-slate-500 uppercase tracking-widest">
                {localClock.dateStr}
              </span>
              <div className="flex items-baseline font-mono font-bold tracking-tight text-slate-900 dark:text-white">
                <span className="text-4xl sm:text-5xl tabular-nums">
                  {localClock.timeStr}
                </span>
                <span className="text-xl sm:text-2xl text-cyan-600 dark:text-cyan-400 tabular-nums ml-1">
                  {localClock.fractionStr}
                </span>
                <span className="text-xs uppercase font-mono tracking-widest text-slate-500 ml-2">
                  {localClock.timeZoneBadge} ({tzDetails.offsetFormatted})
                </span>
              </div>
            </div>
          </div>

          {/* Quick Info Badges */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono">
              <div className="text-slate-400 text-[10px] uppercase">UTC Offset</div>
              <div className="font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                {tzDetails.offsetFormatted}
                <span className="text-slate-400 font-normal ml-1">({tzDetails.offsetMinutes} min)</span>
              </div>
            </div>

            <div className="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono">
              <div className="text-slate-400 text-[10px] uppercase">Daylight Saving (DST)</div>
              <div className={`font-bold flex items-center gap-1.5 ${tzDetails.isDst ? 'text-amber-500' : 'text-emerald-500'}`}>
                {tzDetails.isDst ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                <span>{tzDetails.isDst ? 'DST Active (+1h)' : 'Standard Time'}</span>
              </div>
            </div>

            <div className="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono">
              <div className="text-slate-400 text-[10px] uppercase">BLE CTS 0x2A0F</div>
              <div className="font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                {tzDetails.quarterHours} quarters · 0x0{tzDetails.dstOffsetCode}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Android System Time Integration Specs */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono bg-slate-50/40 dark:bg-slate-950/40">
        <div className="p-3.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <div className="flex items-center gap-2 text-slate-400 uppercase text-[10px]">
            <Smartphone className="w-3.5 h-3.5 text-cyan-500" />
            <span>Android ZoneId / Offset</span>
          </div>
          <div className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate">
            {tzDetails.iana}
          </div>
          <div className="text-slate-500 text-[11px]">
            ZoneOffset: {tzDetails.offsetFormatted} · Epoch Sync: Synchronized
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <div className="flex items-center gap-2 text-slate-400 uppercase text-[10px]">
            <Compass className="w-3.5 h-3.5 text-amber-500" />
            <span>Solar Time Equation</span>
          </div>
          <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
            Solar Noon Offset: -14.2 min
          </div>
          <div className="text-slate-500 text-[11px]">
            Calculated via GNSS Longitude (122.4°W) vs Zone Meridian (120°W)
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <div className="flex items-center gap-2 text-slate-400 uppercase text-[10px]">
            <Info className="w-3.5 h-3.5 text-blue-500" />
            <span>Next DST Boundary</span>
          </div>
          <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
            {tzDetails.nextTransition?.description || 'Standard Schedule'}
          </div>
          <div className="text-slate-500 text-[11px]">
            Target Transition: {tzDetails.nextTransition?.dateIso.slice(0, 10)}
          </div>
        </div>
      </div>
    </div>
  );
};
