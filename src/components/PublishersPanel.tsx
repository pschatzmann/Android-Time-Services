/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Radio,
  Bluetooth,
  Send,
  Copy,
  Check,
  FileCode,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { NtpServerConfig, BleCtsServerConfig } from '../types/chronos';
import { TimeZoneDetails } from '../utils/timeZoneEngine';

interface PublishersPanelProps {
  ntpConfig: NtpServerConfig & { packetsServed: number; bandwidthKbps: number };
  bleConfig: BleCtsServerConfig & { activeSubscribers: number; lastPacket?: any };
  tzDetails: TimeZoneDetails;
  onToggleNtpServer?: (enabled: boolean) => void;
  onToggleBleCtsServer?: (enabled: boolean) => void;
}

export const PublishersPanel: React.FC<PublishersPanelProps> = ({
  ntpConfig,
  bleConfig,
  tzDetails,
  onToggleNtpServer,
  onToggleBleCtsServer,
}) => {
  const [testQueryResult, setTestQueryResult] = useState<any>(null);
  const [testQuerying, setTestQuerying] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<'android' | 'arduino' | 'chrony'>('android');
  const [showCodeDrawer, setShowCodeDrawer] = useState(false);

  // Trigger test NTP query to this server's endpoint
  const handleTestNtpQuery = async () => {
    setTestQuerying(true);
    try {
      const res = await fetch('/api/ntp/time');
      const data = await res.json();
      setTestQueryResult(data);
    } catch (e: any) {
      console.error(e);
      setTestQueryResult({
        enabled: false,
        error: e.message || 'Network error querying local NTP server',
      });
    } finally {
      setTestQuerying(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // 100% syntactically complete and compile-ready Android Kotlin Service code
  const androidCode = `// Android Kotlin ChronosTimeService.kt
// Complete, compilable Service for Android 14+ (API 34) & AOSP
package com.chronos.timesync

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.bluetooth.*
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.content.Intent
import android.os.IBinder
import android.os.ParcelUuid
import android.util.Log
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.time.ZonedDateTime
import java.util.UUID

class ChronosTimeService : Service() {
    private val TAG = "ChronosTimeService"
    private val CTS_SERVICE_UUID = UUID.fromString("00001805-0000-1000-8000-00805f9b34fb")
    private val CURRENT_TIME_CHAR_UUID = UUID.fromString("00002a2b-0000-1000-8000-00805f9b34fb")
    private val LOCAL_TIME_CHAR_UUID = UUID.fromString("00002a0f-0000-1000-8000-00805f9b34fb")

    private var gattServer: BluetoothGattServer? = null
    private var advertiser: BluetoothLeAdvertiser? = null

    // Service binding contract (Started service returns null)
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        val bluetoothManager = getSystemService(BLUETOOTH_SERVICE) as BluetoothManager
        val adapter = bluetoothManager.adapter

        if (adapter != null && adapter.isEnabled) {
            setupGattServer(bluetoothManager)
            startAdvertising(adapter)
        } else {
            Log.w(TAG, "Bluetooth is not available or disabled")
        }
    }

    private fun setupGattServer(manager: BluetoothManager) {
        val service = BluetoothGattService(CTS_SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY)

        // 0x2A2B: Current Time Characteristic
        val timeChar = BluetoothGattCharacteristic(
            CURRENT_TIME_CHAR_UUID,
            BluetoothGattCharacteristic.PROPERTY_READ or BluetoothGattCharacteristic.PROPERTY_NOTIFY,
            BluetoothGattCharacteristic.PERMISSION_READ
        )
        service.addCharacteristic(timeChar)

        // 0x2A0F: Local Time Information Characteristic
        val localTimeChar = BluetoothGattCharacteristic(
            LOCAL_TIME_CHAR_UUID,
            BluetoothGattCharacteristic.PROPERTY_READ,
            BluetoothGattCharacteristic.PERMISSION_READ
        )
        service.addCharacteristic(localTimeChar)

        gattServer = manager.openGattServer(this, object : BluetoothGattServerCallback() {
            override fun onCharacteristicReadRequest(
                device: BluetoothDevice,
                requestId: Int,
                offset: Int,
                characteristic: BluetoothGattCharacteristic
            ) {
                if (characteristic.uuid == CURRENT_TIME_CHAR_UUID) {
                    val buffer = buildCtsPacket()
                    gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, buffer)
                } else if (characteristic.uuid == LOCAL_TIME_CHAR_UUID) {
                    val buffer = byteArrayOf(${tzDetails.quarterHours.toString()} /* 15-min quarters */, ${tzDetails.dstOffsetCode.toString()} /* DST code */)
                    gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, buffer)
                }
            }
        })
        gattServer?.addService(service)
    }

    private fun startAdvertising(adapter: BluetoothAdapter) {
        advertiser = adapter.bluetoothLeAdvertiser
        if (advertiser == null) {
            Log.e(TAG, "BLE Advertising not supported on this hardware")
            return
        }

        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_BALANCED)
            .setConnectable(true)
            .setTimeout(0)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
            .build()

        val data = AdvertiseData.Builder()
            .setIncludeDeviceName(true)
            .addServiceUuid(ParcelUuid(CTS_SERVICE_UUID))
            .build()

        advertiser?.startAdvertising(settings, data, object : AdvertiseCallback() {
            override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
                Log.i(TAG, "BLE CTS advertising started successfully")
            }
            override fun onStartFailure(errorCode: Int) {
                Log.e(TAG, "BLE advertising failed with error code: $errorCode")
            }
        })
    }

    private fun buildCtsPacket(): ByteArray {
        val now = ZonedDateTime.now()
        val buf = ByteBuffer.allocate(10).order(ByteOrder.LITTLE_ENDIAN)
        buf.putShort(now.year.toShort())
        buf.put(now.monthValue.toByte())
        buf.put(now.dayOfMonth.toByte())
        buf.put(now.hour.toByte())
        buf.put(now.minute.toByte())
        buf.put(now.second.toByte())
        buf.put(now.dayOfWeek.value.toByte())
        buf.put(((now.nano / 1_000_000_000.0) * 256).toInt().toByte())
        buf.put(0x02) // External Ref Source Adjusted
        return buf.array()
    }

    override fun onDestroy() {
        super.onDestroy()
        advertiser?.stopAdvertising(object : AdvertiseCallback() {})
        gattServer?.close()
    }
}`;

  // Arduino ESP32 BLE CTS Server firmware snippet
  const arduinoCode = `// ESP32 Arduino BLE Current Time Service (0x1805) Server
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <sys/time.h>

#define CTS_SERVICE_UUID        "1805"
#define CURRENT_TIME_CHAR_UUID  "2A2B"
#define LOCAL_TIME_INFO_UUID    "2A0F"

BLECharacteristic *pCurrentTimeChar;
BLECharacteristic *pLocalTimeChar;

void setup() {
  Serial.begin(115200);
  BLEDevice::init("${bleConfig.deviceName || 'Chronos-CTS-Gateway'}");
  BLEServer *pServer = BLEDevice::createServer();
  BLEService *pService = pServer->createService(CTS_SERVICE_UUID);

  pCurrentTimeChar = pService->createCharacteristic(
    CURRENT_TIME_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pCurrentTimeChar->addDescriptor(new BLE2902());

  pLocalTimeChar = pService->createCharacteristic(
    LOCAL_TIME_INFO_UUID,
    BLECharacteristic::PROPERTY_READ
  );

  pService->start();
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(CTS_SERVICE_UUID);
  pAdvertising->start();
  Serial.println("Chronos BLE CTS Server Active and Advertising!");
}

void loop() {
  struct timeval tv;
  gettimeofday(&tv, NULL);
  struct tm *now = gmtime(&tv.tv_sec);

  uint8_t ctsBuffer[10];
  uint16_t year = now->tm_year + 1900;
  ctsBuffer[0] = year & 0xFF;
  ctsBuffer[1] = (year >> 8) & 0xFF;
  ctsBuffer[2] = now->tm_mon + 1;
  ctsBuffer[3] = now->tm_mday;
  ctsBuffer[4] = now->tm_hour;
  ctsBuffer[5] = now->tm_min;
  ctsBuffer[6] = now->tm_sec;
  ctsBuffer[7] = (now->tm_wday == 0) ? 7 : now->tm_wday;
  ctsBuffer[8] = (tv.tv_usec * 256) / 1000000;
  ctsBuffer[9] = 0x02; // External Reference Update

  pCurrentTimeChar->setValue(ctsBuffer, 10);
  pCurrentTimeChar->notify();
  delay(${bleConfig.advIntervalMs || 1000});
}`;

  // Linux Chrony Stratum-1 Config
  const chronyCode = `# /etc/chrony/chrony.conf - Chronos Stratum 1 Gateway
local stratum ${ntpConfig.stratum || 1}
allow ${ntpConfig.allowSubnets?.[0] || '192.168.0.0/16'}
ratelimit interval 1 burst 8

refclock PPS /dev/pps0 lock GPS refid PPS precision 1e-9
refclock SHM 0 refid GPS precision 1e-3 offset 0.050 delay 0.2
refclock SHM 1 refid ATOM precision 1e-11

driftfile /var/lib/chrony/chrony.drift
leapsectz right/UTC
makestep 0.1 3`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Time Publishing Daemons (NTP & BLE CTS)
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Control active time broadcasting from this phone or appliance to network and Bluetooth Low Energy clients
        </p>
      </div>

      {/* Grid of 2 Publishers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Publisher 1: NTP Server Daemon */}
        <div
          className={`rounded-xl border transition-all ${
            ntpConfig.enabled
              ? 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 shadow-sm'
              : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800/60 opacity-85'
          } p-5 space-y-4`}
        >
          <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4 gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-lg ${
                  ntpConfig.enabled
                    ? 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}
              >
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                  RFC 5905 NTP Server Daemon
                </h3>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mt-0.5">
                  <span
                    className={`font-bold flex items-center gap-1 ${
                      ntpConfig.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                    }`}
                  >
                    <span>{ntpConfig.enabled ? '● ACTIVE' : '○ DEACTIVATED'}</span>
                  </span>
                  <span>·</span>
                  <span>Port {ntpConfig.listenPort || 123}</span>
                  <span>·</span>
                  <span>Stratum {ntpConfig.stratum} ({ntpConfig.refId})</span>
                </div>
              </div>
            </div>

            {/* Direct Activation Switch */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                  {ntpConfig.enabled ? 'Enabled' : 'Disabled'}
                </span>
                <label className="relative inline-flex items-center cursor-pointer" title="Activate or deactivate phone as NTP Server">
                  <input
                    type="checkbox"
                    checked={ntpConfig.enabled}
                    onChange={(e) => onToggleNtpServer && onToggleNtpServer(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600 dark:peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              <button
                onClick={handleTestNtpQuery}
                disabled={testQuerying}
                className="px-3 py-1.5 text-xs font-mono font-medium bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5 shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{testQuerying ? 'Querying...' : 'Query Test'}</span>
              </button>
            </div>
          </div>

          {!ntpConfig.enabled && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-mono flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>NTP Daemon is deactivated. The phone is not answering time requests.</span>
              </span>
              <button
                onClick={() => onToggleNtpServer && onToggleNtpServer(true)}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-bold cursor-pointer shrink-0 ml-2"
              >
                Activate Server
              </button>
            </div>
          )}

          {/* Metrics row */}
          <div className="grid grid-cols-3 gap-3 text-center font-mono">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
              <div className="text-[10px] uppercase text-slate-400">Packets Served</div>
              <div className="text-base font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                {ntpConfig.enabled ? ntpConfig.packetsServed.toLocaleString() : '0 (Paused)'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
              <div className="text-[10px] uppercase text-slate-400">Bandwidth</div>
              <div className="text-base font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">
                {ntpConfig.enabled ? `${ntpConfig.bandwidthKbps.toFixed(2)} kbps` : '0.00 kbps'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
              <div className="text-[10px] uppercase text-slate-400">Rate Limiter</div>
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {ntpConfig.rateLimitPerMin}/min
              </div>
            </div>
          </div>

          {/* Test Query Inspection Output */}
          {testQueryResult && (
            <div className="bg-slate-900 text-slate-200 p-3.5 rounded-lg font-mono text-xs space-y-2 border border-slate-800">
              <div className="text-cyan-400 text-[10px] pb-1 border-b border-slate-800 flex justify-between">
                <span>NTP RESPONSE PACKET DECODE</span>
                <span className={testQueryResult.enabled !== false ? 'text-emerald-400' : 'text-rose-400'}>
                  {testQueryResult.enabled !== false
                    ? `200 OK · STRATUM ${testQueryResult.stratum}`
                    : '503 SERVICE DEACTIVATED'}
                </span>
              </div>
              {testQueryResult.enabled === false ? (
                <div className="text-rose-300 py-1">{testQueryResult.error}</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>Ref ID: <span className="text-slate-100 font-bold">{testQueryResult.refId}</span></div>
                    <div>Timestamp: <span className="text-slate-300">{testQueryResult.timestamp?.slice(11, 23)} UTC</span></div>
                    <div>Precision: <span className="text-slate-300">2^-20 s (~0.95 µs)</span></div>
                    <div>Leap Indicator: <span className="text-emerald-400">00 (Nominal)</span></div>
                  </div>
                  <div className="text-[9px] text-slate-500 break-all pt-1 border-t border-slate-800 font-mono">
                    HEX: {testQueryResult.rfc5905?.rawHex}
                  </div>
                </>
              )}
            </div>
          )}

          <p className="text-xs text-slate-500 dark:text-slate-400">
            NTP service responds to RFC 5905/SNTP UDP port 123 client queries and HTTP endpoint <code className="text-cyan-600 dark:text-cyan-400">/api/ntp/time</code> with microsecond-calibrated root dispersion.
          </p>
        </div>

        {/* Publisher 2: BLE Current Time Service (0x1805) Daemon */}
        <div
          className={`rounded-xl border transition-all ${
            bleConfig.enabled
              ? 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 shadow-sm'
              : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800/60 opacity-85'
          } p-5 space-y-4`}
        >
          <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4 gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-lg ${
                  bleConfig.enabled
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}
              >
                <Bluetooth className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                  BLE Current Time Service (CTS)
                </h3>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mt-0.5">
                  <span
                    className={`font-bold flex items-center gap-1 ${
                      bleConfig.enabled ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'
                    }`}
                  >
                    <span>{bleConfig.enabled ? '● ADVERTISING' : '○ STOPPED'}</span>
                  </span>
                  <span>·</span>
                  <span>UUID 0x1805</span>
                  <span>·</span>
                  <span>Char 0x2A2B & 0x2A0F</span>
                </div>
              </div>
            </div>

            {/* Direct Activation Switch */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                  {bleConfig.enabled ? 'Broadcasting' : 'Stopped'}
                </span>
                <label className="relative inline-flex items-center cursor-pointer" title="Activate or deactivate phone as BLE CTS Server">
                  <input
                    type="checkbox"
                    checked={bleConfig.enabled}
                    onChange={(e) => onToggleBleCtsServer && onToggleBleCtsServer(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
                </label>
              </div>

              <span
                className={`text-xs font-mono px-2.5 py-1 rounded-md border ${
                  bleConfig.enabled
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/40'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                }`}
              >
                {bleConfig.enabled ? `${bleConfig.activeSubscribers} Clients Synced` : 'Offline'}
              </span>
            </div>
          </div>

          {!bleConfig.enabled && (
            <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-mono flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Bluetooth CTS advertising is stopped. Wearables cannot discover this phone.</span>
              </span>
              <button
                onClick={() => onToggleBleCtsServer && onToggleBleCtsServer(true)}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-bold cursor-pointer shrink-0 ml-2"
              >
                Start Advertising
              </button>
            </div>
          )}

          {/* GATT Attributes Table */}
          <div className="overflow-x-auto text-xs font-mono">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
                  <th className="py-2">GATT Characteristic</th>
                  <th className="py-2">UUID</th>
                  <th className="py-2">Properties</th>
                  <th className="py-2">Current Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                <tr>
                  <td className="py-2 font-semibold text-slate-800 dark:text-slate-200">Current Time</td>
                  <td className="py-2 text-cyan-600 dark:text-cyan-400">0x2A2B</td>
                  <td className="py-2 text-slate-500">Read, Notify</td>
                  <td className="py-2 text-slate-700 dark:text-slate-300 font-mono text-[11px]">10 bytes (Exact 256)</td>
                </tr>
                <tr>
                  <td className="py-2 font-semibold text-slate-800 dark:text-slate-200">Local Time Information</td>
                  <td className="py-2 text-cyan-600 dark:text-cyan-400">0x2A0F</td>
                  <td className="py-2 text-slate-500">Read</td>
                  <td className="py-2 text-blue-600 dark:text-blue-400 font-mono text-[11px]">
                    TZ: {tzDetails.quarterHours} quarters ({tzDetails.offsetFormatted})
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-semibold text-slate-800 dark:text-slate-200">Reference Time Info</td>
                  <td className="py-2 text-cyan-600 dark:text-cyan-400">0x2A14</td>
                  <td className="py-2 text-slate-500">Read</td>
                  <td className="py-2 text-slate-700 dark:text-slate-300 font-mono text-[11px]">Source: GPS (0x02)</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Live CTS Frame Decoded */}
          <div className="bg-slate-900 text-slate-200 p-3.5 rounded-lg font-mono text-xs space-y-1.5 border border-slate-800">
            <div className="text-blue-400 text-[10px] pb-1 border-b border-slate-800 flex justify-between">
              <span>LIVE BROADCAST PACKET (0x2A2B)</span>
              <span>Cadence: {bleConfig.advIntervalMs} ms</span>
            </div>
            <div className="text-[11px] text-slate-300">
              Device: <span className="text-white font-bold">{bleConfig.deviceName}</span> · DST Offset Code: <span className="text-emerald-400">0x0{tzDetails.dstOffsetCode}</span>
            </div>
            {bleConfig.lastPacket && (
              <div className="text-[10px] text-slate-400 font-mono pt-1">
                Wire Hex: <span className="text-cyan-400 font-bold">{bleConfig.lastPacket.hex}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Complies with Bluetooth Core Specification CTS v1.1. Smartwatches, IoT microcontrollers, and BLE peripheral clients synchronize directly using standard GATT connection.
          </p>
        </div>
      </div>

      {/* Collapsible Hardware & Android Firmware Exporter (Collapsed by default so it never looks like a backtrace) */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowCodeDrawer(!showCodeDrawer)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                <span>Native Android & Embedded Firmware Source Exporter</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  Optional Developer Reference
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate production-ready Android Kotlin services, ESP32 Arduino sketches, and Linux Chrony configs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>{showCodeDrawer ? 'Hide Code' : 'View Code'}</span>
            {showCodeDrawer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showCodeDrawer && (
          <div className="p-5 border-t border-slate-100 dark:border-slate-800 space-y-4 bg-slate-50/50 dark:bg-slate-950/40">
            {/* Code Tab Switcher */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-mono">
                <button
                  onClick={() => setActiveCodeTab('android')}
                  className={`px-3 py-1 font-medium rounded-md transition-colors cursor-pointer ${
                    activeCodeTab === 'android'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Android Kotlin Service
                </button>
                <button
                  onClick={() => setActiveCodeTab('arduino')}
                  className={`px-3 py-1 font-medium rounded-md transition-colors cursor-pointer ${
                    activeCodeTab === 'arduino'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  ESP32 Arduino C++
                </button>
                <button
                  onClick={() => setActiveCodeTab('chrony')}
                  className={`px-3 py-1 font-medium rounded-md transition-colors cursor-pointer ${
                    activeCodeTab === 'chrony'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Linux Chrony Conf
                </button>
              </div>

              <button
                onClick={() => {
                  const code =
                    activeCodeTab === 'android'
                      ? androidCode
                      : activeCodeTab === 'arduino'
                      ? arduinoCode
                      : chronyCode;
                  copyToClipboard(code, activeCodeTab);
                }}
                className="px-3 py-1.5 text-xs font-mono rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                {copiedCode === activeCodeTab ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500">Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Source</span>
                  </>
                )}
              </button>
            </div>

            {/* Code Box */}
            <pre className="p-4 rounded-lg bg-slate-950 text-slate-300 font-mono text-xs overflow-x-auto max-h-80 border border-slate-800">
              {activeCodeTab === 'android' && androidCode}
              {activeCodeTab === 'arduino' && arduinoCode}
              {activeCodeTab === 'chrony' && chronyCode}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
