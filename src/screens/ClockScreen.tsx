/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Clock as ClockIcon,
  Globe2,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  ChevronRight,
  ShieldCheck,
  Zap,
  MapPin,
  Calendar,
} from 'lucide-react';
import { formatHighPrecisionTime } from '../utils/clockMath';
import { play1PpsClickSound } from '../utils/hardware';
import {
  calculateTimeZoneDetails,
  formatDisciplinedLocalTime,
  POPULAR_TIMEZONES,
  TimeZoneDetails,
} from '../utils/timeZoneEngine';
import { DisciplinedClockStatus } from '../types/chronos';

interface ClockScreenProps {
  clockStatus?: DisciplinedClockStatus;
  leapSecondsTai: number;
  leapSecondsGps: number;
  selectedTimezone: string;
  onSelectTimezone: (tz: string) => void;
}

export const ClockScreen: React.FC<ClockScreenProps> = ({
  clockStatus,
  leapSecondsTai,
  leapSecondsGps,
  selectedTimezone,
  onSelectTimezone,
}) => {
  const [timeScale, setTimeScale] = useState<'local' | 'utc' | 'tai' | 'gps'>('local');
  const [audio1PpsEnabled, setAudio1PpsEnabled] = useState(false);
  const [tzPickerOpen, setTzPickerOpen] = useState(false);

  const [tzDetails, setTzDetails] = useState<TimeZoneDetails>(() =>
    calculateTimeZoneDetails(new Date(), selectedTimezone)
  );

  const [displayClock, setDisplayClock] = useState<{
    dateStr: string;
    timeStr: string;
    fractionStr: string;
    timeZoneLabel: string;
  }>({
    dateStr: '2026-11-01',
    timeStr: '00:00:00',
    fractionStr: '.000 000',
    timeZoneLabel: 'PST',
  });

  const offsetNs = clockStatus?.offsetNs ?? 84;
  const driftPpb = clockStatus?.driftPpb ?? 1.42;
  const stratum = clockStatus?.activeStratum ?? 1;
  const refId = clockStatus?.lockedRefId ?? 'GPS';

  useEffect(() => {
    let lastSec = -1;
    let animId: number;

    const tick = () => {
      const now = new Date();
      const currentSec = now.getSeconds();

      if (currentSec !== lastSec) {
        lastSec = currentSec;
        if (audio1PpsEnabled) {
          play1PpsClickSound();
        }
      }

      const details = calculateTimeZoneDetails(now, selectedTimezone);
      setTzDetails(details);

      if (timeScale === 'local') {
        const local = formatDisciplinedLocalTime(now.getTime(), offsetNs, selectedTimezone);
        setDisplayClock({
          dateStr: local.dateStr,
          timeStr: local.timeStr,
          fractionStr: local.fractionStr,
          timeZoneLabel: `${local.timeZoneBadge} (${details.offsetFormatted})`,
        });
      } else {
        let targetMs = now.getTime();
        let label = 'UTC';
        if (timeScale === 'tai') {
          targetMs += leapSecondsTai * 1000;
          label = `TAI (+${leapSecondsTai}s)`;
        } else if (timeScale === 'gps') {
          targetMs += leapSecondsGps * 1000;
          label = `GPS (+${leapSecondsGps}s)`;
        }

        const highRes = formatHighPrecisionTime(new Date(targetMs), offsetNs);
        setDisplayClock({
          dateStr: highRes.dateStr,
          timeStr: highRes.timeStr,
          fractionStr: highRes.microsecondStr,
          timeZoneLabel: label,
        });
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [timeScale, selectedTimezone, offsetNs, audio1PpsEnabled, leapSecondsTai, leapSecondsGps]);

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      {/* Hero Clock Card - Material Design 3 Large Surface Container */}
      <div className="bg-gradient-to-b from-cyan-950/40 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center shadow-lg relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Stratum & Phase Lock Chip */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs font-mono text-cyan-400 mb-4 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold">STRATUM {stratum} DISCIPLINED</span>
          <span className="text-slate-500">·</span>
          <span>REF: {refId} / 1PPS / CSAC</span>
        </div>

        {/* Date Display */}
        <div className="flex items-center justify-center gap-2 text-slate-400 text-xs font-mono tracking-widest uppercase mb-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>{displayClock.dateStr}</span>
        </div>

        {/* Main Clock Numerals (Material 3 Display Large) */}
        <div className="py-2">
          <div className="text-5xl sm:text-7xl font-mono font-bold tracking-tight text-white tabular-nums">
            {displayClock.timeStr}
          </div>
          <div className="text-xl sm:text-2xl font-mono font-semibold text-cyan-400 tabular-nums mt-1">
            {displayClock.fractionStr}
          </div>
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mt-2 font-medium">
            {displayClock.timeZoneLabel}
          </div>
        </div>

        {/* Timescale Selector Chips */}
        <div className="flex items-center justify-center gap-1.5 pt-4 flex-wrap">
          {(['local', 'utc', 'tai', 'gps'] as const).map((scale) => (
            <button
              key={scale}
              onClick={() => {
                setTimeScale(scale);
                if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-medium transition-all cursor-pointer ${
                timeScale === scale
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {scale === 'local' ? 'Local Wall Time' : scale.toUpperCase()}
            </button>
          ))}

          <button
            onClick={() => setAudio1PpsEnabled(!audio1PpsEnabled)}
            title={audio1PpsEnabled ? 'Mute 1PPS Click' : 'Enable 1PPS Audio Pulse'}
            className={`p-2 rounded-full transition-all cursor-pointer ml-1 ${
              audio1PpsEnabled
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {audio1PpsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Local Time Zone Card (Material Design 3 Surface Container) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Globe2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs uppercase font-mono tracking-wider text-slate-400">
                Local Time Zone
              </div>
              <h3 className="font-semibold text-white text-base">
                {tzDetails.displayName}
              </h3>
            </div>
          </div>

          <button
            onClick={() => setTzPickerOpen(!tzPickerOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-xs font-mono text-cyan-300 border border-slate-700 transition-colors cursor-pointer"
          >
            <span>Change Zone</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Timezone Attributes Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-400 text-[10px] uppercase block">IANA Zone</span>
            <span className="font-bold text-slate-200 truncate block mt-0.5">{tzDetails.iana}</span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-400 text-[10px] uppercase block">UTC Offset</span>
            <span className="font-bold text-cyan-400 block mt-0.5">{tzDetails.offsetFormatted}</span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-400 text-[10px] uppercase block">Daylight Saving</span>
            <span className={`font-bold flex items-center gap-1 mt-0.5 ${tzDetails.isDst ? 'text-amber-400' : 'text-emerald-400'}`}>
              {tzDetails.isDst ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{tzDetails.isDst ? 'DST Active' : 'Standard'}</span>
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-400 text-[10px] uppercase block">BLE CTS 0x2A0F</span>
            <span className="font-bold text-blue-400 block mt-0.5">{tzDetails.quarterHours} quarters</span>
          </div>
        </div>

        {/* Timezone Picker Dropdown if open */}
        {tzPickerOpen && (
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <label className="text-xs font-mono text-slate-400 block">Select Region / City:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {POPULAR_TIMEZONES.map((tz) => (
                <button
                  key={tz.iana}
                  onClick={() => {
                    onSelectTimezone(tz.iana);
                    setTzPickerOpen(false);
                    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(15);
                  }}
                  className={`p-2.5 rounded-xl text-left text-xs font-mono transition-colors cursor-pointer flex items-center justify-between ${
                    selectedTimezone === tz.iana
                      ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold'
                      : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <span className="truncate">{tz.label}</span>
                  {selectedTimezone === tz.iana && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Synchronization Quality Metrology Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-sm">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Phase Offset</div>
          <div className="text-lg font-bold text-emerald-400 tabular-nums mt-0.5">
            {offsetNs >= 0 ? `+${offsetNs}` : offsetNs} ns
          </div>
          <div className="text-[10px] text-slate-500 mt-1">{(offsetNs / 1000).toFixed(3)} µs</div>
        </div>

        <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-sm">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Clock Drift</div>
          <div className="text-lg font-bold text-cyan-400 tabular-nums mt-0.5">
            {driftPpb >= 0 ? `+${driftPpb.toFixed(3)}` : driftPpb.toFixed(3)} ppb
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Frequency Lock</div>
        </div>

        <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-sm">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Root Dispersion</div>
          <div className="text-lg font-bold text-slate-200 tabular-nums mt-0.5">
            {(clockStatus?.rootDispersionMs ?? 0.84).toFixed(3)} ms
          </div>
          <div className="text-[10px] text-slate-500 mt-1">NTP Bound</div>
        </div>

        <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-sm">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Precision</div>
          <div className="text-lg font-bold text-slate-200 tabular-nums mt-0.5">
            2<sup className="text-xs">-20</sup> s
          </div>
          <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1">
            <ShieldCheck className="w-3 h-3" />
            <span>High Precision</span>
          </div>
        </div>
      </div>
    </div>
  );
};
