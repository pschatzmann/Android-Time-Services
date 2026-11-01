/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Smartphone,
  Wifi,
  BatteryCharging,
  Maximize2,
  Minimize2,
  Download,
  CheckCircle,
  HelpCircle,
  Share2,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface AndroidFrameProps {
  children: React.ReactNode;
  timeString: string;
}

export const AndroidFrame: React.FC<AndroidFrameProps> = ({ children, timeString }) => {
  const [deviceFrameEnabled, setDeviceFrameEnabled] = useState(false);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  return (
    <div className="relative min-h-screen bg-slate-950 flex flex-col items-center justify-start">
      {/* Top Android Frame / PWA Toolbar */}
      <div className="w-full bg-slate-900 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between text-xs font-mono text-slate-300 gap-3">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
            <Smartphone className="w-4 h-4" />
            <span>Android PWA Runtime</span>
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400">Target: Android 14+ / AOSP</span>
        </div>

        <div className="flex items-center gap-2">
          {/* PWA In-App Install Button as mandated by pwa-integration skill */}
          {isInstallable && (
            <button
              onClick={install}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors font-semibold cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install Android App (APK/PWA)</span>
            </button>
          )}

          {isInstalled && (
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Installed on Android System</span>
            </span>
          )}

          {!isInstallable && !isInstalled && (
            <button
              onClick={() => setShowInstallHelp(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-slate-400 hover:text-slate-200 border border-slate-700 rounded-md transition-colors cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Install Guide</span>
            </button>
          )}

          {/* Device Mockup Toggle */}
          <button
            onClick={() => setDeviceFrameEnabled(!deviceFrameEnabled)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors cursor-pointer ${
              deviceFrameEnabled
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-semibold'
                : 'border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {deviceFrameEnabled ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">
              {deviceFrameEnabled ? 'Full Display Mode' : 'Android Pixel Viewport'}
            </span>
          </button>
        </div>
      </div>

      {/* Install Help Modal */}
      {showInstallHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-200 shadow-2xl space-y-4 font-sans">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-cyan-400" />
              <span>Installing Chronos on Android</span>
            </h3>
            <p className="text-sm text-slate-300">
              This application is packaged with an installable Web App Manifest and service worker that runs as a standalone native app on Android.
            </p>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono space-y-2 text-slate-300">
              <div className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">1.</span>
                <span>Open in Chrome or your Android web browser.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">2.</span>
                <span>Tap the three-dot menu <strong className="text-white">(⋮)</strong> in the top right.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">3.</span>
                <span>Tap <strong className="text-white">"Install app"</strong> or <strong className="text-white">"Add to Home screen"</strong>.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">4.</span>
                <span>Launch Chronos from your Android app drawer with full hardware BLE & GPS capabilities!</span>
              </div>
            </div>
            <button
              onClick={() => setShowInstallHelp(false)}
              className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold text-sm transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Frame Container */}
      <div
        className={`w-full transition-all duration-300 ${
          deviceFrameEnabled
            ? 'max-w-[420px] my-6 rounded-[48px] border-[10px] border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden bg-slate-950 relative'
            : 'max-w-full'
        }`}
      >
        {/* Android Simulated Status Bar when inside device frame */}
        {deviceFrameEnabled && (
          <div className="h-9 px-6 bg-slate-950 flex items-center justify-between text-slate-400 text-xs font-mono select-none border-b border-slate-800/40">
            <span className="font-bold text-white text-xs">{timeString.slice(0, 5)}</span>
            <div className="w-4 h-4 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/80"></div>
            </div>
            <div className="flex items-center gap-2">
              <Wifi className="w-3.5 h-3.5 text-slate-300" />
              <span className="text-[10px] font-bold">5G</span>
              <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>
        )}

        {/* Content App */}
        <div className="w-full">{children}</div>

        {/* Android Bottom Navigation Bar when in device mockup */}
        {deviceFrameEnabled && (
          <div className="h-10 bg-slate-950 border-t border-slate-800/60 flex items-center justify-around text-slate-500 select-none">
            <div className="w-3.5 h-3.5 border-2 border-slate-600 rotate-45"></div>
            <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-600"></div>
            <div className="w-3.5 h-3.5 border-2 border-slate-600"></div>
          </div>
        )}
      </div>
    </div>
  );
};
