/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, ShieldCheck, Zap } from 'lucide-react';
import { formatHighPrecisionTime } from '../utils/clockMath';
import { play1PpsClickSound } from '../utils/hardware';
import { DisciplinedClockStatus } from '../types/chronos';

interface MasterClockBannerProps {
  clockStatus?: DisciplinedClockStatus;
  leapSecondsTai: number;
  leapSecondsGps: number;
}

export const MasterClockBanner: React.FC<MasterClockBannerProps> = ({
  clockStatus,
  leapSecondsTai = 37,
  leapSecondsGps = 18,
}) => {
  const [timeScale, setTimeScale] = useState<'utc' | 'tai' | 'gps' | 'local'>('utc');
  const [audio1PpsEnabled, setAudio1PpsEnabled] = useState(false);
  const [displayTime, setDisplayTime] = useState<{
    dateStr: string;
    timeStr: string;
    microsecondStr: string;
  }>({
    dateStr: '2026-11-01',
    timeStr: '00:00:00',
    microsecondStr: '.000 000',
  });

  useEffect(() => {
    let lastSecond = -1;
    let animId: number;

    const tick = () => {
      const now = new Date();
      let targetMs = now.getTime();

      if (timeScale === 'tai') {
        targetMs += leapSecondsTai * 1000;
      } else if (timeScale === 'gps') {
        targetMs += leapSecondsGps * 1000;
      }

      const offsetNs = clockStatus?.offsetNs || 0;
      const formatted = formatHighPrecisionTime(new Date(targetMs), offsetNs);

      if (timeScale === 'local') {
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const ms = String(now.getMilliseconds()).padStart(3, '0');
        const us = String(Math.floor(Math.abs(offsetNs % 1e6) / 1000)).padStart(3, '0');

        setDisplayTime({
          dateStr: `${y}-${m}-${d}`,
          timeStr: `${hh}:${mm}:${ss}`,
          microsecondStr: `.${ms} ${us}`,
        });
      } else {
        setDisplayTime(formatted);
      }

      // Check for exact second rollover for 1PPS sound
      const currentSec = now.getSeconds();
      if (currentSec !== lastSecond) {
        lastSecond = currentSec;
        if (audio1PpsEnabled) {
          play1PpsClickSound();
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [timeScale, clockStatus?.offsetNs, audio1PpsEnabled, leapSecondsTai, leapSecondsGps]);

  const offsetNs = clockStatus?.offsetNs ?? 84;
  const driftPpb = clockStatus?.driftPpb ?? 1.42;
  const rootDispersionMs = clockStatus?.rootDispersionMs ?? 0.84;
  const rootDelayMs = clockStatus?.rootDelayMs ?? 0.12;
  const stratum = clockStatus?.activeStratum ?? 1;
  const refId = clockStatus?.lockedRefId ?? 'GPS';

  return (
    <div className="bg-slate-900 border-b border-slate-800 text-slate-100 px-6 py-6 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Clock Readout & Timescale Selector */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs uppercase tracking-wider font-mono text-cyan-400 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              Disciplined Master Clock
            </span>
            <span className="text-slate-600 dark:text-slate-500">·</span>
            <span className="text-xs font-mono text-slate-400">
              STRATUM {stratum} (REF: {refId} / 1PPS / CSAC)
            </span>
          </div>

          <div className="flex items-baseline flex-wrap gap-x-4 gap-y-1">
            <span className="text-sm font-mono text-slate-400 uppercase tracking-widest">
              {displayTime.dateStr}
            </span>
            <div className="flex items-baseline font-mono font-bold tracking-tight text-white">
              <span className="text-4xl sm:text-5xl lg:text-6xl tabular-nums">
                {displayTime.timeStr}
              </span>
              <span className="text-xl sm:text-2xl lg:text-3xl text-cyan-400 tabular-nums ml-1">
                {displayTime.microsecondStr}
              </span>
              <span className="text-xs uppercase font-mono tracking-widest text-slate-400 ml-2">
                {timeScale.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Timescale Selector Controls */}
          <div className="flex items-center gap-1 pt-1">
            <div className="inline-flex rounded-md bg-slate-800/80 p-0.5 border border-slate-700">
              <button
                onClick={() => setTimeScale('utc')}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors cursor-pointer ${
                  timeScale === 'utc'
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                UTC
              </button>
              <button
                onClick={() => setTimeScale('tai')}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors cursor-pointer ${
                  timeScale === 'tai'
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                TAI (+{leapSecondsTai}s)
              </button>
              <button
                onClick={() => setTimeScale('gps')}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors cursor-pointer ${
                  timeScale === 'gps'
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                GPS (+{leapSecondsGps}s)
              </button>
              <button
                onClick={() => setTimeScale('local')}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors cursor-pointer ${
                  timeScale === 'local'
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Local Time
              </button>
            </div>

            <button
              onClick={() => setAudio1PpsEnabled(!audio1PpsEnabled)}
              title={audio1PpsEnabled ? 'Disable 1PPS Audio Pulse' : 'Enable 1PPS Audio Pulse'}
              className={`ml-2 p-1.5 rounded-md border text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
                audio1PpsEnabled
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {audio1PpsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">1PPS Pulse</span>
            </button>
          </div>
        </div>

        {/* Right: Metrology KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
          <div>
            <div className="text-xs uppercase font-mono tracking-wider text-slate-400">
              Phase Offset
            </div>
            <div className="text-xl font-mono font-bold text-emerald-400 tabular-nums">
              {offsetNs >= 0 ? `+${offsetNs}` : offsetNs}
              <span className="text-xs font-mono font-normal text-slate-400 ml-1">ns</span>
            </div>
            <div className="text-xs font-mono text-slate-500">
              {((offsetNs) / 1000).toFixed(3)} µs
            </div>
          </div>

          <div>
            <div className="text-xs uppercase font-mono tracking-wider text-slate-400">
              Clock Drift
            </div>
            <div className="text-xl font-mono font-bold text-cyan-300 tabular-nums">
              {driftPpb >= 0 ? `+${driftPpb.toFixed(3)}` : driftPpb.toFixed(3)}
              <span className="text-xs font-mono font-normal text-slate-400 ml-1">ppb</span>
            </div>
            <div className="text-xs font-mono text-slate-500">
              {(driftPpb / 1000).toFixed(4)} ppm
            </div>
          </div>

          <div>
            <div className="text-xs uppercase font-mono tracking-wider text-slate-400">
              Root Dispersion
            </div>
            <div className="text-xl font-mono font-bold text-slate-200 tabular-nums">
              {rootDispersionMs.toFixed(3)}
              <span className="text-xs font-mono font-normal text-slate-400 ml-1">ms</span>
            </div>
            <div className="text-xs font-mono text-slate-500">
              Delay: {rootDelayMs.toFixed(3)} ms
            </div>
          </div>

          <div>
            <div className="text-xs uppercase font-mono tracking-wider text-slate-400">
              Clock Precision
            </div>
            <div className="text-xl font-mono font-bold text-slate-200 tabular-nums">
              2<sup className="text-xs font-mono">-20</sup>
              <span className="text-xs font-mono font-normal text-slate-400 ml-1">s</span>
            </div>
            <div className="text-xs font-mono text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Phase Locked</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
