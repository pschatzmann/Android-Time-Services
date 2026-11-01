package com.pschatzmann.timeservices

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Keeps the app alive when something unexpected throws. Uncaught exceptions on any thread (and on
 * the main looper) are logged to files/crash.log, reported through an alert notification and
 * otherwise swallowed. If errors keep coming (5 within 30 s) or memory is exhausted the original
 * crash behaviour is restored, so a broken state cannot loop forever.
 */
object Safety {
    private const val TAG = "TimeServices"
    private const val MAX_LOG_BYTES = 64 * 1024
    private const val WINDOW_MS = 30_000L
    private const val MAX_IN_WINDOW = 5

    private lateinit var app: TimeServicesApp
    private var previous: Thread.UncaughtExceptionHandler? = null
    private val recent = ArrayDeque<Long>()
    private val alerts by lazy { AlertNotifier(app) }

    fun install(app: TimeServicesApp) {
        this.app = app
        previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, e ->
            if (!survive(thread.name, e)) previous?.uncaughtException(thread, e)
        }
        // Re-enter the main loop after an exception instead of letting the process die.
        Handler(Looper.getMainLooper()).post {
            while (true) {
                try {
                    Looper.loop()
                    break // looper was quit on purpose
                } catch (e: Throwable) {
                    if (!survive("main", e)) throw e
                }
            }
        }
    }

    /** Logs, records and reports [e]. Returns false when the process should be allowed to die. */
    @Synchronized
    fun survive(where: String, e: Throwable): Boolean {
        Log.e(TAG, "uncaught exception on $where", e)
        record(where, e)
        val now = SystemClock.elapsedRealtime()
        recent.addLast(now)
        while (recent.isNotEmpty() && now - recent.first() > WINDOW_MS) recent.removeFirst()
        if (e is OutOfMemoryError || recent.size >= MAX_IN_WINDOW) return false
        try {
            alerts.post("crash", app.getString(R.string.alert_crash_title), "${e.javaClass.simpleName}: ${e.message ?: where}")
        } catch (_: Throwable) {
        }
        return true
    }

    private fun record(where: String, e: Throwable) {
        try {
            val file = File(app.filesDir, "crash.log")
            if (file.length() > MAX_LOG_BYTES) {
                file.writeText(file.readText().takeLast(MAX_LOG_BYTES / 2))
            }
            val trace = StringWriter().also { e.printStackTrace(PrintWriter(it)) }.toString()
            val stamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())
            file.appendText("[$stamp] $where\n$trace\n")
        } catch (_: Throwable) {
        }
    }
}
