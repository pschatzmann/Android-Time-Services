package com.pschatzmann.timeservices

import android.Manifest
import android.app.Application
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.pschatzmann.timeservices.ble.BleCtsClient
import com.pschatzmann.timeservices.ble.BleCtsServer
import com.pschatzmann.timeservices.ble.BleSample
import com.pschatzmann.timeservices.ble.Cts
import com.pschatzmann.timeservices.net.NtpClient
import com.pschatzmann.timeservices.net.NtpResult
import com.pschatzmann.timeservices.net.NtpServer
import com.pschatzmann.timeservices.net.NtpServerClock
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToLong
import kotlin.math.sqrt

/**
 * Replaces the Node/Express backend: owns the configuration, polls the real time sources
 * (NTP over UDP, phone GNSS, BLE CTS peers), fuses them into a disciplined offset and runs the
 * NTP / BLE CTS publishing servers.
 *
 * The Android system clock is never modified (that needs system privileges); the "disciplined"
 * time is System.currentTimeMillis() plus the fused offset estimate.
 */
class TimeEngine(app: Application) {
    private val ctx = app.applicationContext
    private val store = ConfigStore(ctx)
    val alerts = AlertNotifier(ctx)

    val config = MutableStateFlow(store.load())
    val telemetry = MutableStateFlow<Map<String, SourceTelemetry>>(emptyMap())
    val status = MutableStateFlow(ClockStatus())
    val history = MutableStateFlow<List<TelemetryPoint>>(emptyList())
    val ntpServerState = MutableStateFlow(NtpServerState())
    val bleServerState = MutableStateFlow(BleServerState())
    val bleClientState = MutableStateFlow<UiText>(res(R.string.bc_idle))
    val gnssState = MutableStateFlow(GnssState())
    val darkTheme = MutableStateFlow(store.loadDark())
    val syncing = MutableStateFlow(false)
    val hasLocationPermission = MutableStateFlow(false)
    val hasBlePermission = MutableStateFlow(false)
    val networkAvailable = MutableStateFlow(true)
    val bluetoothOn = MutableStateFlow(
        (ctx.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter?.isEnabled == true,
    )
    init {
        ContextCompat.registerReceiver(
            ctx,
            object : BroadcastReceiver() {
                override fun onReceive(c: Context, i: Intent) {
                    bluetoothOn.value = i.getIntExtra(BluetoothAdapter.EXTRA_STATE, -1) == BluetoothAdapter.STATE_ON
                }
            },
            IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED),
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )
    }
    private val networkRegained = java.util.concurrent.atomic.AtomicBoolean(false)
    private val networkMonitor = NetworkMonitor(ctx) { up ->
        if (up && !networkAvailable.value) networkRegained.set(true)
        networkAvailable.value = up
    }.also {
        networkAvailable.value = it.isCurrentlyAvailable()
        it.start()
    }

    /** Estimated (true time - system clock) in milliseconds. */
    @Volatile var fusedOffsetMs = 0.0
        private set

    fun nowMs(): Long = System.currentTimeMillis() + fusedOffsetMs.roundToLong()

    // --- internal runtime state -------------------------------------------------------------

    private data class Sample(val offsetMs: Double, val delayMs: Double, val at: Long)

    private class Runtime {
        @Volatile var sample: Sample? = null
        @Volatile var reach = 0
        @Volatile var lastReachShift = 0L
        @Volatile var lastPoll = 0L
        @Volatile var error: UiText? = null
        @Volatile var detail: UiText? = null
        val inFlight = AtomicBoolean(false)
        val offsets = ArrayDeque<Double>()
    }

    private val runtime = ConcurrentHashMap<String, Runtime>()

    @Volatile private var hasLock = false
    @Volatile private var holdoverSec = 0
    @Volatile private var lastDisciplineMs = System.currentTimeMillis()
    @Volatile private var rootDelayMs = 0.0
    @Volatile private var rootDispMs = 1000.0
    @Volatile private var curStratum = 16
    @Volatile private var curRefId = "INIT"
    private val fusedTrail = ArrayDeque<Pair<Long, Double>>()

