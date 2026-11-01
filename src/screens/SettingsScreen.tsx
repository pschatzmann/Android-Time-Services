/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Sliders,
  Radio,
  Bluetooth,
  Shield,
  Save,
  RotateCcw,
  Download,
  Check,
  FileCode,
  Copy,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { SystemTimeConfig } from '../types/chronos';

interface SettingsScreenProps {
  config: SystemTimeConfig;
  onSaveConfig: (newConfig: SystemTimeConfig) => Promise<void>;
  onResetDefaults: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  config,
  onSaveConfig,
  onResetDefaults,
}) => {
  const [localConfig, setLocalConfig] = useState<SystemTimeConfig>(() =>
    JSON.parse(JSON.stringify(config))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveConfig(localConfig);
      setSavedSuccess(true);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(30);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(localConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chronos-settings-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-24 animate-fadeIn">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            App Settings & Parameters
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Configure time servers, CTS publishing, disciplining algorithms, and network access.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
        >
          {savedSuccess ? (
            <>
              <Check className="w-4 h-4" />
              <span>Saved!</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </>
          )}
        </button>
      </div>

      {/* Section 1: Phone NTP Server Activation & Settings */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">Phone NTP Server (RFC 5905)</h3>
              <p className="text-xs text-slate-400">Configure device as a network time provider</p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={localConfig.ntpServer.enabled}
              onChange={(e) =>
                setLocalConfig((prev) => ({
                  ...prev,
                  ntpServer: { ...prev.ntpServer, enabled: e.target.checked },
                }))
              }
              className="sr-only peer"
            />
            <div className="w-12 h-7 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-slate-400 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500 peer-checked:after:bg-slate-950"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div>
            <label className="text-slate-400 block mb-1.5">Broadcast Stratum</label>
            <select
              value={localConfig.ntpServer.stratum}
              onChange={(e) =>
                setLocalConfig((prev) => ({
                  ...prev,
                  ntpServer: { ...prev.ntpServer, stratum: parseInt(e.target.value, 10) },
                }))
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
            >
              <option value={1}>Stratum 1 (Primary Reference)</option>
              <option value={2}>Stratum 2 (Secondary Peer)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1.5">Reference ID (4 Chars)</label>
            <input
              type="text"
              maxLength={4}
              value={localConfig.ntpServer.refId}
              onChange={(e) =>
                setLocalConfig((prev) => ({
                  ...prev,
                  ntpServer: { ...prev.ntpServer, refId: e.target.value.toUpperCase() },
                }))
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1.5">Leap Indicator</label>
            <select
              value={localConfig.ntpServer.leapIndicator}
              onChange={(e) =>
                setLocalConfig((prev) => ({
                  ...prev,
                  ntpServer: { ...prev.ntpServer, leapIndicator: parseInt(e.target.value, 10) },
                }))
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
            >
              <option value={0}>00 - No Warning (Nominal)</option>
              <option value={1}>01 - +1s Positive Leap Second</option>
              <option value={2}>10 - -1s Negative Leap Second</option>
              <option value={3}>11 - Clock Unsynchronized</option>
            </select>
          </div>
        </div>
      </div>

      {/* Section 2: Phone BLE CTS Server Activation & Settings */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Bluetooth className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">Phone BLE CTS Server (0x1805)</h3>
              <p className="text-xs text-slate-400">Broadcast Bluetooth Current Time Service</p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={localConfig.bleCtsServer.enabled}
              onChange={(e) =>
                setLocalConfig((prev) => ({
                  ...prev,
                  bleCtsServer: { ...prev.bleCtsServer, enabled: e.target.checked },
                }))
              }
              className="sr-only peer"
            />
            <div className="w-12 h-7 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-slate-400 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500 peer-checked:after:bg-slate-950"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <label className="text-slate-400 block mb-1.5">Advertised Device Name</label>
            <input
              type="text"
              value={localConfig.bleCtsServer.deviceName}
              onChange={(e) =>
                setLocalConfig((prev) => ({
                  ...prev,
                  bleCtsServer: { ...prev.bleCtsServer, deviceName: e.target.value },
                }))
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1.5">Advertising Interval (ms)</label>
            <input
              type="number"
              value={localConfig.bleCtsServer.advIntervalMs}
              onChange={(e) =>
                setLocalConfig((prev) => ({
                  ...prev,
                  bleCtsServer: {
                    ...prev.bleCtsServer,
                    advIntervalMs: parseInt(e.target.value, 10) || 1000,
                  },
                }))
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-right"
            />
          </div>
        </div>
      </div>

      {/* Section 3: Clock Disciplining (PLL / FLL / Kalman) */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-800/80 pb-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-base">Clock Disciplining & Loop Filter</h3>
            <p className="text-xs text-slate-400">Mathematical fusion parameters</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
          <label className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-start gap-2.5 cursor-pointer">
            <input
              type="radio"
              name="algo"
              checked={localConfig.disciplining.algorithm === 'kalman'}
              onChange={() =>
                setLocalConfig((prev) => ({
                  ...prev,
                  disciplining: { ...prev.disciplining, algorithm: 'kalman' },
                }))
              }
              className="mt-0.5 accent-cyan-500"
            />
            <div>
              <div className="font-bold text-white">Kalman Filter</div>
              <div className="text-[10px] text-slate-400 font-sans mt-0.5">Optimal state estimator</div>
            </div>
          </label>

          <label className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-start gap-2.5 cursor-pointer">
            <input
              type="radio"
              name="algo"
              checked={localConfig.disciplining.algorithm === 'marzullo'}
              onChange={() =>
                setLocalConfig((prev) => ({
                  ...prev,
                  disciplining: { ...prev.disciplining, algorithm: 'marzullo' },
                }))
              }
              className="mt-0.5 accent-cyan-500"
            />
            <div>
              <div className="font-bold text-white">Marzullo Intersection</div>
              <div className="text-[10px] text-slate-400 font-sans mt-0.5">Strict interval overlap</div>
            </div>
          </label>

          <label className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-start gap-2.5 cursor-pointer">
            <input
              type="radio"
              name="algo"
              checked={localConfig.disciplining.algorithm === 'pll_fll'}
              onChange={() =>
                setLocalConfig((prev) => ({
                  ...prev,
                  disciplining: { ...prev.disciplining, algorithm: 'pll_fll' },
                }))
              }
              className="mt-0.5 accent-cyan-500"
            />
            <div>
              <div className="font-bold text-white">Dual PLL / FLL</div>
              <div className="text-[10px] text-slate-400 font-sans mt-0.5">Phase & frequency loop</div>
            </div>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <label className="text-slate-400 block mb-1">PLL Time Constant τ (seconds)</label>
            <input
              type="number"
              value={localConfig.disciplining.pllTimeConstantSec}
              onChange={(e) =>
                setLocalConfig((prev) => ({
                  ...prev,
                  disciplining: {
                    ...prev.disciplining,
                    pllTimeConstantSec: parseInt(e.target.value, 10) || 16,
                  },
                }))
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Max Slew Rate (ppm)</label>
            <input
              type="number"
              value={localConfig.disciplining.maxSlewPpm}
              onChange={(e) =>
                setLocalConfig((prev) => ({
                  ...prev,
                  disciplining: {
                    ...prev.disciplining,
                    maxSlewPpm: parseInt(e.target.value, 10) || 500,
                  },
                }))
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
            />
          </div>
        </div>
      </div>

      {/* Section 4: Network Access Control */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-800/80 pb-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-base">Network Access Control</h3>
            <p className="text-xs text-slate-400">Subnet allowlist and rate limiting</p>
          </div>
        </div>

        <div className="space-y-3 text-xs font-mono">
          <div>
            <label className="text-slate-400 block mb-1">Allowed Subnets (CIDR)</label>
            <input
              type="text"
              value={localConfig.ntpServer.allowSubnets.join(', ')}
              onChange={(e) =>
                setLocalConfig((prev) => ({
                  ...prev,
                  ntpServer: {
                    ...prev.ntpServer,
                    allowSubnets: e.target.value.split(',').map((x) => x.trim()),
                  },
                }))
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              e.g. 0.0.0.0/0 for unrestricted or 192.168.1.0/24
            </span>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Rate Limit per Client (queries/min)</label>
            <input
              type="number"
              value={localConfig.ntpServer.rateLimitPerMin}
              onChange={(e) =>
                setLocalConfig((prev) => ({
                  ...prev,
                  ntpServer: {
                    ...prev.ntpServer,
                    rateLimitPerMin: parseInt(e.target.value, 10) || 120,
                  },
                }))
              }
              className="w-36 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-right"
            />
          </div>
        </div>
      </div>

      {/* Section 5: Backup & Reset */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 rounded-3xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Config JSON</span>
          </button>
          <button
            onClick={onResetDefaults}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
        >
          {savedSuccess ? 'Changes Applied!' : 'Save & Apply Settings'}
        </button>
      </div>
    </div>
  );
};
