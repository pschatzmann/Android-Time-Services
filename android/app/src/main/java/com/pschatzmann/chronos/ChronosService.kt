package com.pschatzmann.chronos

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch

/**
 * Foreground service that keeps the process (and so the NTP / BLE CTS servers and their time
 * sources) alive while the app is closed. It stops itself once no server is enabled.
 */
class ChronosService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var observer: Job? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private var lastText = ""

    private val engine: ChronosEngine get() = (application as ChronosApp).engine

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL, getString(R.string.notif_channel_name), NotificationManager.IMPORTANCE_LOW),
        )
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            engine.stopPublishing()
            stopSelf()
            return START_NOT_STICKY
        }
        engine.refreshPermissions()
        try {
            ServiceCompat.startForeground(this, NOTIF_ID, buildNotification(getString(R.string.notif_starting)), foregroundType())
        } catch (e: Exception) {
            // e.g. restarted from the background by the system, where location/Bluetooth FGS are refused
            Log.w("Chronos", "cannot enter foreground", e)
            engine.alerts.post("service", getString(R.string.alert_service_title), getString(R.string.alert_service_text))
            stopSelf()
            return START_NOT_STICKY
        }
        engine.alerts.clear("service")
        engine.setServiceRunning(true)
        if (observer == null) observer = scope.launch { observe() }
        return START_STICKY
    }

    private suspend fun observe() {
        combine(engine.config, engine.ntpServerState, engine.bleServerState) { c, n, b -> Triple(c, n, b) }
            .collect { (cfg, ntp, ble) ->
                if (!engine.backgroundWanted(cfg)) {
                    stopSelf()
                    return@collect
                }
                updateLocks(cfg)
                val parts = buildList {
                    if (cfg.ntpServer.enabled) {
                        add(if (ntp.waitingForNetwork) getString(R.string.notif_ntp_waiting) else ntp.error?.resolve(this@ChronosService) ?: getString(R.string.notif_ntp, ntp.port.takeIf { it > 0 } ?: cfg.ntpServer.listenPort, ntp.packetsServed))
                    }
                    if (cfg.bleCts.enabled) {
                        add(if (ble.waitingForBluetooth) getString(R.string.notif_ble_waiting) else ble.error?.resolve(this@ChronosService) ?: getString(R.string.notif_ble, ble.connected))
                    }
                }
                val text = parts.joinToString(" · ")
                if (text != lastText) {
                    lastText = text
                    getSystemService(NotificationManager::class.java).notify(NOTIF_ID, buildNotification(text))
                }
            }
    }

    private fun foregroundType(): Int {
        if (Build.VERSION.SDK_INT < 29) return 0
        if (Build.VERSION.SDK_INT < 34) return ServiceInfo.FOREGROUND_SERVICE_TYPE_MANIFEST
        val cfg = engine.config.value
        var type = ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
        val wantsBle = cfg.bleCts.enabled || cfg.sources.any { it.type == SourceType.BLE_CTS && it.enabled }
        if (wantsBle && engine.hasBlePermission.value) type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
        val wantsGps = cfg.sources.any { it.type == SourceType.GPS && it.enabled }
        if (wantsGps && engine.hasLocationPermission.value) type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
        return type
    }

    private fun buildNotification(text: String) =
        NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_clock)
            .setContentTitle(getString(R.string.notif_title))
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setContentIntent(
                PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE),
            )
            .addAction(
                0, getString(R.string.notif_stop),
                PendingIntent.getService(
                    this, 1, Intent(this, ChronosService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE,
                ),
            )
            .build()

    @Suppress("DEPRECATION")
    private fun updateLocks(cfg: SystemConfig) {
        if (cfg.keepAwake) {
            if (wakeLock == null) {
                val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "chronos:server").apply { acquire() }
            }
            if (wifiLock == null) {
                val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
                val mode = if (Build.VERSION.SDK_INT >= 29) WifiManager.WIFI_MODE_FULL_LOW_LATENCY else WifiManager.WIFI_MODE_FULL_HIGH_PERF
                wifiLock = wm.createWifiLock(mode, "chronos:wifi").apply { acquire() }
            }
        } else {
            releaseLocks()
        }
    }

    private fun releaseLocks() {
        wakeLock?.takeIf { it.isHeld }?.release()
        wifiLock?.takeIf { it.isHeld }?.release()
        wakeLock = null
        wifiLock = null
    }

    override fun onDestroy() {
        releaseLocks()
        observer = null
        scope.cancel()
        engine.setServiceRunning(false)
        super.onDestroy()
    }

    companion object {
        private const val CHANNEL = "chronos_services"
        private const val NOTIF_ID = 1
        private const val ACTION_STOP = "com.pschatzmann.chronos.STOP"

        fun start(ctx: Context) {
            ContextCompat.startForegroundService(ctx, Intent(ctx, ChronosService::class.java))
        }
    }
}
