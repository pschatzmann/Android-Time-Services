/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Sliders,
  Radio,
  Bluetooth,
  Satellite,
  Atom,
  Shield,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Download,
  Check,
  TrendingDown,
  FileCode,
  Copy,
  Layers,
  Activity,
} from 'lucide-react';
import { SystemTimeConfig, SourceConfig } from '../types/chronos';
import { calculateAllanDeviationCurve } from '../utils/clockMath';

interface ConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  config: SystemTimeConfig;
  onSaveConfig: (newConfig: SystemTimeConfig) => Promise<void>;
  onResetDefaults: () => void;
  initialTab?: 'sources' | 'disciplining' | 'ntp_publisher' | 'ble_publisher' | 'stability' | 'clients' | 'firmware';
}

export const ConfigDialog: React.FC<ConfigDialogProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onResetDefaults,
  initialTab = 'sources',
}) => {
  const [localConfig, setLocalConfig] = useState<SystemTimeConfig>(() => JSON.parse(JSON.stringify(config)));
  const [activeTab, setActiveTab] = useState<'sources' | 'disciplining' | 'ntp_publisher' | 'ble_publisher' | 'stability' | 'clients' | 'firmware'>(initialTab);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [newNtpHost, setNewNtpHost] = useState('');
  const [allanDevPoints] = useState(() => calculateAllanDeviationCurve());
  const [activeFirmwareTab, setActiveFirmwareTab] = useState<'android' | 'arduino' | 'chrony'>('android');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveConfig(localConfig);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNtpServer = () => {
    if (!newNtpHost.trim()) return;
    const newSrc: SourceConfig = {
      id: `src_ntp_${Date.now()}`,
      name: newNtpHost.trim(),
      type: 'ntp',
      enabled: true,
      stratum: 1,
      weight: 0.1,
      pollIntervalSec: 16,
      hostOrPort: newNtpHost.trim(),
    };
    setLocalConfig((prev) => ({
      ...prev,
      sources: [...prev.sources, newSrc],
    }));
    setNewNtpHost('');
  };

  const handleRemoveSource = (id: string) => {
    setLocalConfig((prev) => ({
      ...prev,
      sources: prev.sources.filter((s) => s.id !== id),
    }));
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(localConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chronos-gateway-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const androidCode = `// Android Kotlin ChronosTimeService.kt (Android 14+ / AOSP)
package com.chronos.timesync

import android.app.Service
import android.bluetooth.*
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.content.Intent
import android.os.IBinder
import android.os.ParcelUuid
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.time.ZonedDateTime
import java.util.UUID

class ChronosTimeService : Service() {
    private val CTS_SERVICE_UUID = UUID.fromString("00001805-0000-1000-8000-00805f9b34fb")
    private val CURRENT_TIME_CHAR_UUID = UUID.fromString("00002a2b-0000-1000-8000-00805f9b34fb")
    private var gattServer: BluetoothGattServer? = null
    private var advertiser: BluetoothLeAdvertiser? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        val bluetoothManager = getSystemService(BLUETOOTH_SERVICE) as BluetoothManager
        val adapter = bluetoothManager.adapter
        if (adapter != null && adapter.isEnabled) {
            setupGattServer(bluetoothManager)
            startAdvertising(adapter)
        }
    }

    private fun setupGattServer(manager: BluetoothManager) {
        val service = BluetoothGattService(CTS_SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY)
        val timeChar = BluetoothGattCharacteristic(
            CURRENT_TIME_CHAR_UUID,
            BluetoothGattCharacteristic.PROPERTY_READ or BluetoothGattCharacteristic.PROPERTY_NOTIFY,
            BluetoothGattCharacteristic.PERMISSION_READ
        )
        service.addCharacteristic(timeChar)
        gattServer = manager.openGattServer(this, object : BluetoothGattServerCallback() {
            override fun onCharacteristicReadRequest(device: BluetoothDevice, requestId: Int, offset: Int, char: BluetoothGattCharacteristic) {
                if (char.uuid == CURRENT_TIME_CHAR_UUID) {
                    val buf = ByteBuffer.allocate(10).order(ByteOrder.LITTLE_ENDIAN)
                    val now = ZonedDateTime.now()
                    buf.putShort(now.year.toShort())
                    buf.put(now.monthValue.toByte())
                    buf.put(now.dayOfMonth.toByte())
                    buf.put(now.hour.toByte())
                    buf.put(now.minute.toByte())
                    buf.put(now.second.toByte())
                    buf.put(now.dayOfWeek.value.toByte())
                    buf.put(((now.nano / 1_000_000_000.0) * 256).toInt().toByte())
                    buf.put(0x02)
                    gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, buf.array())
                }
            }
        })
        gattServer?.addService(service)
    }

    private fun startAdvertising(adapter: BluetoothAdapter) {
        advertiser = adapter.bluetoothLeAdvertiser
        val settings = AdvertiseSettings.Builder().setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_BALANCED).setConnectable(true).build()
        val data = AdvertiseData.Builder().setIncludeDeviceName(true).addServiceUuid(ParcelUuid(CTS_SERVICE_UUID)).build()
        advertiser?.startAdvertising(settings, data, object : AdvertiseCallback() {})
    }

    override fun onDestroy() {
        super.onDestroy()
        advertiser?.stopAdvertising(object : AdvertiseCallback() {})
        gattServer?.close()
    }
}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Top Bar */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                System Configuration & Publishing Controls
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure upstream time sources, disciplining algorithms, NTP server daemon, BLE CTS advertiser, and client access
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1 overflow-x-auto text-xs font-mono bg-slate-50/50 dark:bg-slate-950/30">
          <button
            onClick={() => setActiveTab('sources')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'sources'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Time Sources & Hardware
          </button>
          <button
            onClick={() => setActiveTab('disciplining')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'disciplining'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Disciplining (PLL/FLL)
          </button>
          <button
            onClick={() => setActiveTab('ntp_publisher')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'ntp_publisher'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Phone NTP Server
          </button>
          <button
            onClick={() => setActiveTab('ble_publisher')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'ble_publisher'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Phone BLE CTS Server
          </button>
          <button
            onClick={() => setActiveTab('stability')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'stability'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Allan Deviation & Stability
          </button>
          <button
            onClick={() => setActiveTab('clients')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'clients'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Client Access Control
          </button>
          <button
            onClick={() => setActiveTab('firmware')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'firmware'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Firmware / Android Export
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs font-mono">
          {/* TAB 1: Sources */}
          {activeTab === 'sources' && (
            <div className="space-y-5">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-2">
                  Upstream Reference Peers
                </h4>
                <div className="space-y-2">
                  {localConfig.sources.map((s) => (
                    <div
                      key={s.id}
                      className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{s.name}</span>
                        <span className="text-slate-400">({s.type})</span>
                        <span className="text-cyan-600 dark:text-cyan-400">Stratum {s.stratum}</span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">Poll:</span>
                          <input
                            type="number"
                            value={s.pollIntervalSec}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 16;
                              setLocalConfig((prev) => ({
                                ...prev,
                                sources: prev.sources.map((item) =>
                                  item.id === s.id ? { ...item, pollIntervalSec: val } : item
                                ),
                              }));
                            }}
                            className="w-16 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-right"
                          />
                          <span className="text-slate-400">s</span>
                        </div>

                        {s.type === 'ntp' && (
                          <button
                            onClick={() => handleRemoveSource(s.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add New NTP Server */}
              <div className="p-4 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 space-y-3">
                <div className="font-semibold text-slate-800 dark:text-slate-200">Add Custom NTP Time Server</div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newNtpHost}
                    onChange={(e) => setNewNtpHost(e.target.value)}
                    placeholder="e.g. pool.ntp.org or 192.168.1.100"
                    className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  />
                  <button
                    onClick={handleAddNtpServer}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 font-bold"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Server</span>
                  </button>
                </div>
              </div>

              {/* GPS PPS Hardware Calibration */}
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  GNSS PPS Hardware & Cable Delay Calibration
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Serial Baud Rate</label>
                    <select
                      defaultValue="115200"
                      className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                    >
                      <option value="9600">9600 baud</option>
                      <option value="38400">38400 baud</option>
                      <option value="115200">115200 baud</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">PPS Edge Trigger</label>
                    <select
                      defaultValue="rising"
                      className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                    >
                      <option value="rising">Rising Edge (Active High)</option>
                      <option value="falling">Falling Edge (Active Low)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Antenna Cable Delay</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        defaultValue="25"
                        className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-right"
                      />
                      <span className="text-slate-400">ns</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Disciplining Engine */}
          {activeTab === 'disciplining' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  Filter Fusion Algorithm
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer flex items-start gap-2.5">
                    <input
                      type="radio"
                      name="algorithm"
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
                      <div className="font-bold text-slate-800 dark:text-slate-100">Kalman Filter</div>
                      <div className="text-[10px] text-slate-400 font-sans mt-0.5">Optimal state estimation combining short-term and long-term noise profiles</div>
                    </div>
                  </label>

                  <label className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer flex items-start gap-2.5">
                    <input
                      type="radio"
                      name="algorithm"
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
                      <div className="font-bold text-slate-800 dark:text-slate-100">Marzullo Intersection</div>
                      <div className="text-[10px] text-slate-400 font-sans mt-0.5">Strict interval intersection with falseticker rejection</div>
                    </div>
                  </label>

                  <label className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer flex items-start gap-2.5">
                    <input
                      type="radio"
                      name="algorithm"
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
                      <div className="font-bold text-slate-800 dark:text-slate-100">Classic PLL / FLL</div>
                      <div className="text-[10px] text-slate-400 font-sans mt-0.5">Dual-loop phase-locked and frequency-locked oscillator loop</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <label className="font-semibold text-slate-800 dark:text-slate-200 block">
                    PLL Time Constant τ
                  </label>
                  <div className="flex items-center gap-2">
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
                      className="w-full px-3 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                    />
                    <span className="text-slate-400">seconds</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-sans">
                    Higher values filter out high-frequency network jitter but respond more slowly to clock drift.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <label className="font-semibold text-slate-800 dark:text-slate-200 block">
                    Max Clock Slew Rate
                  </label>
                  <div className="flex items-center gap-2">
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
                      className="w-full px-3 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                    />
                    <span className="text-slate-400">ppm</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-sans">
                    Controls maximum slewing rate (500 ppm standard) to prevent time stepping backwards on local system.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: NTP Publisher */}
          {activeTab === 'ntp_publisher' && (
            <div className="space-y-4">
              {/* Phone NTP Server Activation Master Toggle */}
              <div className={`p-4 rounded-xl border transition-all ${
                localConfig.ntpServer.enabled
                  ? 'bg-cyan-50/50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800/60'
                  : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800'
              }`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        Phone / Device NTP Server Mode
                      </span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        localConfig.ntpServer.enabled
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {localConfig.ntpServer.enabled ? 'ACTIVE (SERVING)' : 'DEACTIVATED (OFFLINE)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                      Enable or disable running an RFC 5905 NTP server daemon on this phone to serve precision time packets to LAN and Wi-Fi clients.
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
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
                    <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600 dark:peer-checked:bg-cyan-500"></div>
                  </label>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  NTP Daemon Broadcast Settings
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Advertised Stratum</label>
                    <select
                      disabled={!localConfig.ntpServer.enabled}
                      value={localConfig.ntpServer.stratum}
                      onChange={(e) =>
                        setLocalConfig((prev) => ({
                          ...prev,
                          ntpServer: { ...prev.ntpServer, stratum: parseInt(e.target.value, 10) },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 disabled:opacity-50"
                    >
                      <option value={1}>Stratum 1 (Primary Reference)</option>
                      <option value={2}>Stratum 2 (Secondary Peer)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Reference ID String</label>
                    <input
                      type="text"
                      maxLength={4}
                      disabled={!localConfig.ntpServer.enabled}
                      value={localConfig.ntpServer.refId}
                      onChange={(e) =>
                        setLocalConfig((prev) => ({
                          ...prev,
                          ntpServer: { ...prev.ntpServer, refId: e.target.value.toUpperCase() },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Leap Indicator (LI)</label>
                    <select
                      disabled={!localConfig.ntpServer.enabled}
                      value={localConfig.ntpServer.leapIndicator}
                      onChange={(e) =>
                        setLocalConfig((prev) => ({
                          ...prev,
                          ntpServer: { ...prev.ntpServer, leapIndicator: parseInt(e.target.value, 10) },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 disabled:opacity-50"
                    >
                      <option value={0}>00 - No Warning (Nominal)</option>
                      <option value={1}>01 - Positive Leap Second (+1s pending)</option>
                      <option value={2}>10 - Negative Leap Second (-1s pending)</option>
                      <option value={3}>11 - Clock Unsynchronized</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BLE Publisher */}
          {activeTab === 'ble_publisher' && (
            <div className="space-y-4">
              {/* Phone BLE CTS Server Activation Master Toggle */}
              <div className={`p-4 rounded-xl border transition-all ${
                localConfig.bleCtsServer.enabled
                  ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/60'
                  : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800'
              }`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        Phone / Device BLE CTS Server Mode
                      </span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        localConfig.bleCtsServer.enabled
                          ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {localConfig.bleCtsServer.enabled ? 'ACTIVE (ADVERTISING)' : 'DEACTIVATED (STOPPED)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                      Enable or disable Bluetooth Low Energy advertising of the standard Current Time Service (0x1805) to sync nearby smartwatches, IoT nodes, and BLE clients.
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
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
                    <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
                  </label>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  Bluetooth LE Current Time Service Advertising
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">GATT Advertised Device Name</label>
                    <input
                      type="text"
                      disabled={!localConfig.bleCtsServer.enabled}
                      value={localConfig.bleCtsServer.deviceName}
                      onChange={(e) =>
                        setLocalConfig((prev) => ({
                          ...prev,
                          bleCtsServer: { ...prev.bleCtsServer, deviceName: e.target.value },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Advertising Cadence</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        disabled={!localConfig.bleCtsServer.enabled}
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
                        className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-right disabled:opacity-50"
                      />
                      <span className="text-slate-400">ms</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Stability & Allan Deviation */}
          {activeTab === 'stability' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-purple-500" />
                  <span>Oscillator Frequency Stability & Allan Deviation σy(τ) Analysis</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                  Allan deviation characterizes the fractional frequency instability over observation intervals τ. The disciplined clock leverages the short-term stability of the local crystal alongside the long-term drift-free accuracy of CSAC and GPS 1PPS.
                </p>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-500">
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase">
                      <th className="py-2.5 px-3">Interval τ</th>
                      <th className="py-2.5 px-3">Disciplined Output</th>
                      <th className="py-2.5 px-3">CSAC Atomic Physics</th>
                      <th className="py-2.5 px-3">Quartz OCXO Reference</th>
                      <th className="py-2.5 px-3">Raw NTP Network</th>
                      <th className="py-2.5 px-3">Noise Mechanism</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 tabular-nums">
                    {allanDevPoints.map((pt) => {
                      const noiseRegime =
                        pt.tauSec <= 4
                          ? 'White Phase Noise (1/τ)'
                          : pt.tauSec <= 64
                          ? 'White Frequency Noise (1/√τ)'
                          : 'Flicker Frequency Floor';

                      return (
                        <tr key={pt.tauSec} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">τ = {pt.tauLabel}</td>
                          <td className="py-2.5 px-3 text-cyan-600 dark:text-cyan-400 font-bold">{pt.disciplinedSigma.toExponential(2)}</td>
                          <td className="py-2.5 px-3 text-purple-600 dark:text-purple-400">{pt.csacSigma.toExponential(2)}</td>
                          <td className="py-2.5 px-3 text-amber-600 dark:text-amber-400">{pt.quartzOcxoSigma.toExponential(2)}</td>
                          <td className="py-2.5 px-3 text-slate-500">{pt.ntpNetworkSigma.toExponential(2)}</td>
                          <td className="py-2.5 px-3 text-slate-500 font-sans text-[11px]">{noiseRegime}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: Client Access */}
          {activeTab === 'clients' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  Client Subnet Allowlist & Rate Limits
                </div>
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
                    className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Use 0.0.0.0/0 for unrestricted LAN or specify trusted network CIDR (e.g. 192.168.1.0/24)
                  </span>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Rate Limit per Client</label>
                  <div className="flex items-center gap-2">
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
                      className="w-32 px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-right"
                    />
                    <span className="text-slate-400">queries / minute (KoD rate response on exceed)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: Firmware / Android Export */}
          {activeTab === 'firmware' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-cyan-500" />
                  <span>Hardware Firmware & Android Service Export</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                  Ready-to-flash reference implementations for native Android service, ESP32 Arduino C++ firmware, and Linux Chrony Stratum-1 server configurations.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-mono">
                  <button
                    onClick={() => setActiveFirmwareTab('android')}
                    className={`px-3 py-1 font-medium rounded-md transition-colors cursor-pointer ${
                      activeFirmwareTab === 'android'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Android Kotlin
                  </button>
                  <button
                    onClick={() => setActiveFirmwareTab('arduino')}
                    className={`px-3 py-1 font-medium rounded-md transition-colors cursor-pointer ${
                      activeFirmwareTab === 'arduino'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    ESP32 Arduino
                  </button>
                  <button
                    onClick={() => setActiveFirmwareTab('chrony')}
                    className={`px-3 py-1 font-medium rounded-md transition-colors cursor-pointer ${
                      activeFirmwareTab === 'chrony'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Linux Chrony
                  </button>
                </div>

                <button
                  onClick={() => copyToClipboard(androidCode, 'android')}
                  className="px-3 py-1.5 text-xs font-mono rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  {copiedCode === 'android' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-500">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-4 rounded-lg bg-slate-950 text-slate-300 font-mono text-xs overflow-x-auto max-h-80 border border-slate-800">
                {androidCode}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              className="px-3 py-1.5 text-xs font-mono rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={onResetDefaults}
              className="px-3 py-1.5 text-xs font-mono rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {savedSuccess && (
              <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>Config Saved</span>
              </span>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Applying...' : 'Save & Apply Config'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
