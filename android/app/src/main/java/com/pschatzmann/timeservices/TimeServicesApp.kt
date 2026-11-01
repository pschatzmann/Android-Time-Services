package com.pschatzmann.timeservices

import android.app.Application

/** Owns the process-wide [TimeEngine] so the UI and [TimeService] share one instance. */
class TimeServicesApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Safety.install(this)
    }

    val engine: TimeEngine by lazy { TimeEngine(this) }
}
