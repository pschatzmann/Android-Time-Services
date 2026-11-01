package com.pschatzmann.timeservices.ui

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.pschatzmann.timeservices.R
import com.pschatzmann.timeservices.SourceConfig
import com.pschatzmann.timeservices.GnssState
import com.pschatzmann.timeservices.RawStatus
import com.pschatzmann.timeservices.SourceStatus
import com.pschatzmann.timeservices.asString

@Composable
fun SourceStatus.label(): String = stringResource(
    when (this) {
        SourceStatus.LOCKED -> R.string.status_locked
        SourceStatus.CANDIDATE -> R.string.status_candidate
        SourceStatus.OUTLIER -> R.string.status_outlier
        SourceStatus.STANDBY -> R.string.status_standby
        SourceStatus.ERROR -> R.string.status_error
    },
)

/**
 * The built-in sources are stored with English names; show them in the current language unless the
 * user has renamed them.
 */
private fun builtInNameRes(src: SourceConfig): Int? = when {
    src.id == "src_gps" && src.name.equals("Phone GNSS (Location API)", ignoreCase = true) -> R.string.src_gps
    src.id == "src_ble_cts" && src.name.equals("BLE CTS Peripheral", ignoreCase = true) -> R.string.src_ble_cts
    else -> null
}

@Composable
fun SourceConfig.displayName(): String = builtInNameRes(this)?.let { stringResource(it) } ?: name

fun SourceConfig.displayName(ctx: Context): String = builtInNameRes(this)?.let { ctx.getString(it) } ?: name

/** One-line status of the optional raw GNSS clock, for the Settings and Sources screens. */
@Composable
fun gnssRawStatusText(g: GnssState, enabled: Boolean): String = when {
    !g.supported -> stringResource(R.string.err_gnss_unsupported)
    !enabled -> stringResource(R.string.gnss_raw_off)
    else -> when (g.rawStatus) {
        RawStatus.OFF -> stringResource(R.string.gnss_raw_waiting)
        RawStatus.WAITING -> stringResource(R.string.gnss_raw_waiting)
        RawStatus.ACTIVE -> stringResource(R.string.gnss_raw_active, g.rawUncertaintyUs)
        RawStatus.UNSUPPORTED -> g.rawDetail?.asString() ?: stringResource(R.string.gnss_raw_unsupported)
    }
}
