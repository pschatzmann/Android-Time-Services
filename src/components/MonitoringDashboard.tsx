/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  LineChart,
  Activity,
  Layers,
  TrendingDown,
  Clock,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Flame,
} from 'lucide-react';
import { TelemetryPoint, SourceConfig } from '../types/chronos';
import { calculateAllanDeviationCurve, formatOctalReach } from '../utils/clockMath';

interface MonitoringDashboardProps {
  history: TelemetryPoint[];
  sources: SourceConfig[];
  currentOffsetNs: number;
  currentDriftPpb: number;
}

export const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({
  history,
  sources,
  currentOffsetNs,
  currentDriftPpb,
}) => {
  const [timeWindow, setTimeWindow] = useState<'1m' | '5m' | '15m'>('5m');
  const [allanDevPoints] = useState(() => calculateAllanDeviationCurve());

  // Filter history based on time window
  const windowCount = timeWindow === '1m' ? 30 : timeWindow === '5m' ? 60 : 120;
  const slicedHistory = history.slice(-windowCount);

  // Calculate chart min/max scales
  const offsets = slicedHistory.map((p) => p.disciplinedOffsetNs / 1000); // in microseconds
  const drifts = slicedHistory.map((p) => p.driftPpb);
  const ntpDelays = slicedHistory.map((p) => p.ntpLatencyMs);
  const bleDelays = slicedHistory.map((p) => p.bleLatencyMs);

  const minOffset = Math.min(...offsets, -0.5);
  const maxOffset = Math.max(...offsets, 0.5);
  const minDrift = Math.min(...drifts, 0.5);
  const maxDrift = Math.max(...drifts, 2.5);

  // SVG coordinate mapper for line charts
  const width = 640;
  const height = 180;
  const pad = 30;

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
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Administrative Telemetry & Metrology Console
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time monitoring of local clock phase offset, frequency drift (ppb), transport latency, and Allan deviation
          </p>
        </div>

        {/* Time Window Buttons */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-mono">
          <button
            onClick={() => setTimeWindow('1m')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer ${
              timeWindow === '1m'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            1 Min Window
          </button>
          <button
            onClick={() => setTimeWindow('5m')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer ${
              timeWindow === '5m'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            5 Min Window
          </button>
          <button
            onClick={() => setTimeWindow('15m')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer ${
              timeWindow === '15m'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            15 Min Window
          </button>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart 1: Phase Offset & Frequency Drift */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-500" />
                <span>Clock Drift & Phase Offset</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Steering trajectory: phase error (µs) and fractional frequency offset (ppb)
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400">
                <span className="w-2.5 h-0.5 bg-cyan-500 inline-block"></span>
                <span>Offset: {(currentOffsetNs / 1000).toFixed(3)} µs</span>
              </span>
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="w-2.5 h-0.5 bg-emerald-500 inline-block"></span>
                <span>Drift: {currentDriftPpb.toFixed(3)} ppb</span>
              </span>
            </div>
          </div>

          {/* SVG Canvas */}
          <div className="w-full overflow-hidden">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44">
              {/* Grid lines */}
              <line x1={pad} y1={pad} x2={width - pad} y2={pad} stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeDasharray="3 3" />
              <line x1={pad} y1={height / 2} x2={width - pad} y2={height / 2} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
              <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeDasharray="3 3" />

              {/* Offset curve (Cyan) */}
              <path d={offsetPath} fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" />

              {/* Drift curve (Emerald) */}
              <path d={driftPath} fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="4 2" strokeLinecap="round" />

              {/* Axes labels */}
              <text x={pad} y={pad - 8} className="text-[10px] font-mono fill-slate-400">{maxOffset.toFixed(2)} µs</text>
              <text x={pad} y={height - 8} className="text-[10px] font-mono fill-slate-400">{minOffset.toFixed(2)} µs</text>
              <text x={width - pad} y={pad - 8} textAnchor="end" className="text-[10px] font-mono fill-emerald-500">{maxDrift.toFixed(1)} ppb</text>
              <text x={width - pad} y={height - 8} textAnchor="end" className="text-[10px] font-mono fill-emerald-500">{minDrift.toFixed(1)} ppb</text>
            </svg>
          </div>
          <div className="text-[11px] font-mono text-slate-400 flex justify-between border-t border-slate-100 dark:border-slate-800 pt-2">
            <span>-{timeWindow} ago</span>
            <span>Kalman Loop Damping: ζ = 0.85 · PLL Bandwidth: 0.05 Hz</span>
            <span>Now (0s)</span>
          </div>
        </div>

        {/* Chart 2: Source Transport Latency & Jitter */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-500" />
                <span>Round-Trip Latencies (NTP vs BLE CTS)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Over-the-network delay δ vs wireless Bluetooth LE transport delay
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400">
                <span className="w-2.5 h-0.5 bg-cyan-500 inline-block"></span>
                <span>NTP: ~14.8 ms</span>
              </span>
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <span className="w-2.5 h-0.5 bg-blue-500 inline-block"></span>
                <span>BLE CTS: ~28.5 ms</span>
              </span>
            </div>
          </div>

          {/* SVG Canvas */}
          <div className="w-full overflow-hidden">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44">
              <line x1={pad} y1={pad} x2={width - pad} y2={pad} stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeDasharray="3 3" />
              <line x1={pad} y1={height / 2} x2={width - pad} y2={height / 2} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
              <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeDasharray="3 3" />

              <path d={ntpPath} fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" />
              <path d={blePath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 2" strokeLinecap="round" />

              <text x={pad} y={pad - 8} className="text-[10px] font-mono fill-slate-400">35 ms</text>
              <text x={pad} y={height / 2 - 4} className="text-[10px] font-mono fill-slate-400">18 ms</text>
              <text x={pad} y={height - 8} className="text-[10px] font-mono fill-slate-400">0 ms</text>
            </svg>
          </div>
          <div className="text-[11px] font-mono text-slate-400 flex justify-between border-t border-slate-100 dark:border-slate-800 pt-2">
            <span>Network Jitter: 0.22 ms</span>
            <span>BLE Connection Interval: 30 ms</span>
            <span>Dispersion: 0.84 ms</span>
          </div>
        </div>
      </div>

      {/* Chart 3: Allan Deviation Stability Curve Matrix */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-purple-500" />
              <span>Allan Deviation σy(τ) Oscillator Stability Analysis</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Frequency stability metric quantifying phase noise and frequency drift over integration interval τ (1s to 1024s)
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
              <span className="w-2.5 h-0.5 bg-purple-500 inline-block"></span>
              <span>CSAC Atomic Clock</span>
            </span>
            <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400">
              <span className="w-2.5 h-0.5 bg-cyan-500 inline-block"></span>
              <span>Disciplined Output</span>
            </span>
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <span className="w-2.5 h-0.5 bg-amber-500 inline-block"></span>
              <span>Quartz OCXO</span>
            </span>
          </div>
        </div>

        {/* Tabular Allan Deviation Matrix */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
                <th className="py-2.5 px-3">Interval τ</th>
                <th className="py-2.5 px-3">Disciplined Output</th>
                <th className="py-2.5 px-3">CSAC Atomic Physics</th>
                <th className="py-2.5 px-3">Quartz OCXO Reference</th>
                <th className="py-2.5 px-3">Raw NTP Network</th>
                <th className="py-2.5 px-3">Dominant Noise Regime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 tabular-nums">
              {allanDevPoints.slice(0, 8).map((pt) => {
                const noiseRegime =
                  pt.tauSec <= 4
                    ? 'White Phase Noise (1/τ)'
                    : pt.tauSec <= 64
                    ? 'White Frequency Noise (1/√τ)'
                    : 'Flicker Frequency Floor';

                return (
                  <tr key={pt.tauSec} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                      τ = {pt.tauLabel}
                    </td>
                    <td className="py-2.5 px-3 text-cyan-600 dark:text-cyan-400 font-bold">
                      {pt.disciplinedSigma.toExponential(2)}
                    </td>
                    <td className="py-2.5 px-3 text-purple-600 dark:text-purple-400">
                      {pt.csacSigma.toExponential(2)}
                    </td>
                    <td className="py-2.5 px-3 text-amber-600 dark:text-amber-400">
                      {pt.quartzOcxoSigma.toExponential(2)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {pt.ntpNetworkSigma.toExponential(2)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-sans text-[11px]">
                      {noiseRegime}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Peer Ensemble Status Matrix Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-500" />
              <span>NTP & Ensemble Peer Selection Matrix (RFC 5905)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Intersection algorithm, falseticker rejection status, and 8-bit octal reach register
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Ensemble Validated</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
                <th className="py-2.5 px-3">Reference Peer</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Stratum</th>
                <th className="py-2.5 px-3">Offset θ</th>
                <th className="py-2.5 px-3">Delay δ</th>
                <th className="py-2.5 px-3">Jitter</th>
                <th className="py-2.5 px-3">Reach</th>
                <th className="py-2.5 px-3">Weight</th>
                <th className="py-2.5 px-3">Filter State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 tabular-nums">
              {sources.map((s) => {
                const tel = s.telemetry || {
                  offsetMs: 0,
                  delayMs: 0,
                  jitterMs: 0,
                  reach: 0o377,
                  status: 'standby',
                };
                const isSelected = tel.status === 'locked';

                return (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                      <span>{s.name}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 uppercase">{s.type}</td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">St {s.stratum}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                      {s.type === 'atomic' || s.type === 'gps'
                        ? `${(tel.offsetMs * 1000).toFixed(2)} µs`
                        : `${tel.offsetMs.toFixed(3)} ms`}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                      {tel.delayMs < 0.01 ? '<0.01 ms' : `${tel.delayMs.toFixed(2)} ms`}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                      {tel.jitterMs < 0.001 ? '<1 µs' : `${tel.jitterMs.toFixed(3)} ms`}
                    </td>
                    <td className="py-2.5 px-3 text-cyan-600 dark:text-cyan-400 font-bold">
                      {formatOctalReach(tel.reach)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                      {(s.weight * 100).toFixed(0)}%
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[11px] font-sans px-2 py-0.5 rounded font-medium ${
                        tel.status === 'locked'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : tel.status === 'candidate'
                          ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
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
