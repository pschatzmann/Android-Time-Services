package com.pschatzmann.timeservices

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import java.util.concurrent.ConcurrentHashMap

/**
 * Posts a system notification when something goes wrong and removes it again once the problem is gone.
 * Each problem has a stable key; the same text is not re-posted, and a problem that clears and
 * re-appears within [COOLDOWN_MS] does not notify again (avoids flapping sources spamming the user).
 */
class AlertNotifier(private val ctx: Context) {
    private val nm = NotificationManagerCompat.from(ctx)
    private val active = ConcurrentHashMap<String, String>()
    private val lastPostedAt = ConcurrentHashMap<String, Long>()
    private val knownClear: MutableSet<String> = ConcurrentHashMap.newKeySet()

    init {
        val channel = NotificationChannel(CHANNEL, ctx.getString(R.string.alert_channel_name), NotificationManager.IMPORTANCE_HIGH)
        ctx.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    @SuppressLint("MissingPermission") // guarded by areNotificationsEnabled()
    fun post(key: String, title: String, text: String) {
        if (active[key] == text) return
        val now = SystemClock.elapsedRealtime()
        val last = lastPostedAt[key]
        if (active[key] == null && last != null && now - last < COOLDOWN_MS) return
        active[key] = text
        lastPostedAt[key] = now
        knownClear.remove(key)
        if (!nm.areNotificationsEnabled()) return
        val open = PendingIntent.getActivity(
            ctx, key.hashCode(), Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val n = NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_clock)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setCategory(NotificationCompat.CATEGORY_ERROR)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(open)
            .build()
        nm.notify(ID_BASE + key.hashCode(), n)
    }

    fun clear(key: String) {
        val wasActive = active.remove(key) != null
        // First clear per process also cancels: a notification may outlive our in-memory state across restarts.
        if (wasActive || knownClear.add(key)) nm.cancel(ID_BASE + key.hashCode())
    }

    private companion object {
        const val CHANNEL = "timeservices_alerts"
        const val ID_BASE = 1000
        const val COOLDOWN_MS = 5 * 60 * 1000L
    }
}
