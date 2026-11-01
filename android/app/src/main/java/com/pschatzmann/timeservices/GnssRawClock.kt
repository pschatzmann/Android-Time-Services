package com.pschatzmann.timeservices

import android.annotation.SuppressLint
import android.content.Context
import android.location.GnssMeasurementsEvent
import android.location.LocationManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import android.util.Log
import java.util.concurrent.Executor
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.sqrt
import kotlin.random.Random

enum class RawStatus { OFF, WAITING, ACTIVE, UNSUPPORTED }

/** Offset of the phone's wall clock from GPS-derived UTC, with the estimated uncertainty. */
data class RawFix(val offsetMs: Double, val uncertaintyUs: Double, val atMs: Long)

/**
 * Optional, more precise GNSS time source: reads the receiver's raw clock (GnssClock) instead of the
 * rounded Location.time. It only becomes ACTIVE on phones that report the full clock bias and a
 * boot-clock timestamp for it; on all other phones it ends up UNSUPPORTED and the caller falls back.
 *
 * GPS time = timeNanos - (fullBiasNanos + biasNanos); UTC = GPS time + GPS epoch - leap seconds.
 * That instant is then compared with the wall clock at the same moment, which is reconstructed from
 * many randomly timed (wall, boot clock) pairs because System.currentTimeMillis() has 1 ms resolution.
 */
@SuppressLint("MissingPermission")
class GnssRawClock(ctx: Context) {
    private val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager

    @Volatile var status = RawStatus.OFF
        private set
    @Volatile var detail: UiText? = null
        private set
    @Volatile var latest: RawFix? = null
        private set

    private var thread: HandlerThread? = null
    private var handler: Handler? = null
    private var registered = false

    private val lock = Any()
    private val bootNs = LongArray(CAP)
    private val wallMinusBoot = LongArray(CAP)
    private var head = 0
    private var count = 0

    private val recent = ArrayDeque<Double>()
    private var lastDiscontinuity = Int.MIN_VALUE
    private var startedAt = 0L
    private var lastLog = 0L

    private val sampler = object : Runnable {
        override fun run() {
            val boot = SystemClock.elapsedRealtimeNanos()
            val wall = System.currentTimeMillis() * 1_000_000L
            synchronized(lock) {
                bootNs[head] = boot
                wallMinusBoot[head] = wall - boot
                head = (head + 1) % CAP
                if (count < CAP) count++
            }
            handler?.postDelayed(this, 20L + Random.nextLong(0, 40))
        }
    }

    @Suppress("DEPRECATION")
    private val callback = object : GnssMeasurementsEvent.Callback() {
        override fun onGnssMeasurementsReceived(event: GnssMeasurementsEvent) {
            try {
                handle(event)
            } catch (e: Exception) {
                Log.w(TAG, "raw clock event failed", e)
            }
        }

        override fun onStatusChanged(status: Int) {
            if (status == STATUS_NOT_SUPPORTED) unsupported(res(R.string.gnss_raw_unsupported))
        }
    }

    fun start() {
        // UNSUPPORTED sticks until stop() (e.g. the user toggles the option), so we do not retry every tick.
        if (registered || status == RawStatus.UNSUPPORTED) return
        status = RawStatus.WAITING
        detail = null
        latest = null
        recent.clear()
        lastDiscontinuity = Int.MIN_VALUE
        startedAt = SystemClock.elapsedRealtime()
        val t = HandlerThread("gnss-raw").also { it.start() }
        thread = t
        val h = Handler(t.looper)
        handler = h
        h.post(sampler)
        val ok = try {
            if (Build.VERSION.SDK_INT >= 30) {
                lm.registerGnssMeasurementsCallback(Executor { h.post(it) }, callback)
            } else {
                @Suppress("DEPRECATION")
                lm.registerGnssMeasurementsCallback(callback, h)
            }
        } catch (e: Exception) {
            false
        }
        registered = ok
        if (!ok) unsupported(res(R.string.gnss_raw_unsupported))
    }

    fun stop() {
        if (registered) {
            try {
                lm.unregisterGnssMeasurementsCallback(callback)
            } catch (_: Exception) {
            }
        }
        registered = false
        handler?.removeCallbacksAndMessages(null)
        thread?.quitSafely()
        thread = null
        handler = null
        synchronized(lock) {
            head = 0
            count = 0
        }
        status = RawStatus.OFF
        detail = null
        latest = null
    }

    private fun unsupported(why: UiText) {
        status = RawStatus.UNSUPPORTED
        detail = why
        latest = null
    }