    private var runningNtp: NtpServerConfig? = null
    private var runningBle: BleCtsConfig? = null

    /** The clock a server publishes, according to [SystemConfig.publishSourceId]. */
    private class Published(
        val nowMs: Long,
        val stratum: Int,
        val refSource: Int,
        val rootDelayMs: Double,
        val rootDispMs: Double,
        val lastDisciplineMs: Long,
    )

    private fun published(): Published {
        val cfg = config.value
        val sys = System.currentTimeMillis()
        return when (val id = cfg.publishSourceId) {
            PUBLISH_FUSED -> Published(
                sys + fusedOffsetMs.roundToLong(), curStratum,
                when (curRefId) {
                    "GPS" -> Cts.SRC_GPS
                    "NTP" -> Cts.SRC_NTP
                    else -> Cts.SRC_UNKNOWN
                },
                rootDelayMs, rootDispMs, lastDisciplineMs,
            )
            PUBLISH_SYSTEM -> Published(sys, cfg.ntpServer.stratum, Cts.SRC_UNKNOWN, 0.0, 20.0, sys)
            else -> {
                val src = cfg.sources.firstOrNull { it.id == id && it.enabled }
                val rt = runtime[id]
                val smp = rt?.sample
                val fresh = src != null && smp != null && !radioOff(src) &&
                    sys - smp.at <= freshWindowMs(src.pollIntervalSec)
                if (src == null || rt == null || smp == null || !fresh) {
                    // Chosen source is off or has no recent sample: advertise "unsynchronised".
                    Published(sys + fusedOffsetMs.roundToLong(), 16, Cts.SRC_UNKNOWN, 0.0, 1000.0, lastDisciplineMs)
                } else {
                    Published(
                        sys + smp.offsetMs.roundToLong(), cfg.ntpServer.stratum,
                        when (src.type) {
                            SourceType.GPS -> Cts.SRC_GPS
                            SourceType.NTP -> Cts.SRC_NTP
                            else -> Cts.SRC_UNKNOWN
                        },
                        smp.delayMs, jitterOf(rt) + smp.delayMs / 2, smp.at,
                    )
                }
            }
        }
    }

    /** A source whose radio is switched off cannot deliver anything; no point waiting for it to go stale. */
    private fun radioOff(src: SourceConfig) = when (src.type) {
        SourceType.NTP -> !networkAvailable.value
        SourceType.BLE_CTS -> !bluetoothOn.value
        SourceType.GPS -> false
    }

    /** A sample counts as current for two missed polls (plus slack), not three. */
    private fun freshWindowMs(pollSec: Int) = max(2L * max(1, pollSec) * 1000L + 5_000L, 10_000L)

    private val ntpServer = NtpServer(
        clock = {
            val p = published()
            NtpServerClock(
                nowMs = p.nowMs,
                stratum = p.stratum,
                leapIndicator = if (p.stratum >= 16) 3 else config.value.ntpServer.leapIndicator,
                rootDelayMs = p.rootDelayMs,
                rootDispersionMs = p.rootDispMs,
                lastDisciplineMs = p.lastDisciplineMs,
            )
        },
        onState = { ntpServerState.value = it },
    )

    private val gnss = GnssSource(ctx)

    private val bleServer = BleCtsServer(
        ctx,
        nowMs = { published().nowMs },
        refInfo = { published().let { it.refSource to it.rootDispMs } },
        onState = { bleServerState.value = it },
    )

    private val bleClient = BleCtsClient(
        ctx,
        pollMs = { (config.value.sources.firstOrNull { it.type == SourceType.BLE_CTS }?.pollIntervalSec ?: 5) * 1000L },
        onSample = { s: BleSample ->
            val src = config.value.sources.firstOrNull { it.type == SourceType.BLE_CTS }
            if (src != null) {
                val rt = runtime.getOrPut(src.id) { Runtime() }
                record(rt, s.offsetMs, s.rttMs, s.atMs)
                rt.detail = res(R.string.src_detail_ble_peer, s.parsed.hex)
            }
        },
        onState = { bleClientState.value = it },
    )

