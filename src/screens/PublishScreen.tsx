/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Radio,
  Bluetooth,
  Send,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Activity,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { NtpServerConfig, BleCtsServerConfig } from '../types/chronos';
import { TimeZoneDetails } from '../utils/timeZoneEngine';

interface PublishScreenProps {
  ntpConfig: NtpServerConfig & { packetsServed: number; bandwidthKbps: number };
  bleConfig: BleCtsServerConfig & { activeSubscribers: number; lastPacket?: any };
  tzDetails: TimeZoneDetails;
  onToggleNtpServer: (enabled: boolean) => void;
  onToggleBleCtsServer: (enabled: boolean) => void;
  onNavigateToSettings: () => void;
}

export const PublishScreen: React.FC<PublishScreenProps> = ({
  ntpConfig,
  bleConfig,
  tzDetails,
  onToggleNtpServer,
  onToggleBleCtsServer,
  onNavigateToSettings,
}) => {
  const [testQueryResult, setTestQueryResult] = useState<any>(null);
  const [testQuerying, setTestQuerying] = useState(false);

  const handleTestNtpQuery = async () => {
    setTestQuerying(true);
    try {
      const res = await fetch('/api/ntp/time');
      const data = await res.json();
      setTestQueryResult(data);
    } catch (e: any) {
      setTestQueryResult({
        enabled: false,
        error: e.message || 'Error querying local NTP server',
      });
    } finally {
      setTestQuerying(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      {/* Screen Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Time Publishing Services
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Activate or deactivate this phone as an NTP network server and Bluetooth Low Energy Current Time Service (CTS) broadcaster.
        </p>
      </div>

      {/* Card 1: Phone as NTP Server */}
      <div
        className={`rounded-3xl border transition-all p-6 shadow-sm space-y-5 ${
          ntpConfig.enabled
            ? 'bg-slate-900 border-cyan-500/40 shadow-cyan-950/20'
            : 'bg-slate-900/60 border-slate-800 opacity-85'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                ntpConfig.enabled
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              <Radio className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">
                NTP Server Daemon (RFC 5905)
              </h3>
              <div className="flex items-center gap-2 text-xs font-mono mt-0.5">
                <span
                  className={`font-semibold flex items-center gap-1 ${
                    ntpConfig.enabled ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {ntpConfig.enabled ? '● Active & Serving' : '○ Deactivated (Stopped)'}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Port {ntpConfig.listenPort || 123}</span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Stratum {ntpConfig.stratum} ({ntpConfig.refId})</span>
              </div>
            </div>
          </div>

          {/* Material 3 Switch */}
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={ntpConfig.enabled}
              onChange={(e) => {
                onToggleNtpServer(e.target.checked);
                if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(20);
              }}
              className="sr-only peer"
            />
            <div className="w-14 h-8 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-slate-400 after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-cyan-500 peer-checked:after:bg-slate-950"></div>
          </label>
        </div>

        {/* State description */}
        <p className="text-xs text-slate-400">
          {ntpConfig.enabled
            ? 'The phone is actively responding to NTP queries on UDP port 123 and HTTP /api/ntp/time, serving local synchronized time to network computers and devices.'
            : 'NTP server daemon is deactivated. The phone will not answer network time queries.'}
        </p>

        {/* Metrics Row */}
        <div className="grid grid-cols-3 gap-3 text-center font-mono text-xs">
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <div className="text-[10px] uppercase text-slate-500">Packets Served</div>
            <div className="text-base font-bold text-white tabular-nums mt-0.5">
              {ntpConfig.enabled ? ntpConfig.packetsServed.toLocaleString() : '0'}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <div className="text-[10px] uppercase text-slate-500">Network Bandwidth</div>
            <div className="text-base font-bold text-cyan-400 tabular-nums mt-0.5">
              {ntpConfig.enabled ? `${ntpConfig.bandwidthKbps.toFixed(2)} kbps` : '0 kbps'}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <div className="text-[10px] uppercase text-slate-500">Rate Limiter</div>
            <div className="text-base font-bold text-emerald-400 tabular-nums mt-0.5">
              {ntpConfig.rateLimitPerMin}/min
            </div>
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleTestNtpQuery}
            disabled={testQuerying}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-xs font-mono text-cyan-300 font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{testQuerying ? 'Querying...' : 'Simulate Client Query'}</span>
          </button>

          <button
            onClick={onNavigateToSettings}
            className="text-xs font-mono text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>NTP Settings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Test Result Box if tested */}
        {testQueryResult && (
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs space-y-2">
            <div className="flex items-center justify-between text-cyan-400 text-[10px] pb-1 border-b border-slate-800">
              <span>TEST QUERY RESULT</span>
              <span className={testQueryResult.enabled !== false ? 'text-emerald-400' : 'text-rose-400'}>
                {testQueryResult.enabled !== false ? `200 OK · STRATUM ${testQueryResult.stratum}` : '503 SERVICE DEACTIVATED'}
              </span>
            </div>
            {testQueryResult.enabled === false ? (
              <div className="text-rose-400">{testQueryResult.error}</div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                <div>Ref ID: <span className="text-white font-bold">{testQueryResult.refId}</span></div>
                <div>Timestamp: <span className="text-white">{testQueryResult.timestamp?.slice(11, 23)} UTC</span></div>
                <div>Precision: <span>2^-20 s (~0.95 µs)</span></div>
                <div>Leap Indicator: <span className="text-emerald-400">00 (Nominal)</span></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card 2: Phone as BLE CTS Server */}
      <div
        className={`rounded-3xl border transition-all p-6 shadow-sm space-y-5 ${
          bleConfig.enabled
            ? 'bg-slate-900 border-blue-500/40 shadow-blue-950/20'
            : 'bg-slate-900/60 border-slate-800 opacity-85'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                bleConfig.enabled
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              <Bluetooth className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">
                BLE Current Time Service (0x1805)
              </h3>
              <div className="flex items-center gap-2 text-xs font-mono mt-0.5">
                <span
                  className={`font-semibold flex items-center gap-1 ${
                    bleConfig.enabled ? 'text-blue-400' : 'text-slate-400'
                  }`}
                >
                  {bleConfig.enabled ? '● Advertising Active' : '○ Stopped (Not Advertising)'}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">UUID 0x1805</span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">{bleConfig.deviceName}</span>
              </div>
            </div>
          </div>

          {/* Material 3 Switch */}
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={bleConfig.enabled}
              onChange={(e) => {
                onToggleBleCtsServer(e.target.checked);
                if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(20);
              }}
              className="sr-only peer"
            />
            <div className="w-14 h-8 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-slate-400 after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-500 peer-checked:after:bg-slate-950"></div>
          </label>
        </div>

        <p className="text-xs text-slate-400">
          {bleConfig.enabled
            ? 'Broadcasting standard Bluetooth SIG Current Time Service. Nearby smartwatches, fitness bands, and IoT devices can connect and synchronize.'
            : 'Bluetooth advertising is stopped. The phone is not discoverable as a CTS time source.'}
        </p>

        {/* Live CTS Frame Decoded */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 font-mono text-xs space-y-2">
          <div className="flex items-center justify-between text-blue-400 text-[10px] pb-1 border-b border-slate-800/80">
            <span>LIVE GATT BROADCAST FRAME (0x2A2B)</span>
            <span>Cadence: {bleConfig.advIntervalMs} ms</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-300">
            <div>Device: <span className="text-white font-bold">{bleConfig.deviceName}</span></div>
            <div>Time Zone: <span className="text-white">{tzDetails.quarterHours} quarters</span></div>
            <div>Subscribers: <span className="text-emerald-400 font-bold">{bleConfig.activeSubscribers} clients</span></div>
          </div>

          {bleConfig.lastPacket && (
            <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/80 font-mono">
              Wire Hex: <span className="text-cyan-400">{bleConfig.lastPacket.hex}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-mono text-slate-500">
            GATT Characteristics: 0x2A2B (Current Time), 0x2A0F (Local Time Info)
          </span>

          <button
            onClick={onNavigateToSettings}
            className="text-xs font-mono text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>CTS Settings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
