/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Satellite,
  Atom,
  Globe,
  Bluetooth,
  Terminal,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
  Cpu,
  Wifi,
  Search,
} from 'lucide-react';
import { SourceConfig, NtpPacketQueryResponse, BleCtsParsedTime } from '../types/chronos';
import { formatOctalReach, generateSyntheticNmea } from '../utils/clockMath';
import { BleCtsClient, SerialGpsClient } from '../utils/hardware';

interface SourceEnsembleProps {
  sources: SourceConfig[];
  onToggleSource: (id: string, enabled: boolean) => void;
  onUpdateWeight: (id: string, weight: number) => void;
}

export const SourceEnsemble: React.FC<SourceEnsembleProps> = ({
  sources,
  onToggleSource,
  onUpdateWeight,
}) => {
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>('src_gps');
  const [ntpQueryHost, setNtpQueryHost] = useState('time.cloudflare.com');
  const [ntpQuerying, setNtpQuerying] = useState(false);
  const [ntpQueryResult, setNtpQueryResult] = useState<NtpPacketQueryResponse | null>(null);
  const [ntpQueryError, setNtpQueryError] = useState<string | null>(null);

  // Web Bluetooth state
  const [bleClient] = useState(() => new BleCtsClient());
  const [bleConnecting, setBleConnecting] = useState(false);
  const [bleLiveParsed, setBleLiveParsed] = useState<BleCtsParsedTime | null>(null);
  const [bleStatusMsg, setBleStatusMsg] = useState<string | null>(null);

  // Web Serial GPS state
  const [serialGps] = useState(() => new SerialGpsClient());
  const [serialConnecting, setSerialConnecting] = useState(false);
  const [nmeaLog, setNmeaLog] = useState<string[]>(() => generateSyntheticNmea());
  const [gpsStatusMsg, setGpsStatusMsg] = useState<string | null>(null);

  // Handle Real NTP query via backend
  const handleQueryNtp = async (host: string) => {
    setNtpQuerying(true);
    setNtpQueryError(null);
    try {
      const res = await fetch('/api/ntp/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setNtpQueryResult(data.data);
      } else {
        setNtpQueryError(data.error || 'Failed to query NTP server');
      }
    } catch (e: any) {
      setNtpQueryError(e.message || 'Network error querying NTP');
    } finally {
      setNtpQuerying(false);
    }
  };

  // Handle Web Bluetooth CTS connect
  const handleConnectBleCts = async () => {
    setBleConnecting(true);
    setBleStatusMsg('Scanning for BLE Current Time Service (0x1805)...');
    try {
      const status = await bleClient.connect((time) => {
        setBleLiveParsed(time);
      });
      if (status.lastReadTime) {
        setBleLiveParsed(status.lastReadTime);
      }
      setBleStatusMsg(
        status.isSimulated
          ? 'Connected to Nordic nRF52 CTS (Simulated profile)'
          : `Connected to ${status.deviceName} (0x1805 / 0x2A2B active)`
      );
    } catch (err: any) {
      setBleStatusMsg(`BLE Error: ${err.message}`);
    } finally {
      setBleConnecting(false);
    }
  };

  // Handle Web Serial GPS connect
  const handleConnectGpsSerial = async () => {
    setSerialConnecting(true);
    setGpsStatusMsg('Requesting Serial Port for GNSS (115200 baud)...');
    try {
      const status = await serialGps.connect(115200, (sentence) => {
        setNmeaLog((prev) => [sentence, ...prev.slice(0, 15)]);
      });
      setGpsStatusMsg(
        status.isSimulated
          ? 'Connected to GNSS engine (1PPS synthetic locked)'
          : `Connected to ${status.portInfo}`
      );
    } catch (e: any) {
      setGpsStatusMsg(`GPS Serial Error: ${e.message}`);
    } finally {
      setSerialConnecting(false);
    }
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'atomic':
        return <Atom className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
      case 'gps':
        return <Satellite className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      case 'ntp':
        return <Globe className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />;
      case 'ble_cts':
        return <Bluetooth className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      default:
        return <Activity className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Source Ensemble & Disciplining Channels
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Multi-path reference inputs: BLE CTS, NTP pools, GNSS PPS, and Chip-Scale Atomic Clock
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-slate-500 dark:text-slate-400">
          <span>Active Sources: {sources.filter((s) => s.enabled).length} / {sources.length}</span>
          <span>·</span>
          <span>Disciplining: Kalman Filter Fusion</span>
        </div>
      </div>

      {/* Grid of 4 Source Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {sources.map((src) => {
          const isExpanded = expandedSourceId === src.id;
          const tel = src.telemetry || {
            offsetMs: 0,
            delayMs: 0,
            jitterMs: 0,
            reach: 0o377,
            status: 'standby',
            lastSeen: Date.now(),
          };

          return (
            <div
              key={src.id}
              className={`rounded-xl border transition-all ${
                src.enabled
                  ? 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800/60 opacity-70'
              }`}
            >
              {/* Card Header */}
              <div className="p-5 flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800/60">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                    {getSourceIcon(src.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                        {src.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400 mt-1">
                      <span>Stratum {src.stratum}</span>
                      <span>·</span>
                      <span className="capitalize">{src.type.replace('_', ' ')}</span>
                      <span>·</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {tel.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right controls: Enable Switch & Expand Button */}
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={src.enabled}
                      onChange={(e) => onToggleSource(src.id, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600 dark:peer-checked:bg-cyan-500"></div>
                  </label>

                  <button
                    onClick={() => setExpandedSourceId(isExpanded ? null : src.id)}
                    aria-label={isExpanded ? 'Collapse card' : 'Expand card'}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Card Metrics Strip */}
              <div className="px-5 py-3.5 grid grid-cols-4 gap-2 bg-slate-50/70 dark:bg-slate-950/40 text-center font-mono">
                <div>
                  <div className="text-[10px] uppercase text-slate-400">Offset</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                    {src.type === 'atomic' || src.type === 'gps'
                      ? `${(tel.offsetMs * 1000).toFixed(2)} µs`
                      : `${tel.offsetMs.toFixed(3)} ms`}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-400">Delay</div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                    {tel.delayMs < 0.01 ? '<0.01 ms' : `${tel.delayMs.toFixed(2)} ms`}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-400">Jitter</div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                    {tel.jitterMs < 0.001 ? '<1 µs' : `${tel.jitterMs.toFixed(3)} ms`}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-400">Reach</div>
                  <div className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 tabular-nums">
                    {formatOctalReach(tel.reach)}
                  </div>
                </div>
              </div>

              {/* Weight Adjustment Slider */}
              <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-4 text-xs font-mono">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">Kalman Weight:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(src.weight * 100)}
                  onChange={(e) => onUpdateWeight(src.id, parseInt(e.target.value, 10) / 100)}
                  disabled={!src.enabled}
                  className="w-full accent-cyan-600 dark:accent-cyan-400 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer disabled:opacity-50"
                />
                <span className="font-bold text-slate-700 dark:text-slate-200 tabular-nums w-12 text-right">
                  {(src.weight * 100).toFixed(0)}%
                </span>
              </div>

              {/* Expanded Deep Telemetry & Hardware Inspector */}
              {isExpanded && (
                <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/70 space-y-4">
                  {/* Case 1: Atomic CSAC Details */}
                  {src.type === 'atomic' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs font-mono text-slate-500">
                        <span>PHYSICS PACKAGE TELEMETRY</span>
                        <span className="text-emerald-600 dark:text-emerald-400">Microwave Lock Active</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                        <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <div className="text-slate-400 text-[10px]">Oven Temp</div>
                          <div className="font-bold text-slate-800 dark:text-slate-200">45.1 °C</div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <div className="text-slate-400 text-[10px]">RF Power</div>
                          <div className="font-bold text-slate-800 dark:text-slate-200">9.8 mW</div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <div className="text-slate-400 text-[10px]">Laser Current</div>
                          <div className="font-bold text-slate-800 dark:text-slate-200">1.82 mA</div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <div className="text-slate-400 text-[10px]">Allan Dev (1s)</div>
                          <div className="font-bold text-purple-600 dark:text-purple-400">2.1e-11</div>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Ultra-stable cesium coherent population trapping (CPT) interrogation provides the primary holdover baseline with minimal short-term drift.
                      </p>
                    </div>
                  )}

                  {/* Case 2: GPS NMEA & 1PPS Serial Details */}
                  {src.type === 'gps' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-slate-500 uppercase">
                          GNSS Receiver & 1PPS Trigger
                        </span>
                        <button
                          onClick={handleConnectGpsSerial}
                          disabled={serialConnecting}
                          className="px-2.5 py-1 text-xs font-mono bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                          <span>{serialConnecting ? 'Connecting...' : 'Connect Web Serial'}</span>
                        </button>
                      </div>

                      {gpsStatusMsg && (
                        <div className="text-xs font-mono p-2 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                          {gpsStatusMsg}
                        </div>
                      )}

                      <div className="bg-slate-900 text-slate-200 p-3 rounded-lg font-mono text-xs overflow-x-auto border border-slate-800">
                        <div className="text-slate-400 text-[10px] pb-1 border-b border-slate-800 flex justify-between">
                          <span>LIVE NMEA 0183 STREAM</span>
                          <span>18 SATS · HDOP 0.72</span>
                        </div>
                        <div className="pt-2 space-y-1">
                          {nmeaLog.map((line, idx) => (
                            <div key={idx} className="whitespace-nowrap text-emerald-400/90">
                              {line}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Case 3: NTP Stratum-1 Query & RFC 5905 Packet Inspector */}
                  {src.type === 'ntp' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-slate-500 uppercase">
                          RFC 5905 Client Prober
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={ntpQueryHost}
                            onChange={(e) => setNtpQueryHost(e.target.value)}
                            placeholder="time.server.org"
                            className="px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 w-44"
                          />
                          <button
                            onClick={() => handleQueryNtp(ntpQueryHost)}
                            disabled={ntpQuerying}
                            className="px-2.5 py-1 text-xs font-mono bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                          >
                            <Search className="w-3.5 h-3.5" />
                            <span>{ntpQuerying ? 'Querying...' : 'Query NTP'}</span>
                          </button>
                        </div>
                      </div>

                      {ntpQueryError && (
                        <div className="text-xs font-mono p-2 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40">
                          {ntpQueryError}
                        </div>
                      )}

                      {ntpQueryResult && (
                        <div className="bg-slate-900 text-slate-200 p-3 rounded-lg font-mono text-xs space-y-2 border border-slate-800">
                          <div className="text-cyan-400 text-[10px] pb-1 border-b border-slate-800 flex justify-between">
                            <span>NTP PACKET DECODE ({ntpQueryHost})</span>
                            <span>REFID: {ntpQueryResult.refId} · STRATUM {ntpQueryResult.stratum}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>Offset θ: <span className="text-emerald-400 font-bold">{ntpQueryResult.offsetMs} ms</span></div>
                            <div>Roundtrip Delay δ: <span className="text-slate-300 font-bold">{ntpQueryResult.delayMs} ms</span></div>
                            <div>Root Dispersion: <span className="text-slate-300">{ntpQueryResult.rootDispersionMs} ms</span></div>
                            <div>Root Delay: <span className="text-slate-300">{ntpQueryResult.rootDelayMs} ms</span></div>
                          </div>
                          <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                            <div>T1 (Origin): {ntpQueryResult.timestamps.t1_originate}</div>
                            <div>T2 (Receive): {ntpQueryResult.timestamps.t2_receive}</div>
                            <div>T3 (Transmit): {ntpQueryResult.timestamps.t3_transmit}</div>
                            <div>T4 (Arrival): {ntpQueryResult.timestamps.t4_destination}</div>
                          </div>
                          {ntpQueryResult.rawHex && (
                            <div className="text-[9px] text-slate-500 break-all pt-1 font-mono">
                              RAW HEX: {ntpQueryResult.rawHex}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Case 4: BLE Current Time Service (0x1805 / 0x2A2B) Inspector */}
                  {src.type === 'ble_cts' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-slate-500 uppercase">
                          Bluetooth LE CTS GATT Client (0x1805)
                        </span>
                        <button
                          onClick={handleConnectBleCts}
                          disabled={bleConnecting}
                          className="px-2.5 py-1 text-xs font-mono bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                        >
                          <Bluetooth className="w-3.5 h-3.5" />
                          <span>{bleConnecting ? 'Connecting...' : 'Connect Web Bluetooth'}</span>
                        </button>
                      </div>

                      {bleStatusMsg && (
                        <div className="text-xs font-mono p-2 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40">
                          {bleStatusMsg}
                        </div>
                      )}

                      {bleLiveParsed && (
                        <div className="bg-slate-900 text-slate-200 p-3 rounded-lg font-mono text-xs space-y-2 border border-slate-800">
                          <div className="text-blue-400 text-[10px] pb-1 border-b border-slate-800 flex justify-between">
                            <span>GATT CHARACTERISTIC 0x2A2B (10 BYTES)</span>
                            <span>ADJUST REASON: 0x0{bleLiveParsed.adjustReason}</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                            <div>Date: <span className="text-slate-100">{bleLiveParsed.year}-{String(bleLiveParsed.month).padStart(2, '0')}-{String(bleLiveParsed.day).padStart(2, '0')}</span></div>
                            <div>Time: <span className="text-blue-300 font-bold">{String(bleLiveParsed.hours).padStart(2, '0')}:{String(bleLiveParsed.minutes).padStart(2, '0')}:{String(bleLiveParsed.seconds).padStart(2, '0')}</span></div>
                            <div>Fraction: <span className="text-emerald-400">{bleLiveParsed.fractions256}/256 ({bleLiveParsed.subsecondMs} ms)</span></div>
                          </div>
                          <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800 font-mono">
                            WIRE HEX: {bleLiveParsed.hex}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
