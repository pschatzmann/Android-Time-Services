/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SourceConfig {
  id: string;
  name: string;
  type: 'ntp' | 'gps' | 'ble_cts' | 'atomic';
  enabled: boolean;
  stratum: number;
  weight: number;
  pollIntervalSec: number;
  hostOrPort?: string;
  baudRate?: number;
  ppsPinOrEdge?: string;
  deviceAddress?: string;
  physicsType?: 'csac' | 'rubidium' | 'cesium' | 'nist_optical';
  telemetry?: SourceTelemetry;
}

export interface SourceTelemetry {
  lastSeen: number;
  offsetMs: number;
  delayMs: number;
  jitterMs: number;
  reach: number; // 8-bit octal reach register (e.g. 377)
  status: 'locked' | 'candidate' | 'outlier' | 'standby' | 'error';
  rawPayload?: any;
}

export interface DiscipliningConfig {
  algorithm: 'kalman' | 'marzullo' | 'pll_fll';
  pllTimeConstantSec: number;
  fllBandwidthHz: number;
  maxSlewPpm: number;
  holdoverTimeoutSec: number;
  preferStratum1: boolean;
}

export interface NtpServerConfig {
  enabled: boolean;
  listenPort: number;
  stratum: number;
  refId: string;
  leapIndicator: number; // 0=no warning, 1=add sec, 2=del sec, 3=unsync
  rateLimitPerMin: number;
  allowSubnets: string[];
}

export interface BleCtsServerConfig {
  enabled: boolean;
  deviceName: string;
  advIntervalMs: number;
  sendNotifications: boolean;
  localTimeInfo: {
    timeZoneQuarterHours: number; // e.g. -32 for -8 UTC (PST)
    dstOffset: number; // 0=standard, 2=half hour, 4=one hour, 8=double
  };
  refTimeInfo: {
    timeSource: number; // 1=NTP, 2=GPS, 4=Atomic, 5=Cellular, 6=Manual
    accuracyFractions256: number;
    daysSinceLastUpdate: number;
    hoursSinceLastUpdate: number;
  };
}

export interface SystemTimeConfig {
  disciplining: DiscipliningConfig;
  ntpServer: NtpServerConfig;
  bleCtsServer: BleCtsServerConfig;
  sources: SourceConfig[];
}

export interface DisciplinedClockStatus {
  offsetNs: number;
  driftPpb: number;
  rootDispersionMs: number;
  rootDelayMs: number;
  precisionExponent: number;
  activeStratum: number;
  lockedRefId: string;
  lastDisciplineTimestampMs: number;
}

export interface TimeStatusResponse {
  status: string;
  systemTimeUtc: string;
  unixMs: number;
  highResNs: number;
  leapSecondsTai: number;
  leapSecondsGps: number;
  leapIndicator: number;
  disciplining: DisciplinedClockStatus;
  sources: SourceConfig[];
  servers: {
    ntp: NtpServerConfig & {
      packetsServed: number;
      bandwidthKbps: number;
    };
    bleCts: BleCtsServerConfig & {
      activeSubscribers: number;
      advertisementState: string;
      lastPacket: any;
    };
  };
}

export interface TelemetryPoint {
  timeStr: string;
  timestamp: number;
  offsetAtomicUs: number;
  offsetGpsUs: number;
  offsetNtpMs: number;
  offsetBleMs: number;
  disciplinedOffsetNs: number;
  driftPpb: number;
  ntpLatencyMs: number;
  bleLatencyMs: number;
}

export interface NtpPacketQueryResponse {
  offsetMs: number;
  delayMs: number;
  stratum: number;
  precision: number;
  rootDelayMs: number;
  rootDispersionMs: number;
  refId: string;
  timestamps: {
    t1_originate: string;
    t2_receive: string;
    t3_transmit: string;
    t4_destination: string;
  };
  rawHex: string;
}

export interface BleCtsParsedTime {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  dayOfWeek: number;
  fractions256: number;
  subsecondMs: number;
  adjustReason: number;
  hex: string;
}