    // --- lifecycle: the loop runs while the UI is visible or the foreground service is up ------

    private val scope = CoroutineScope(
        SupervisorJob() + Dispatchers.Default + CoroutineExceptionHandler { _, e -> Safety.survive("coroutine", e) },
    )
    private var loop: Job? = null
    @Volatile private var uiVisible = false
    @Volatile private var serviceRunning = false

    fun setUiVisible(visible: Boolean) {
        uiVisible = visible
        reconcile()
    }

    fun setServiceRunning(running: Boolean) {
        serviceRunning = running
        reconcile()
    }

    @Synchronized
    private fun reconcile() {
        if (uiVisible || serviceRunning) {
            if (loop == null) {
                loop = scope.launch {
                    while (isActive) {
                        try {
                            tick()
                            tickFailures = 0
                            alerts.clear("engine")
                        } catch (e: CancellationException) {
                            throw e
                        } catch (e: Exception) {
                            Log.w("TimeServices", "tick failed", e)
                            if (++tickFailures >= 5) {
                                alerts.post("engine", ctx.getString(R.string.alert_engine_title), e.message ?: e.javaClass.simpleName)
                            }
                        }
                        delay(1000)
                    }
                }
            }
        } else {
            loop?.cancel()
            loop = null
            scope.launch { shutdown() }
        }
    }

    private suspend fun shutdown() {
        runningNtp = null
        runningBle = null
        ntpServer.stop()
        withContext(Dispatchers.Main) {
            bleServer.stop()
            bleClient.stop()
            gnss.stop()
        }
    }

    // --- public actions ---------------------------------------------------------------------

    /** True when something has to keep running without the UI (a publishing server is enabled). */
    fun backgroundWanted(c: SystemConfig = config.value) = c.ntpServer.enabled || c.bleCts.enabled

    /** Call from UI actions only: starting a foreground service from the background is not allowed. */
    fun updateConfig(transform: (SystemConfig) -> SystemConfig) {
        config.update(transform)
        store.save(config.value)
        if (backgroundWanted()) {
            try {
                TimeService.start(ctx)
            } catch (e: Exception) {
                Log.w("TimeServices", "cannot start service", e)
                alerts.post("service", ctx.getString(R.string.alert_service_title), ctx.getString(R.string.alert_service_text))
            }
        }
    }

    /** Disables both servers (used by the notification's Stop action); does not start the service. */
    fun stopPublishing() {
        config.update { it.copy(ntpServer = it.ntpServer.copy(enabled = false), bleCts = it.bleCts.copy(enabled = false)) }
        store.save(config.value)
    }

    fun toggleSource(id: String, enabled: Boolean) =
        updateConfig { c -> c.copy(sources = c.sources.map { if (it.id == id) it.copy(enabled = enabled) else it }) }

    fun setWeight(id: String, weight: Double) =
        updateConfig { c -> c.copy(sources = c.sources.map { if (it.id == id) it.copy(weight = weight) else it }) }

    fun setSourceTarget(id: String, host: String) = updateConfig { c ->
        c.copy(sources = c.sources.map {
            if (it.id != id) it else if (it.type == SourceType.BLE_CTS) it.copy(deviceAddress = host) else it.copy(hostOrPort = host)
        })
    }

    fun toggleNtpServer(enabled: Boolean) = updateConfig { it.copy(ntpServer = it.ntpServer.copy(enabled = enabled)) }

    fun toggleBleServer(enabled: Boolean) = updateConfig { it.copy(bleCts = it.bleCts.copy(enabled = enabled)) }

    fun resetDefaults() = updateConfig { Defaults.config() }

    fun toggleTheme() {
        darkTheme.update { !it }
        store.saveDark(darkTheme.value)
    }

    fun forceSync() {
        scope.launch {
            syncing.value = true
            runtime.values.forEach { it.lastPoll = 0 }
            delay(1200)
            syncing.value = false
        }
    }