    private fun handle(event: GnssMeasurementsEvent) {
        if (status == RawStatus.UNSUPPORTED) return
        val clock = event.clock
        if (!clock.hasFullBiasNanos()) {
            // Many phones never report the full clock bias; give them 30 s, then stop trying.
            if (latest == null && SystemClock.elapsedRealtime() - startedAt > 30_000) {
                unsupported(res(R.string.gnss_raw_nobias))
            }
            return
        }
        if (Build.VERSION.SDK_INT < 30 || !clock.hasElapsedRealtimeNanos()) {
            // Without a boot-clock timestamp the reading cannot be tied to the wall clock precisely.
            unsupported(res(R.string.gnss_raw_notimestamp))
            return
        }
        if (clock.hardwareClockDiscontinuityCount != lastDiscontinuity) {
            lastDiscontinuity = clock.hardwareClockDiscontinuityCount
            recent.clear()
        }

        val leap = if (clock.hasLeapSecond()) clock.leapSecond else 18
        val unixNs = (clock.timeNanos - clock.fullBiasNanos) + GPS_EPOCH_UNIX_NS - leap * 1_000_000_000L
        val bias = if (clock.hasBiasNanos()) clock.biasNanos else 0.0
        val wallAtMeasurement = wallClockAt(clock.elapsedRealtimeNanos) ?: return

        var varianceNs2 = MAPPING_SIGMA_NS * MAPPING_SIGMA_NS
        if (clock.hasTimeUncertaintyNanos()) varianceNs2 += clock.timeUncertaintyNanos.let { it * it }
        if (clock.hasBiasUncertaintyNanos()) varianceNs2 += clock.biasUncertaintyNanos.let { it * it }
        if (clock.hasElapsedRealtimeUncertaintyNanos()) varianceNs2 += clock.elapsedRealtimeUncertaintyNanos.let { it * it }
        val uncertaintyNs = sqrt(varianceNs2)
        if (uncertaintyNs > MAX_UNCERTAINTY_NS) return

        // offset = true time - wall clock, the same convention as every other source
        val offsetMs = ((unixNs - wallAtMeasurement).toDouble() - bias) / 1e6
        recent.addLast(offsetMs)
        while (recent.size > 15) recent.removeFirst()
        if (recent.size < 5) return

        val sorted = recent.sorted()
        val median = sorted[sorted.size / 2]
        val mad = recent.map { abs(it - median) }.sorted().let { it[it.size / 2] }
        val uncertaintyUs = max(uncertaintyNs / 1e3, 1.4826 * mad * 1e3)
        latest = RawFix(median, uncertaintyUs, System.currentTimeMillis())
        status = RawStatus.ACTIVE
        detail = null

        val now = SystemClock.elapsedRealtime()
        if (now - lastLog > 10_000) {
            lastLog = now
            Log.i(TAG, "raw GNSS clock: offset=%.3f ms +-%.0f us (%d samples)".format(median, uncertaintyUs, recent.size))
        }
    }

    /** Wall-clock time (ns) at boot-clock instant [bootTargetNs], from a line fitted to nearby samples. */
    private fun wallClockAt(bootTargetNs: Long): Long? = synchronized(lock) {
        var n = 0
        var sx = 0.0
        var sy = 0.0
        var sxx = 0.0
        var sxy = 0.0
        var ref = 0L
        for (i in 0 until count) {
            val idx = ((head - count + i) % CAP + CAP) % CAP
            val dt = (bootNs[idx] - bootTargetNs) / 1e9
            if (abs(dt) > 3.0) continue
            if (n == 0) ref = wallMinusBoot[idx]
            val y = (wallMinusBoot[idx] - ref).toDouble()
            n++
            sx += dt
            sy += y
            sxx += dt * dt
            sxy += dt * y
        }
        if (n < 20) return null
        val den = n * sxx - sx * sx
        val intercept = if (abs(den) < 1e-9) sy / n else (sy * sxx - sx * sxy) / den
        // currentTimeMillis() truncates to whole ms, so the samples sit 0.5 ms low on average.
        bootTargetNs + ref + Math.round(intercept) + 500_000L
    }

    private companion object {
        const val TAG = "TimeServices"
        const val CAP = 400
        const val GPS_EPOCH_UNIX_NS = 315_964_800L * 1_000_000_000L
        const val MAPPING_SIGMA_NS = 80_000.0
        const val MAX_UNCERTAINTY_NS = 2_000_000.0
    }
}
