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
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';
import { SourceConfig, NtpPacketQueryResponse, BleCtsParsedTime } from '../types/chronos';
import { formatOctalReach, generateSyntheticNmea } from '../utils/clockMath';
import { BleCtsClient, SerialGpsClient } from '../utils/hardware';

interface SourcesScreenProps {
  sources: SourceConfig[];
  onToggleSource: (id: string, enabled: boolean) => void;
  onUpdateWeight: (id: string, weight: number) => void;
}

export const SourcesScreen: React.FC<SourcesScreenProps> = ({
  sources,
  onToggleSource,
  onUpdateWeight,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>('src_gps');

  // Hardware helpers
  const [bleClient] = useState(() => new BleCtsClient());
  const [bleConnecting, setBleConnecting] = useState(false);
  const [bleStatus, setBleStatus] = useState<string | null>(null);

  const [serialGps] = useState(() => new SerialGpsClient());
  const [serialConnecting, setSerialConnecting] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [nmeaLog, setNmeaLog] = useState<string[]>(() => generateSyntheticNmea());

  // NTP prober
  const [ntpQueryHost, setNtpQueryHost] = useState('time.cloudflare.com');
  const [ntpQuerying, setNtpQuerying] = useState(false);
  const [ntpResult, setNtpResult] = useState<NtpPacketQueryResponse | null>(null);

  const handleConnectBle = async () => {
    setBleConnecting(true);
    setBleStatus('Requesting Bluetooth device with Current Time Service (0x1805)...');
    try {
      const status = await bleClient.connect();
      setBleStatus(
        status.isSimulated
          ? 'Connected to simulated CTS peripheral (0x1805)'
          : `Connected to ${status.deviceName}`
      );
    } catch (e: any) {
      setBleStatus(`BLE Error: ${e.message}`);
    } finally {
      setBleConnecting(false);
    }
  };

  const handleConnectGps = async () => {
    setSerialConnecting(true);
    setGpsStatus('Requesting Web Serial port for GNSS (115200 baud)...');
    try {
      const status = await serialGps.connect(115200, (sentence) => {
        setNmeaLog((prev) => [sentence, ...prev.slice(0, 10)]);
      });
      setGpsStatus(
        status.isSimulated
          ? 'Connected to GNSS engine (1PPS synthetic locked)'
          : `Connected to ${status.portInfo}`
      );
    } catch (e: any) {
      setGpsStatus(`Serial Error: ${e.message}`);
    } finally {
      setSerialConnecting(false);
    }
  };

  const handleQueryNtp = async () => {
    setNtpQuerying(true);
    try {
      const res = await fetch('/api/ntp/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: ntpQueryHost }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setNtpResult(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setNtpQuerying(false);
    }
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'atomic':
        return <Atom className="w-5 h-5 text-purple-400" />;
      case 'gps':
        return <Satellite className="w-5 h-5 text-emerald-400" />;
      case 'ntp':
        return <Globe className="w-5 h-5 text-cyan-400" />;
      case 'ble_cts':
        return <Bluetooth className="w-5 h-5 text-blue-400" />;
      default:
        return <Activity className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Time Sources & Disciplining
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Reference inputs feeding the local clock disciplining engine: CSAC atomic clock, GPS 1PPS, NTP pools, and BLE CTS.
        </p>
      </div>

      <div className="space-y-4">
        {sources.map((src) => {
          const isExpanded = expandedId === src.id;
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
              className={`rounded-3xl border transition-all overflow-hidden ${
                src.enabled
                  ? 'bg-slate-900 border-slate-800 shadow-sm'
                  : 'bg-slate-900/60 border-slate-850 opacity-70'
              }`}
            >
              {/* Header */}
              <div className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-slate-800 flex items-center justify-center shrink-0">
                    {getSourceIcon(src.type)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-base">
                      {src.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-0.5">
                      <span>Stratum {src.stratum}</span>
                      <span>·</span>
                      <span className="capitalize">{src.type.replace('_', ' ')}</span>
                      <span>·</span>
                      <span className="text-emerald-400 font-bold uppercase">{tel.status}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* M3 Switch */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={src.enabled}
                      onChange={(e) => onToggleSource(src.id, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-7 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-slate-400 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500 peer-checked:after:bg-slate-950"></div>
                  </label>

                  <button
                    onClick={() => setExpandedId(isExpanded ? null : src.id)}
                    className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Quick Metrics Bar */}
              <div className="px-5 py-3 grid grid-cols-4 gap-2 bg-slate-950/40 border-t border-slate-800/60 font-mono text-center text-xs">
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">Offset</span>
                  <span className="font-bold text-slate-200">
                    {src.type === 'atomic' || src.type === 'gps'
                      ? `${(tel.offsetMs * 1000).toFixed(2)} µs`
                      : `${tel.offsetMs.toFixed(3)} ms`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">Delay</span>
                  <span className="font-semibold text-slate-300">
                    {tel.delayMs < 0.01 ? '<0.01 ms' : `${tel.delayMs.toFixed(2)} ms`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">Jitter</span>
                  <span className="font-semibold text-slate-300">
                    {tel.jitterMs < 0.001 ? '<1 µs' : `${tel.jitterMs.toFixed(3)} ms`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">Reach</span>
                  <span className="font-bold text-cyan-400">{formatOctalReach(tel.reach)}</span>
                </div>
              </div>

              {/* Weight Slider */}
              <div className="px-5 py-3 border-t border-slate-800/60 flex items-center justify-between gap-4 text-xs font-mono">
                <span className="text-slate-400 shrink-0">Kalman Weight:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(src.weight * 100)}
                  onChange={(e) => onUpdateWeight(src.id, parseInt(e.target.value, 10) / 100)}
                  disabled={!src.enabled}
                  className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer disabled:opacity-50"
                />
                <span className="font-bold text-white tabular-nums w-10 text-right">
                  {(src.weight * 100).toFixed(0)}%
                </span>
              </div>

              {/* Expanded Hardware Inspector */}
              {isExpanded && (
                <div className="p-5 border-t border-slate-800 bg-slate-950/60 space-y-3">
                  {src.type === 'gps' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-slate-400 uppercase">
                          GNSS Receiver & 1PPS Serial Interface
                        </span>
                        <button
                          onClick={handleConnectGps}
                          disabled={serialConnecting}
                          className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                          <span>{serialConnecting ? 'Connecting...' : 'Connect Web Serial'}</span>
                        </button>
                      </div>

                      {gpsStatus && (
                        <div className="p-2.5 rounded-xl bg-emerald-950/40 text-emerald-300 border border-emerald-900/50 text-xs font-mono">
                          {gpsStatus}
                        </div>
                      )}

                      <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs overflow-x-auto space-y-1">
                        <div className="text-[10px] text-slate-500 pb-1 border-b border-slate-800">
                          LIVE NMEA 0183 SATELLITE STREAM (18 SATELLITES TRACKED)
                        </div>
                        {nmeaLog.slice(0, 4).map((line, idx) => (
                          <div key={idx} className="text-emerald-400/90 whitespace-nowrap">
                            {line}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {src.type === 'ble_cts' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-slate-400 uppercase">
                          Web Bluetooth CTS Client (0x1805)
                        </span>
                        <button
                          onClick={handleConnectBle}
                          disabled={bleConnecting}
                          className="px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Bluetooth className="w-3.5 h-3.5" />
                          <span>{bleConnecting ? 'Connecting...' : 'Connect Web Bluetooth'}</span>
                        </button>
                      </div>

                      {bleStatus && (
                        <div className="p-2.5 rounded-xl bg-blue-950/40 text-blue-300 border border-blue-900/50 text-xs font-mono">
                          {bleStatus}
                        </div>
                      )}
                    </div>
                  )}

                  {src.type === 'ntp' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-slate-400 uppercase">
                          RFC 5905 NTP Network Prober
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={ntpQueryHost}
                            onChange={(e) => setNtpQueryHost(e.target.value)}
                            className="px-3 py-1 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-white w-40"
                          />
                          <button
                            onClick={handleQueryNtp}
                            disabled={ntpQuerying}
                            className="px-3 py-1 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Search className="w-3.5 h-3.5" />
                            <span>{ntpQuerying ? 'Querying...' : 'Query'}</span>
                          </button>
                        </div>
                      </div>

                      {ntpResult && (
                        <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs grid grid-cols-2 gap-2 text-slate-300">
                          <div>Offset: <span className="text-emerald-400 font-bold">{ntpResult.offsetMs} ms</span></div>
                          <div>Roundtrip Delay: <span className="text-white">{ntpResult.delayMs} ms</span></div>
                          <div>Root Dispersion: <span>{ntpResult.rootDispersionMs} ms</span></div>
                          <div>Stratum: <span>{ntpResult.stratum} ({ntpResult.refId})</span></div>
                        </div>
                      )}
                    </div>
                  )}

                  {src.type === 'atomic' && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-slate-500 text-[10px] block">Oven Temp</span>
                        <span className="font-bold text-white">45.1 °C</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-slate-500 text-[10px] block">RF Power</span>
                        <span className="font-bold text-white">9.8 mW</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-slate-500 text-[10px] block">Allan Dev (1s)</span>
                        <span className="font-bold text-purple-400">2.1e-11</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-slate-500 text-[10px] block">Physics Lock</span>
                        <span className="font-bold text-emerald-400">Locked</span>
                      </div>
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
