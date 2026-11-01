/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BleCtsParsedTime } from '../types/chronos';

// Format high-precision UTC time down to microseconds
export function formatHighPrecisionTime(date: Date, offsetNs: number = 0): {
  dateStr: string;
  timeStr: string;
  microsecondStr: string;
  fullIso: string;
} {
  const adjustedMs = date.getTime() + offsetNs / 1e6;
  const adjDate = new Date(adjustedMs);

  const y = adjDate.getUTCFullYear();
  const m = String(adjDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(adjDate.getUTCDate()).padStart(2, '0');
  const hh = String(adjDate.getUTCHours()).padStart(2, '0');
  const mm = String(adjDate.getUTCMinutes()).padStart(2, '0');
  const ss = String(adjDate.getUTCSeconds()).padStart(2, '0');
  const ms = String(adjDate.getUTCMilliseconds()).padStart(3, '0');

  // Sub-millisecond microseconds from nanosecond remainder
  const nsRemainder = Math.abs(Math.round(offsetNs % 1e6));
  const us = String(Math.floor(nsRemainder / 1000)).padStart(3, '0');

  return {
    dateStr: `${y}-${m}-${d}`,
    timeStr: `${hh}:${mm}:${ss}`,
    microsecondStr: `.${ms} ${us}`,
    fullIso: `${y}-${m}-${d}T${hh}:${mm}:${ss}.${ms}${us}Z`,
  };
}

// Convert UTC to TAI (International Atomic Time, +37 leap seconds as of current standard)
export function getTaiTime(date: Date, leapSeconds = 37): string {
  const taiMs = date.getTime() + leapSeconds * 1000;
  return new Date(taiMs).toISOString().replace('Z', ' TAI');
}

// Convert UTC to GPS Time (GPS Epoch 1980, currently UTC + 18 leap seconds)
export function getGpsTime(date: Date, leapSeconds = 18): string {
  const gpsMs = date.getTime() + leapSeconds * 1000;
  return new Date(gpsMs).toISOString().replace('Z', ' GPS');
}

// Format octal reach register (e.g. 255 -> '377')
export function formatOctalReach(reach: number): string {
  return (reach & 0o377).toString(8).padStart(3, '0');
}

// Parse Bluetooth SIG Current Time Characteristic (0x2A2B) 10-byte buffer
export function parseBleCtsBuffer(dataView: DataView): BleCtsParsedTime {
  const year = dataView.getUint16(0, true);
  const month = dataView.getUint8(2);
  const day = dataView.getUint8(3);
  const hours = dataView.getUint8(4);
  const minutes = dataView.getUint8(5);
  const seconds = dataView.getUint8(6);
  const dayOfWeek = dataView.getUint8(7);
  const fractions256 = dataView.getUint8(8);
  const adjustReason = dataView.getUint8(9);

  const hexBytes: string[] = [];
  for (let i = 0; i < dataView.byteLength; i++) {
    hexBytes.push(dataView.getUint8(i).toString(16).padStart(2, '0'));
  }

  return {
    year,
    month,
    day,
    hours,
    minutes,
    seconds,
    dayOfWeek,
    fractions256,
    subsecondMs: Math.round((fractions256 / 256) * 1000),
    adjustReason,
    hex: hexBytes.join(' '),
  };
}

// Generate Allan Deviation σy(τ) theoretical and empirical curve points for stability comparison
export interface AllanDeviationPoint {
  tauSec: number;
  tauLabel: string;
  csacSigma: number;
  disciplinedSigma: number;
  quartzOcxoSigma: number;
  ntpNetworkSigma: number;
}

export function calculateAllanDeviationCurve(): AllanDeviationPoint[] {
  const taus = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];

  return taus.map((tau) => {
    // CSAC SA.45m model: ~2.5e-11 / sqrt(tau), floor at 3e-12 at 1000s
    const csac = Math.max(3e-12, 2.5e-11 / Math.sqrt(tau));

    // High quality OCXO: 1e-12 at 1s, deteriorates due to thermal aging to 5e-11 at 1000s
    const ocxo = 1.2e-12 * Math.pow(tau, 0.45);

    // Disciplined Clock: combines OCXO short term (<10s) with CSAC & GPS PPS long term (>10s)
    const disciplined = tau < 10
      ? 1.5e-12 * Math.pow(tau, 0.2)
      : Math.max(1.8e-12, 1.2e-11 / Math.sqrt(tau));

    // Raw NTP Network: jitter dominated 1e-7 / tau down to 1e-9 at 1000s
    const ntp = Math.max(8e-10, 1.5e-7 / tau);

    return {
      tauSec: tau,
      tauLabel: `${tau}s`,
      csacSigma: csac,
      disciplinedSigma: disciplined,
      quartzOcxoSigma: ocxo,
      ntpNetworkSigma: ntp,
    };
  });
}

// Parse NMEA sentence to extract UTC time and satellite fix
export function parseNmeaSentence(sentence: string): {
  type: string;
  utcTime?: string;
  fixValid?: boolean;
  satellites?: number;
  hdop?: number;
} {
  const parts = sentence.trim().split(',');
  const tag = parts[0].replace('$', '');

  if (tag.endsWith('RMC') && parts.length > 9) {
    const rawTime = parts[1]; // hhmmss.ss
    const status = parts[2]; // A = Active, V = Void
    const rawDate = parts[9]; // ddmmyy

    let utcTime: string | undefined;
    if (rawTime && rawTime.length >= 6) {
      const hh = rawTime.slice(0, 2);
      const mm = rawTime.slice(2, 4);
      const ss = rawTime.slice(4, 6);
      utcTime = `${hh}:${mm}:${ss} UTC`;
    }

    return {
      type: tag,
      utcTime,
      fixValid: status === 'A',
    };
  }

  if (tag.endsWith('GGA') && parts.length > 8) {
    const sats = parseInt(parts[7], 10) || 0;
    const hdop = parseFloat(parts[8]) || 1.0;
    return {
      type: tag,
      fixValid: parseInt(parts[6], 10) > 0,
      satellites: sats,
      hdop,
    };
  }

  return { type: tag };
}

// Generate live NMEA GPRMC and GPZDA sentence for simulation/preview
export function generateSyntheticNmea(date = new Date()): string[] {
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  const ms = String(Math.floor(date.getUTCMilliseconds() / 10)).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mo = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yy = String(date.getUTCFullYear()).slice(-2);
  const yyyy = String(date.getUTCFullYear());

  const rmcTime = `${hh}${mm}${ss}.${ms}`;
  const rmcDate = `${dd}${mo}${yy}`;
  const rmc = `$GPRMC,${rmcTime},A,3746.5218,N,12225.1092,W,0.02,184.2,${rmcDate},,,A*7E`;
  const gga = `$GPGGA,${rmcTime},3746.5218,N,12225.1092,W,1,18,0.72,14.8,M,-29.4,M,,*4A`;
  const zda = `$GPZDA,${hh}${mm}${ss}.${ms},${dd},${mo},${yyyy},00,00*6B`;

  return [rmc, gga, zda];
}