    suspend fun probeNtp(hostPort: String): Result<NtpResult> = withContext(Dispatchers.IO) {
        if (!networkAvailable.value) {
            Result.failure(IllegalStateException(ctx.getString(R.string.err_no_network)))
        } else {
            probe {
                val (h, p) = splitHostPort(hostPort)
                NtpClient.query(h, p, 2500)
            }
        }
    }

    /** Sends a real SNTP request to this phone's own NTP server. */
    suspend fun probeLocalServer(): Result<NtpResult> = withContext(Dispatchers.IO) {
        if (!ntpServerState.value.running) {
            Result.failure(IllegalStateException(ctx.getString(R.string.err_server_stopped)))
        } else {
            probe { NtpClient.query("127.0.0.1", config.value.ntpServer.listenPort, 1500) }
        }
    }

    /** Runs a blocking query and turns every failure (not just Exceptions) into a Result. */
    private inline fun probe(block: () -> NtpResult): Result<NtpResult> = try {
        Result.success(block())
    } catch (e: CancellationException) {
        throw e
    } catch (e: Throwable) {
        Result.failure(e)
    }

    // --- engine -----------------------------------------------------------------------------

    private fun granted(p: String) = ctx.checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED

    fun refreshPermissions() {
        val loc = granted(Manifest.permission.ACCESS_FINE_LOCATION)
        hasLocationPermission.value = loc
        hasBlePermission.value = if (Build.VERSION.SDK_INT >= 31) {
            granted(Manifest.permission.BLUETOOTH_SCAN) &&
                granted(Manifest.permission.BLUETOOTH_ADVERTISE) &&
                granted(Manifest.permission.BLUETOOTH_CONNECT)
        } else {
            loc
        }
    }

    private suspend fun tick() {
        val cfg = config.value
        val now = System.currentTimeMillis()
        refreshPermissions()
        applyServers(cfg)
        feedSources(cfg, now)
        fuse(cfg, now)
        evaluateAlerts(cfg, now)
    }

    private var tickFailures = 0
    private val lastStatus = ConcurrentHashMap<String, SourceStatus>()
    private var unsyncSince = 0L
    private val errorSince = ConcurrentHashMap<String, Long>()

    /** Turns persistent problems into notifications and clears them once they are gone. */
    private fun evaluateAlerts(cfg: SystemConfig, now: Long) {
        val ntp = ntpServerState.value
        if (cfg.ntpServer.enabled && ntp.error != null) {
            val hint = if (cfg.ntpServer.listenPort < 1024) " " + ctx.getString(R.string.alert_ntp_low_port_hint) else ""
            alerts.post("ntp_server", ctx.getString(R.string.alert_ntp_failed_title), ntp.error.resolve(ctx) + hint)
        } else {
            alerts.clear("ntp_server")
        }

        val ble = bleServerState.value
        if (cfg.bleCts.enabled && ble.error != null) {
            alerts.post("ble_server", ctx.getString(R.string.alert_ble_failed_title), ble.error.resolve(ctx))
        } else {
            alerts.clear("ble_server")
        }

        // Publishing while no source is reachable: clients see stratum 16.
        if (backgroundWanted(cfg) && curStratum >= 16 && networkAvailable.value) {
            if (unsyncSince == 0L) unsyncSince = now
            if (now - unsyncSince > 60_000) {
                alerts.post("unsync", ctx.getString(R.string.alert_unsync_title), ctx.getString(R.string.alert_unsync_text))
            }
        } else {
            unsyncSince = 0L
            alerts.clear("unsync")
        }

        // A source that has been failing for a minute.
        for (src in cfg.sources) {
            val t = telemetry.value[src.id]
            val key = "src_" + src.id
            // Not a fault: the radio this source needs is switched off.
            val radioOff = (src.type == SourceType.NTP && !networkAvailable.value) ||
                (src.type == SourceType.BLE_CTS && !bluetoothOn.value) ||
                (src.type == SourceType.GPS && !gnss.supported)
            if (src.enabled && t != null && t.status == SourceStatus.ERROR && !radioOff) {
                val since = errorSince.getOrPut(src.id) { now }
                if (now - since > 60_000) {
                    alerts.post(key, ctx.getString(R.string.alert_source_title, src.name), t.detail?.resolve(ctx) ?: "-")
                }
            } else {
                errorSince.remove(src.id)
                alerts.clear(key)
            }
        }
    }

