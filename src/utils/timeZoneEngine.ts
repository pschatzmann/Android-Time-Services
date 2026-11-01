/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TimeZoneDetails {
  iana: string; // e.g. "America/Los_Angeles"
  displayName: string; // e.g. "Pacific Standard Time"
  shortName: string; // e.g. "PST"
  offsetMinutes: number; // e.g. -480
  offsetFormatted: string; // e.g. "UTC-08:00"
  quarterHours: number; // e.g. -32 (for BLE CTS 0x2A0F)
  isDst: boolean;
  dstOffsetCode: number; // 0=Standard, 2=Half Hour (+30m), 4=Daylight (+60m), 8=Double (+120m)
  nextTransition?: {
    dateIso: string;
    description: string;
  };
  solarTimeOffsetMin?: number;
}

// Common IANA Timezones curated for quick selection
export const POPULAR_TIMEZONES = [
  { iana: 'AUTO', label: 'Device / Android Local Time (Auto-Detect)' },
  { iana: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { iana: 'America/New_York', label: 'America/New_York (Eastern Time)' },
  { iana: 'America/Chicago', label: 'America/Chicago (Central Time)' },
  { iana: 'America/Denver', label: 'America/Denver (Mountain Time)' },
  { iana: 'America/Los_Angeles', label: 'America/Los_Angeles (Pacific Time)' },
  { iana: 'America/Anchorage', label: 'America/Anchorage (Alaska Time)' },
  { iana: 'Pacific/Honolulu', label: 'Pacific/Honolulu (Hawaii Time)' },
  { iana: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { iana: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
  { iana: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { iana: 'Europe/Zurich', label: 'Europe/Zurich (CET/CEST)' },
  { iana: 'Europe/Helsinki', label: 'Europe/Helsinki (EET/EEST)' },
  { iana: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
  { iana: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { iana: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
  { iana: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { iana: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT)' },
  { iana: 'Pacific/Auckland', label: 'Pacific/Auckland (NZST/NZDT)' },
];

// Detect device native timezone
export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (e) {
    return 'UTC';
  }
}

// Compute comprehensive timezone details for any date & IANA zone
export function calculateTimeZoneDetails(date = new Date(), targetIana?: string): TimeZoneDetails {
  const iana = (!targetIana || targetIana === 'AUTO') ? getDeviceTimezone() : targetIana;

  // Formatters for target timezone
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: iana,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    timeZoneName: 'long',
  });

  const shortDtf = new Intl.DateTimeFormat('en-US', {
    timeZone: iana,
    timeZoneName: 'short',
  });

  const parts = dtf.formatToParts(date);
  const shortParts = shortDtf.formatToParts(date);

  const longName = parts.find((p) => p.type === 'timeZoneName')?.value || iana;
  const shortName = shortParts.find((p) => p.type === 'timeZoneName')?.value || 'UTC';

  // Calculate true minutes offset from UTC
  // We can format target time in ISO parts vs UTC parts
  const utcDate = new Date(date.toISOString());
  const localString = date.toLocaleString('en-US', { timeZone: iana });
  const localParsed = new Date(localString);
  const utcEquivalent = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMinutes = Math.round((localParsed.getTime() - utcEquivalent.getTime()) / 60000);

  // Format UTC offset e.g. UTC-08:00
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMinutes);
  const offH = String(Math.floor(absMin / 60)).padStart(2, '0');
  const offM = String(absMin % 60).padStart(2, '0');
  const offsetFormatted = `UTC${sign}${offH}:${offM}`;

  // BLE CTS 0x2A0F Local Time Information: signed int8 in 15-min quarters
  const quarterHours = Math.round(offsetMinutes / 15);

  // Detect DST by comparing against standard winter time offset
  const jan = new Date(date.getFullYear(), 0, 1);
  const jul = new Date(date.getFullYear(), 6, 1);
  const janLocal = new Date(jan.toLocaleString('en-US', { timeZone: iana }));
  const janUtc = new Date(jan.toLocaleString('en-US', { timeZone: 'UTC' }));
  const janOffset = Math.round((janLocal.getTime() - janUtc.getTime()) / 60000);

  const julLocal = new Date(jul.toLocaleString('en-US', { timeZone: iana }));
  const julUtc = new Date(jul.toLocaleString('en-US', { timeZone: 'UTC' }));
  const julOffset = Math.round((julLocal.getTime() - julUtc.getTime()) / 60000);

  const standardOffset = Math.min(janOffset, julOffset);
  const isDst = offsetMinutes > standardOffset;
  const dstDeltaMinutes = offsetMinutes - standardOffset;

  let dstOffsetCode = 0; // Standard Time
  if (dstDeltaMinutes === 30) dstOffsetCode = 2; // Half Hour Daylight
  else if (dstDeltaMinutes >= 60 && dstDeltaMinutes < 120) dstOffsetCode = 4; // Daylight (+1h)
  else if (dstDeltaMinutes >= 120) dstOffsetCode = 8; // Double Daylight (+2h)

  return {
    iana,
    displayName: longName,
    shortName,
    offsetMinutes,
    offsetFormatted,
    quarterHours,
    isDst,
    dstOffsetCode,
    nextTransition: {
      dateIso: isDst ? `${date.getFullYear()}-11-01T02:00:00` : `${date.getFullYear() + 1}-03-08T02:00:00`,
      description: isDst ? 'Fall Back (-1h) to Standard Time' : 'Spring Forward (+1h) to Daylight Time',
    },
  };
}

// Format disciplined local time taking UTC timestamp + high precision nanoseconds
export function formatDisciplinedLocalTime(
  utcTimestampMs: number,
  offsetNs: number,
  targetIana?: string
): {
  dateStr: string;
  timeStr: string;
  fractionStr: string;
  timeZoneBadge: string;
} {
  const iana = (!targetIana || targetIana === 'AUTO') ? getDeviceTimezone() : targetIana;
  const adjustedMs = utcTimestampMs + offsetNs / 1e6;
  const d = new Date(adjustedMs);

  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: iana,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  });

  const parts = dtf.formatToParts(d);
  const year = parts.find((p) => p.type === 'year')?.value || '2026';
  const month = parts.find((p) => p.type === 'month')?.value || '11';
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  const hour = parts.find((p) => p.type === 'hour')?.value || '00';
  const minute = parts.find((p) => p.type === 'minute')?.value || '00';
  const second = parts.find((p) => p.type === 'second')?.value || '00';
  const tz = parts.find((p) => p.type === 'timeZoneName')?.value || 'LOCAL';

  const ms = String(d.getMilliseconds()).padStart(3, '0');
  const nsRemainder = Math.abs(Math.round(offsetNs % 1e6));
  const us = String(Math.floor(nsRemainder / 1000)).padStart(3, '0');

  return {
    dateStr: `${year}-${month}-${day}`,
    timeStr: `${hour}:${minute}:${second}`,
    fractionStr: `.${ms} ${us}`,
    timeZoneBadge: tz,
  };
}
