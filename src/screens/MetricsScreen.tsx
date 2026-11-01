/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Activity,
  Radio,
  TrendingDown,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { TelemetryPoint, SourceConfig } from '../types/chronos';
import { calculateAllanDeviationCurve, formatOctalReach } from '../utils/clockMath';

interface MetricsScreenProps {
  history: TelemetryPoint[];
  sources: SourceConfig[];
  currentOffsetNs: number;
  currentDriftPpb: number;
}

export const MetricsScreen: React.FC<MetricsScreenProps> = ({
  history,
  sources,
  currentOffsetNs,
  currentDriftPpb,
}) => {
  const [timeWindow, setTimeWindow] = useState<'1m' | '5m' | '15m'>('5m');
  const [allanDevPoints] = useState(() => calculateAllanDeviationCurve());

  const windowCount = timeWindow === '1m' ? 30 : timeWindow === '5m' ? 60 : 120;
  const slicedHistory = history.slice(-windowCount);

  const offsets = slicedHistory.map((p) => p.disciplinedOffsetNs / 1000);
  const drifts = slicedHistory.map((p) => p.driftPpb);
  const ntpDelays = slicedHistory.map((p) => p.ntpLatencyMs);
  const bleDelays = slicedHistory.map((p) => p.bleLatencyMs);

  const minOffset = Math.min(...offsets, -0.5);
  const maxOffset = Math.max(...offsets, 0.5);
  const minDrift = Math.min(...drifts, 0.5);
  const maxDrift = Math.max(...drifts, 2.5);

  const width = 600;
  const height = 160;
  const pad = 25;

  const getPointsPath = (data: number[], minVal: number, maxVal: number) => {
    if (data.length < 2) return '';
    const span = Math.max(0.001, maxVal - minVal);
    return data
      .map((val, idx) => {
        const x = pad + (idx / (data.length - 1)) * (width - pad * 2);
        const y = height - pad - ((val - minVal) / span) * (height - pad * 2);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const offsetPath = getPointsPath(offsets, minOffset, maxOffset);
  const driftPath = getPointsPath(drifts, minDrift, maxDrift);
  const ntpPath = getPointsPath(ntpDelays, 0, 35);
  const blePath = getPointsPath(bleDelays, 0, 35);

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      {/* Header with M3 Segmented Control for Time Window */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Telemetry & Clock Drift
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Phase offset trajectory, fractional frequency drift (ppb), transport delay, and Allan deviation.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-full text-xs font-mono self-start sm:self-auto">
          {(['1m', '5m', '15m'] as const).map((win) => (
            <button
              key={win}
              onClick={() => {
                setTimeWindow(win);
                if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10);
              }}
              className={`px-3 py-1 rounded-full font-medium transition-all cursor-pointer ${
                timeWindow === win
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {win === '1m' ? '1 min' : win === '5m' ? '5 min' : '15 min'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Two Visual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart 1: Phase Offset & Drift */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-white text-sm">
                Offset (µs) & Frequency Drift (ppb)
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-cyan-400 font-bold">{(currentOffsetNs / 1000).toFixed(3)} µs</span>
              <span className="text-emerald-400 font-bold">{currentDriftPpb.toFixed(3)} ppb</span>
            </div>
          </div>

          <div className="w-full overflow-hidden">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36">
              <line x1={pad} y1={pad} x2={width - pad} y2={pad} stroke="currentColor" className="text-slate-800" strokeDasharray="3 3" />
              <line x1={pad} y1={height / 2} x2={width - pad} y2={height / 2} stroke="currentColor" className="text-slate-800" />
              <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="currentColor" className="text-slate-800" strokeDasharray="3 3" />

              <path d={offsetPath} fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" />
              <path d={driftPath} fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="4 2" strokeLinecap="round" />
            </svg>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-800/80">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="w-2.5 h-0.5 bg-cyan-400 rounded-full" />
              <span>Phase Offset</span>
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-0.5 bg-emerald-400 rounded-full" />
              <span>Drift Rate</span>
            </span>
            <span>Window: {timeWindow}</span>
          </div>
        </div>

        {/* Chart 2: Transport Latencies */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Radio className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-white text-sm">
                Round-Trip Latencies (NTP vs BLE)
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-cyan-400">NTP: ~14.8 ms</span>
              <span className="text-blue-400">BLE: ~28.5 ms</span>
            </div>
          </div>

          <div className="w-full overflow-hidden">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36">
              <line x1={pad} y1={pad} x2={width - pad} y2={pad} stroke="currentColor" className="text-slate-800" strokeDasharray="3 3" />
              <line x1={pad} y1={height / 2} x2={width - pad} y2={height / 2} stroke="currentColor" className="text-slate-800" />
              <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="currentColor" className="text-slate-800" strokeDasharray="3 3" />

              <path d={ntpPath} fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" />
              <path d={blePath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 2" strokeLinecap="round" />
            </svg>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-800/80">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="w-2.5 h-0.5 bg-cyan-400 rounded-full" />
              <span>NTP Network Delay</span>
            </span>
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="w-2.5 h-0.5 bg-blue-400 rounded-full" />
              <span>BLE OTA Transport</span>
            </span>
          </div>
        </div>
      </div>

      {/* Allan Deviation Stability Table */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <TrendingDown className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-base">
              Allan Deviation σy(τ) Stability Table
            </h3>
            <p className="text-xs text-slate-400">
              Empirical oscillator stability across integration intervals τ (1s to 1024s)
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px]">
                <th className="py-2.5 px-3">Interval τ</th>
                <th className="py-2.5 px-3">Disciplined Output</th>
                <th className="py-2.5 px-3">CSAC Atomic Physics</th>
                <th className="py-2.5 px-3">Quartz OCXO Reference</th>
                <th className="py-2.5 px-3">Noise Mechanism</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 tabular-nums text-slate-300">
              {allanDevPoints.slice(0, 6).map((pt) => {
                const noise =
                  pt.tauSec <= 4
                    ? 'White Phase Noise (1/τ)'
                    : pt.tauSec <= 64
                    ? 'White Frequency Noise (1/√τ)'
                    : 'Flicker Frequency Floor';

                return (
                  <tr key={pt.tauSec} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-bold text-white">τ = {pt.tauLabel}</td>
                    <td className="py-2.5 px-3 text-cyan-400 font-bold">{pt.disciplinedSigma.toExponential(2)}</td>
                    <td className="py-2.5 px-3 text-purple-400">{pt.csacSigma.toExponential(2)}</td>
                    <td className="py-2.5 px-3 text-amber-400">{pt.quartzOcxoSigma.toExponential(2)}</td>
                    <td className="py-2.5 px-3 text-slate-500 font-sans text-[11px]">{noise}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* NTP Peer Selection Table */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-base">
              Peer Selection & Reach Matrix (RFC 5905)
            </h3>
            <p className="text-xs text-slate-400">
              Ensemble peer states, 8-bit octal reach register, and falseticker status
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px]">
                <th className="py-2.5 px-3">Peer Source</th>
                <th className="py-2.5 px-3">Stratum</th>
                <th className="py-2.5 px-3">Offset θ</th>
                <th className="py-2.5 px-3">Delay δ</th>
                <th className="py-2.5 px-3">Reach</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 tabular-nums text-slate-300">
              {sources.map((s) => {
                const tel = s.telemetry || {
                  offsetMs: 0,
                  delayMs: 0,
                  reach: 0o377,
                  status: 'standby',
                };
                return (
                  <tr key={s.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-semibold text-white">{s.name}</td>
                    <td className="py-2.5 px-3">Stratum {s.stratum}</td>
                    <td className="py-2.5 px-3 text-cyan-400 font-bold">
                      {s.type === 'atomic' || s.type === 'gps'
                        ? `${(tel.offsetMs * 1000).toFixed(2)} µs`
                        : `${tel.offsetMs.toFixed(3)} ms`}
                    </td>
                    <td className="py-2.5 px-3">
                      {tel.delayMs < 0.01 ? '<0.01 ms' : `${tel.delayMs.toFixed(2)} ms`}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white">{formatOctalReach(tel.reach)}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {tel.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
