package com.pschatzmann.timeservices

enum class SourceType { NTP, GPS, BLE_CTS }

data class SourceConfig(
    val id: String,
    val name: String,
    val type: SourceType,
    val enabled: Boolean,
    val stratum: Int,
    val weight: Double,
    val pollIntervalSec: Int,
    val hostOrPort: String = "",
    val deviceAddress: String = "",
)

data class DiscipliningConfig(
    val algorithm: String = "kalman", // kalman | marzullo | pll_fll
    val pllTimeConstantSec: Int = 16,
    val fllBandwidthHz: Double = 0.05,
    val maxSlewPpm: Int = 500,
    val holdoverTimeoutSec: Int = 86400,
    val preferStratum1: Boolean = true,
)

data class NtpServerConfig(
    val enabled: Boolean = false,
    val listenPort: Int = 12123,
    val stratum: Int = 2,
    val refId: String = "CHRN",
    val leapIndicator: Int = 0,
    val rateLimitPerMin: Int = 120,
    val allowSubnets: List<String> = listOf("0.0.0.0/0"),
)

data class BleCtsConfig(
    val enabled: Boolean = false,
    val advIntervalMs: Int = 1000,
    val sendNotifications: Boolean = true,
    /** Push interval for 0x2A2B notifications, 100 ms .. 24 h. */
    val notifyIntervalMs: Int = 1000,
)

data class SystemConfig(
    val disciplining: DiscipliningConfig = DiscipliningConfig(),
    val ntpServer: NtpServerConfig = NtpServerConfig(),
    val bleCts: BleCtsConfig = BleCtsConfig(),
    val sources: List<SourceConfig> = Defaults.sources(),
    /** Hold a partial wake lock + Wi-Fi lock while a server runs, so it answers with the screen off. */
    val keepAwake: Boolean = false,
    /** What the NTP / BLE servers publish: "fused", "system", or the id of one time source. */
    val publishSourceId: String = "fused",
)

object Defaults {
    fun sources() = listOf(
        SourceConfig("src_gps", "Phone GNSS (Location API)", SourceType.GPS, true, 1, 0.10, 1),
        SourceConfig("src_ntp_cf", "Cloudflare NTP", SourceType.NTP, true, 1, 0.35, 16, "time.cloudflare.com"),
        SourceConfig("src_ntp_google", "Google Public NTP", SourceType.NTP, true, 1, 0.35, 16, "time.google.com"),
        SourceConfig("src_ble_cts", "BLE CTS Peripheral", SourceType.BLE_CTS, false, 2, 0.05, 5),
    )

    fun config() = SystemConfig()
}

enum class SourceStatus { LOCKED, CANDIDATE, OUTLIER, STANDBY, ERROR }

data class SourceTelemetry(
    val lastSeen: Long = 0,
    val offsetMs: Double = 0.0,
    val delayMs: Double = 0.0,
    val jitterMs: Double = 0.0,
    val reach: Int = 0,
    val status: SourceStatus = SourceStatus.STANDBY,
    val detail: UiText? = null,
)

data class ClockStatus(
    val offsetNs: Long = 0,
    val driftPpb: Double = 0.0,
    val rootDispersionMs: Double = 0.0,
    val rootDelayMs: Double = 0.0,
    val precisionExponent: Int = -10,
    val activeStratum: Int = 16,
    val lockedRefId: String = "INIT",
    val lastDisciplineMs: Long = 0,
    val synced: Boolean = false,
    val holdoverSec: Int = 0,
    val leapSecondsTai: Int = 37,
    val leapSecondsGps: Int = 18,
)

data class TelemetryPoint(
    val timestamp: Long,
    val fusedOffsetMs: Double,
    val driftPpb: Double,
    val ntpOffsetMs: Double?,
    val ntpDelayMs: Double?,
    val gpsOffsetMs: Double?,
    val bleOffsetMs: Double?,
    val bleDelayMs: Double?,
)

data class NtpServerState(
    val running: Boolean = false,
    val port: Int = 0,
    val packetsServed: Long = 0,
    val dropped: Long = 0,
    val lastClient: String = "",
    val error: UiText? = null,
    /** Enabled, but stopped because no Wi-Fi / mobile / Ethernet network is up. */
    val waitingForNetwork: Boolean = false,
)

data class BleServerState(
    val running: Boolean = false,
    val connected: Int = 0,
    val subscribers: Int = 0,
    val lastPacketHex: String = "",
    val error: UiText? = null,
    /** Enabled, but stopped because Bluetooth is switched off. */
    val waitingForBluetooth: Boolean = false,
)

data class GnssState(
    val supported: Boolean = true,
    val active: Boolean = false,
    val satsUsed: Int = 0,
    val satsVisible: Int = 0,
    val accuracyM: Float = 0f,
    val hasFix: Boolean = false,
)
