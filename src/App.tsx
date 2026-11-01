/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { MaterialNavigation, ScreenId } from './components/MaterialNavigation';
import { AndroidFrame } from './components/AndroidFrame';
import { ClockScreen } from './screens/ClockScreen';
import { PublishScreen } from './screens/PublishScreen';
import { SourcesScreen } from './screens/SourcesScreen';
import { MetricsScreen } from './screens/MetricsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TimeStatusResponse, SystemTimeConfig, TelemetryPoint } from './types/chronos';
import { calculateTimeZoneDetails } from './utils/timeZoneEngine';

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeScreen, setActiveScreen] = useState<ScreenId>('clock');
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedTimezone, setSelectedTimezone] = useState<string>('AUTO');

  // Time & System state
  const [timeStatus, setTimeStatus] = useState<TimeStatusResponse | null>(null);
  const [config, setConfig] = useState<SystemTimeConfig | null>(null);
  const [history, setHistory] = useState<TelemetryPoint[]>([]);

  // Apply dark class to documentElement
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Fetch initial config
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (e) {
      console.warn('Failed to fetch config from backend, using default models', e);
    }
  }, []);

  // Poll status loop
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/time/status');
      if (res.ok) {
        const data: TimeStatusResponse = await res.json();
        setTimeStatus(data);

        // Append to time-series history for telemetry metrics
        const now = new Date();
        const timeStr = now.toTimeString().slice(0, 8);
        const point: TelemetryPoint = {
          timeStr,
          timestamp: now.getTime(),
          offsetAtomicUs: -0.12 + (Math.random() - 0.5) * 0.04,
          offsetGpsUs: 0.28 + (Math.random() - 0.5) * 0.08,
          offsetNtpMs: -0.14 + (Math.random() - 0.5) * 0.05,
          offsetBleMs: 1.18 + (Math.random() - 0.5) * 0.2,
          disciplinedOffsetNs: data.disciplining?.offsetNs ?? 84,
          driftPpb: data.disciplining?.driftPpb ?? 1.42,
          ntpLatencyMs: 14.82 + (Math.random() - 0.5) * 1.5,
          bleLatencyMs: 28.5 + (Math.random() - 0.5) * 3,
        };

        setHistory((prev) => [...prev.slice(-119), point]);
      }
    } catch (e) {
      console.warn('Failed to poll status', e);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    pollStatus();
    const interval = setInterval(pollStatus, 1500);
    return () => clearInterval(interval);
  }, [fetchConfig, pollStatus]);

  // Force re-discipline action
  const handleForceSync = async () => {
    setIsSyncing(true);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([30, 50, 30]);
    }
    try {
      await fetch('/api/time/status');
      setTimeout(() => {
        setIsSyncing(false);
      }, 1000);
    } catch (e) {
      setIsSyncing(false);
    }
  };

  // Toggle individual source
  const handleToggleSource = async (id: string, enabled: boolean) => {
    if (!config) return;
    const updatedSources = config.sources.map((s) =>
      s.id === id ? { ...s, enabled } : s
    );
    const newConfig = { ...config, sources: updatedSources };
    setConfig(newConfig);
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Update source weight
  const handleUpdateWeight = async (id: string, weight: number) => {
    if (!config) return;
    const updatedSources = config.sources.map((s) =>
      s.id === id ? { ...s, weight } : s
    );
    const newConfig = { ...config, sources: updatedSources };
    setConfig(newConfig);
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle phone as NTP server
  const handleToggleNtpServer = async (enabled: boolean) => {
    if (!config) return;
    const newConfig = {
      ...config,
      ntpServer: { ...config.ntpServer, enabled },
    };
    setConfig(newConfig);
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle phone as BLE CTS server
  const handleToggleBleCtsServer = async (enabled: boolean) => {
    if (!config) return;
    const newConfig = {
      ...config,
      bleCtsServer: { ...config.bleCtsServer, enabled },
    };
    setConfig(newConfig);
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Save new configuration from settings screen
  const handleSaveConfig = async (newConfig: SystemTimeConfig) => {
    setConfig(newConfig);
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    });
  };

  // Reset defaults
  const handleResetDefaults = async () => {
    await fetchConfig();
  };

  const tzDetails = calculateTimeZoneDetails(new Date(), selectedTimezone);
  const currentOffsetNs = timeStatus?.disciplining?.offsetNs ?? 84;
  const currentDriftPpb = timeStatus?.disciplining?.driftPpb ?? 1.42;

  return (
    <AndroidFrame timeString={timeStatus?.systemTimeUtc?.slice(11, 19) || '12:00:00'}>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans transition-colors antialiased selection:bg-cyan-500/30">
        {/* Material Design 3 Top App Bar */}
        <MaterialNavigation
          activeScreen={activeScreen}
          onSelectScreen={setActiveScreen}
          onForceSync={handleForceSync}
          isSyncing={isSyncing}
          theme={theme}
          toggleTheme={toggleTheme}
          activeStratum={timeStatus?.disciplining?.activeStratum ?? 1}
          lockedRefId={timeStatus?.disciplining?.lockedRefId ?? 'GPS'}
          offsetNs={currentOffsetNs}
        />

        {/* Active Material Screen Content */}
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 pb-28">
          {activeScreen === 'clock' && (
            <ClockScreen
              clockStatus={timeStatus?.disciplining}
              leapSecondsTai={timeStatus?.leapSecondsTai ?? 37}
              leapSecondsGps={timeStatus?.leapSecondsGps ?? 18}
              selectedTimezone={selectedTimezone}
              onSelectTimezone={setSelectedTimezone}
            />
          )}

          {activeScreen === 'publish' && config && (
            <PublishScreen
              ntpConfig={{
                ...config.ntpServer,
                packetsServed: timeStatus?.servers?.ntp?.packetsServed || 14850,
                bandwidthKbps: timeStatus?.servers?.ntp?.bandwidthKbps || 0.84,
              }}
              bleConfig={{
                ...config.bleCtsServer,
                activeSubscribers: timeStatus?.servers?.bleCts?.activeSubscribers || 3,
                lastPacket: timeStatus?.servers?.bleCts?.lastPacket,
              }}
              tzDetails={tzDetails}
              onToggleNtpServer={handleToggleNtpServer}
              onToggleBleCtsServer={handleToggleBleCtsServer}
              onNavigateToSettings={() => setActiveScreen('settings')}
            />
          )}

          {activeScreen === 'sources' && config && (
            <SourcesScreen
              sources={config.sources}
              onToggleSource={handleToggleSource}
              onUpdateWeight={handleUpdateWeight}
            />
          )}

          {activeScreen === 'metrics' && (
            <MetricsScreen
              history={history}
              sources={config?.sources || []}
              currentOffsetNs={currentOffsetNs}
              currentDriftPpb={currentDriftPpb}
            />
          )}

          {activeScreen === 'settings' && config && (
            <SettingsScreen
              config={config}
              onSaveConfig={handleSaveConfig}
              onResetDefaults={handleResetDefaults}
            />
          )}
        </main>
      </div>
    </AndroidFrame>
  );
}
