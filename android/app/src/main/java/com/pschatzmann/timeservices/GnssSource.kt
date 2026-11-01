package com.pschatzmann.timeservices

import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.GnssStatus
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Looper
import android.os.SystemClock

data class GnssFix(val offsetMs: Double, val atMs: Long, val accuracyM: Float)

/**
 * Uses the phone's GNSS receiver as a time source: Location.time is the UTC time of the fix
 * as reported by the chipset. Precision is limited by fix latency (tens of ms), not by the
 * satellite clock, so it is a coarse source compared to NTP.
 */
@SuppressLint("MissingPermission")
class GnssSource(ctx: Context) {
    private val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager

    /** False on devices without a GNSS receiver (some tablets, TVs, emulators). */
    val supported: Boolean =
        ctx.packageManager.hasSystemFeature(PackageManager.FEATURE_LOCATION_GPS) &&
            lm.allProviders.contains(LocationManager.GPS_PROVIDER)

    @Volatile var latest: GnssFix? = null
        private set
    @Volatile var satsUsed = 0
        private set
    @Volatile var satsVisible = 0
        private set
    @Volatile var active = false
        private set

    private val listener = LocationListener { loc: Location ->
        if (loc.provider != LocationManager.GPS_PROVIDER) return@LocationListener
        val ageMs = (SystemClock.elapsedRealtimeNanos() - loc.elapsedRealtimeNanos) / 1e6
        val gnssNowMs = loc.time + ageMs
        val sysNow = System.currentTimeMillis()
        latest = GnssFix(gnssNowMs - sysNow, sysNow, loc.accuracy)
    }

    private val statusCb = object : GnssStatus.Callback() {
        override fun onSatelliteStatusChanged(status: GnssStatus) {
            satsVisible = status.satelliteCount
            satsUsed = (0 until status.satelliteCount).count { status.usedInFix(it) }
        }
    }

    fun start() {
        if (active || !supported) return
        try {
            lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, listener, Looper.getMainLooper())
            @Suppress("DEPRECATION")
            lm.registerGnssStatusCallback(statusCb, null)
            active = true
        } catch (_: Exception) {
            active = false
        }
    }

    fun stop() {
        if (!active) return
        try {
            lm.removeUpdates(listener)
            lm.unregisterGnssStatusCallback(statusCb)
        } catch (_: Exception) {
        }
        active = false
        latest = null
        satsUsed = 0
        satsVisible = 0
    }
}
