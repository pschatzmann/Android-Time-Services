package com.pschatzmann.chronos.ui

/** Compact human-readable interval, e.g. 1500 -> "1.5 s", 120000 -> "2 min". */
fun formatInterval(ms: Int): String = when {
    ms % 3_600_000 == 0 -> "${ms / 3_600_000} h"
    ms % 60_000 == 0 -> "${ms / 60_000} min"
    ms % 1_000 == 0 -> "${ms / 1_000} s"
    ms > 1_000 -> "${(ms / 100) / 10.0} s"
    else -> "$ms ms"
}