    private suspend fun applyServers(cfg: SystemConfig) {
        // The NTP server only runs while a Wi-Fi / mobile / Ethernet network is up.
        val online = networkAvailable.value
        val wantNtp = cfg.ntpServer.takeIf { it.enabled && online }
        if (wantNtp != runningNtp) {
            runningNtp = wantNtp
            if (wantNtp != null) ntpServer.start(wantNtp) else ntpServer.stop()
        }
        if (cfg.ntpServer.enabled && !online) {
            ntpServerState.value = NtpServerState(running = false, port = cfg.ntpServer.listenPort, waitingForNetwork = true)
        }
        // The BLE server only runs while Bluetooth is switched on.
        val wantBle = cfg.bleCts.enabled && hasBlePermission.value && bluetoothOn.value
        if (wantBle && cfg.bleCts != runningBle) {
            runningBle = cfg.bleCts
            withContext(Dispatchers.Main) { bleServer.start(cfg.bleCts) }
        } else if (!wantBle && runningBle != null) {
            runningBle = null
            withContext(Dispatchers.Main) { bleServer.stop() }
        }
        if (cfg.bleCts.enabled && !hasBlePermission.value) {
            bleServerState.value = BleServerState(error = res(R.string.err_ble_perm))
        } else if (cfg.bleCts.enabled && !bluetoothOn.value) {
            bleServerState.value = BleServerState(waitingForBluetooth = true)
        }
    }

    private suspend fun feedSources(cfg: SystemConfig, now: Long) {
        if (networkRegained.getAndSet(false)) runtime.values.forEach { it.lastPoll = 0 }
        val gpsWanted = cfg.sources.any { it.type == SourceType.GPS && it.enabled }
        val bleWanted = cfg.sources.firstOrNull { it.type == SourceType.BLE_CTS && it.enabled }

        for (s in cfg.sources) {
            if (!s.enabled) continue
            val rt = runtime.getOrPut(s.id) { Runtime() }
            when (s.type) {
                SourceType.NTP -> {
                    val pollMs = max(4, s.pollIntervalSec) * 1000L
                    // After a failed poll retry soon (5 s) instead of waiting out a long poll interval.
                    val dueMs = if (rt.error != null) min(pollMs, 5_000L) else pollMs
                    if (now - rt.lastPoll >= dueMs && rt.inFlight.compareAndSet(false, true)) {
                        rt.lastPoll = now
                        scope.launch(Dispatchers.IO) {
                            try {
                                val (h, p) = splitHostPort(s.hostOrPort)
                                val r = NtpClient.query(h, p, 2500)
                                record(rt, r.offsetMs, r.delayMs, System.currentTimeMillis())
                                rt.detail = res(R.string.src_detail_ntp, r.stratum, r.refId)
                            } catch (e: Exception) {
                                rt.error = raw(e)
                            } finally {
                                rt.inFlight.set(false)
                            }
                        }
                    }
                }
                SourceType.GPS -> {
                    if (!gnss.supported) {
                        rt.error = res(R.string.err_gnss_unsupported)
                    } else if (!hasLocationPermission.value) {
                        rt.error = res(R.string.err_location_perm)
                    } else {
                        gnss.latest?.let { fix ->
                            if (fix.atMs != rt.sample?.at) record(rt, fix.offsetMs, 0.0, fix.atMs)
                        }
                        rt.detail = gnss.latest?.let { res(R.string.src_detail_gnss_acc, it.accuracyM.toDouble()) } ?: res(R.string.src_detail_gnss_wait)
                    }
                }
                SourceType.BLE_CTS -> if (!hasBlePermission.value) rt.error = res(R.string.err_ble_perm)
            }
        }

        // Start/stop the hardware-bound sources on the main thread.
        withContext(Dispatchers.Main) {
            if (gpsWanted && gnss.supported && hasLocationPermission.value) gnss.start() else gnss.stop()
            if (bleWanted != null && hasBlePermission.value && bluetoothOn.value) bleClient.start(bleWanted.deviceAddress) else if (bleClient.isRunning) bleClient.stop()
        }
        gnssState.value = GnssState(
            supported = gnss.supported,
            active = gnss.active,
            satsUsed = gnss.satsUsed,
            satsVisible = gnss.satsVisible,
            accuracyM = gnss.latest?.accuracyM ?: 0f,
            hasFix = gnss.latest != null,
        )
    }

