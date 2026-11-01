package com.pschatzmann.chronos

import android.app.Application

/** Owns the process-wide [ChronosEngine] so the UI and [ChronosService] share one instance. */
class ChronosApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Safety.install(this)
    }

    val engine: ChronosEngine by lazy { ChronosEngine(this) }
}