    private fun record(rt: Runtime, offsetMs: Double, delayMs: Double, at: Long) {
        synchronized(rt.offsets) {
            rt.offsets.addLast(offsetMs)
            while (rt.offsets.size > 8) rt.offsets.removeFirst()
        }
        rt.sample = Sample(offsetMs, delayMs, at)
        rt.error = null
    }

    private fun jitterOf(rt: Runtime): Double = synchronized(rt.offsets) {
        if (rt.offsets.size < 2) return 0.0
        val mean = rt.offsets.average()
        sqrt(rt.offsets.sumOf { (it - mean) * (it - mean) } / rt.offsets.size)
    }

    private data class Cand(val s: SourceConfig, val offset: Double, val delay: Double, val jitter: Double)

    private fun fuse(cfg: SystemConfig, now: Long) {
        val tel = HashMap<String, SourceTelemetry>()
        val cands = mutableListOf<Cand>()

        for (s in cfg.sources) {
            val rt = runtime.getOrPut(s.id) { Runtime() }
            if (!s.enabled) {
                tel[s.id] = SourceTelemetry(status = SourceStatus.STANDBY, detail = res(R.string.src_detail_disabled))
                continue
            }
            val smp = rt.sample
            val pollMs = max(1, s.pollIntervalSec) * 1000L
            val off = radioOff(s)
            val fresh = !off && smp != null && now - smp.at <= freshWindowMs(s.pollIntervalSec)
            if (now - rt.lastReachShift >= pollMs) {
                rt.reach = ((rt.reach shl 1) or (if (fresh) 1 else 0)) and 0xFF
                rt.lastReachShift = now
            }
            val jitter = jitterOf(rt)
            if (fresh && smp != null) cands += Cand(s, smp.offsetMs, smp.delayMs, jitter)
            val st = when {
                off -> SourceStatus.STANDBY
                smp == null -> if (rt.error != null) SourceStatus.ERROR else SourceStatus.STANDBY
                !fresh -> SourceStatus.ERROR
                else -> SourceStatus.CANDIDATE
            }
            tel[s.id] = SourceTelemetry(
                lastSeen = smp?.at ?: 0, offsetMs = smp?.offsetMs ?: 0.0, delayMs = smp?.delayMs ?: 0.0,
                jitterMs = jitter, reach = rt.reach, status = st,
                detail = when {
                    off && s.type == SourceType.NTP -> res(R.string.err_no_network)
                    off -> res(R.string.bc_bt_off)
                    else -> rt.error ?: rt.detail ?: if (smp == null) res(R.string.src_detail_waiting) else null
                },
            )
        }

        // Outlier rejection (needs >= 3 sources to have a meaningful median).
        val inliers = if (cands.size >= 3) {
            val sorted = cands.map { it.offset }.sorted()
            val med = sorted[sorted.size / 2]
            cands.filter { abs(it.offset - med) <= max(50.0, 5 * it.jitter) }
        } else cands
        for (c in cands) {
            tel[c.s.id]?.let { t ->
                tel[c.s.id] = t.copy(status = if (c in inliers) SourceStatus.LOCKED else SourceStatus.OUTLIER)
            }
        }

        val d = cfg.disciplining
        val weighted = inliers.filter { it.s.weight > 0 }.ifEmpty { inliers }
        if (weighted.isNotEmpty()) {
            val target = if (d.algorithm == "marzullo") {
                weighted.map { it.offset }.sorted().let { it[it.size / 2] }
            } else {
                var wSum = 0.0
                var acc = 0.0
                for (c in weighted) {
                    val w = (if (c.s.weight > 0) c.s.weight else 1.0) * (if (d.preferStratum1 && c.s.stratum <= 1) 2.0 else 1.0)
                    wSum += w
                    acc += w * c.offset
                }
                acc / wSum
            }
            if (!hasLock) {
                fusedOffsetMs = target
                hasLock = true
            } else {
                val tau = max(1, d.pllTimeConstantSec).toDouble()
                val alpha = min(1.0, 1.0 / tau + if (d.algorithm == "pll_fll") d.fllBandwidthHz else 0.0)
                val err = target - fusedOffsetMs
                fusedOffsetMs += if (abs(err) > 128.0) err else (err * alpha).coerceIn(-d.maxSlewPpm * 1e-3, d.maxSlewPpm * 1e-3)
            }
            holdoverSec = 0
            lastDisciplineMs = now
            rootDelayMs = inliers.minOf { it.delay }
            rootDispMs = inliers.maxOf { it.jitter } + rootDelayMs / 2
            curRefId = when (weighted.minByOrNull { it.s.stratum }?.s?.type) {
                SourceType.GPS -> "GPS"
                SourceType.NTP -> "NTP"
                SourceType.BLE_CTS -> "BLE"
                else -> "HOLD"
            }
        } else if (hasLock) {
            holdoverSec++
            rootDispMs += 0.001 // assume 1 ppm free-running error
            curRefId = "HOLD"
        }
        curStratum = when {
            !hasLock -> 16
            holdoverSec > d.holdoverTimeoutSec -> 16
            else -> cfg.ntpServer.stratum
        }

        fusedTrail.addLast(now to fusedOffsetMs)
        while (fusedTrail.size > 1 && now - fusedTrail.first().first > 60_000) fusedTrail.removeFirst()
        val drift = if (fusedTrail.size >= 10) {
            val (t0, o0) = fusedTrail.first()
            val dt = (now - t0) / 1000.0
            if (dt > 0) (fusedOffsetMs - o0) / dt * 1e6 else 0.0
        } else 0.0

        for ((id, t) in tel) {
            val prev = lastStatus.put(id, t.status)
            if (prev != null && prev != t.status) Log.i("TimeServices", "source $id: $prev -> ${t.status} (${t.detail?.resolve(ctx)})")
        }
        telemetry.value = tel
        status.value = ClockStatus(
            offsetNs = (fusedOffsetMs * 1e6).toLong(),
            driftPpb = drift,
            rootDispersionMs = rootDispMs,
            rootDelayMs = rootDelayMs,
            precisionExponent = -10,
            activeStratum = curStratum,
            lockedRefId = curRefId,
            lastDisciplineMs = lastDisciplineMs,
            synced = hasLock && curStratum < 16,
            holdoverSec = holdoverSec,
        )

        fun avg(t: SourceType, f: (Cand) -> Double): Double? =
            inliers.filter { it.s.type == t }.map(f).ifEmpty { null }?.average()
        history.update { list ->
            (list + TelemetryPoint(
                timestamp = now,
                fusedOffsetMs = fusedOffsetMs,
                driftPpb = drift,
                ntpOffsetMs = avg(SourceType.NTP) { it.offset },
                ntpDelayMs = avg(SourceType.NTP) { it.delay },
                gpsOffsetMs = avg(SourceType.GPS) { it.offset },
                bleOffsetMs = avg(SourceType.BLE_CTS) { it.offset },
                bleDelayMs = avg(SourceType.BLE_CTS) { it.delay },
            )).takeLast(900)
        }
    }

    companion object {
        const val PUBLISH_FUSED = "fused"
        const val PUBLISH_SYSTEM = "system"

        fun splitHostPort(text: String): Pair<String, Int> {
            val t = text.trim()
            val i = t.lastIndexOf(':')
            return if (i > 0 && t.indexOf(':') == i) t.substring(0, i) to (t.substring(i + 1).toIntOrNull() ?: 123) else t to 123
        }

        fun timeLabel(ms: Long): String = SimpleDateFormat("HH:mm:ss", Locale.US).format(Date(ms))
    }
}
