package com.pschatzmann.chronos.ui

import com.pschatzmann.chronos.R
import androidx.compose.ui.res.stringResource
import android.media.AudioManager
import android.media.ToneGenerator
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.VolumeOff
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pschatzmann.chronos.ChronosEngine
import com.pschatzmann.chronos.TimeZoneEngine
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

private val dateFmt = DateTimeFormatter.ofPattern("yyyy-MM-dd")
private val timeFmt = DateTimeFormatter.ofPattern("HH:mm:ss")

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ClockScreen(vm: ChronosEngine) {
    val st by vm.status.collectAsStateWithLifecycle()
    var scale by rememberSaveable { mutableStateOf("local") }
    var tzId by rememberSaveable { mutableStateOf(TimeZoneEngine.AUTO) }
    var pickerOpen by remember { mutableStateOf(false) }
    var audio by remember { mutableStateOf(false) }
    var nowMs by remember { mutableLongStateOf(vm.nowMs()) }

    LaunchedEffect(Unit) {
        while (true) {
            withFrameMillis { }
            nowMs = vm.nowMs()
        }
    }

    val tone = remember { ToneGenerator(AudioManager.STREAM_MUSIC, 60) }
    DisposableEffect(Unit) { onDispose { tone.release() } }
    LaunchedEffect(audio) {
        if (!audio) return@LaunchedEffect
        var last = -1L
        while (true) {
            withFrameMillis { }
            val sec = vm.nowMs() / 1000
            if (sec != last) {
                if (last != -1L) tone.startTone(ToneGenerator.TONE_PROP_BEEP, 15)
                last = sec
            }
        }
    }

    val tz = remember(nowMs / 60_000, tzId) { TimeZoneEngine.details(nowMs, tzId) }
    val shown = when (scale) {
        "utc" -> Instant.ofEpochMilli(nowMs).atZone(ZoneOffset.UTC) to "UTC"
        "tai" -> Instant.ofEpochMilli(nowMs + st.leapSecondsTai * 1000L).atZone(ZoneOffset.UTC) to stringResource(R.string.clock_tai_label, st.leapSecondsTai)
        "gps" -> Instant.ofEpochMilli(nowMs + st.leapSecondsGps * 1000L).atZone(ZoneOffset.UTC) to stringResource(R.string.clock_gps_label, st.leapSecondsGps)
        else -> Instant.ofEpochMilli(nowMs).atZone(TimeZoneEngine.zone(tzId)) to "${tz.shortName} (${tz.offsetFormatted})"
    }
    val ms = Math.floorMod(nowMs, 1000L)

    Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        ChronosCard {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Chip(
                    if (st.synced) "STRATUM ${st.activeStratum} · REF ${st.lockedRefId}" else stringResource(R.string.clock_chip_unsynced),
                    if (st.synced) Emerald else Amber,
                )
                Text(shown.first.format(dateFmt), fontFamily = Mono, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(shown.first.format(timeFmt), fontFamily = Mono, fontWeight = FontWeight.Bold, fontSize = 52.sp)
                Text(".%03d".format(ms), fontFamily = Mono, fontWeight = FontWeight.SemiBold, fontSize = 24.sp, color = Cyan)
                Text(shown.second, fontFamily = Mono, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    listOf("local" to stringResource(R.string.clock_scale_local), "utc" to "UTC", "tai" to "TAI", "gps" to "GPS").forEach { (k, label) ->
                        FilterChip(selected = scale == k, onClick = { scale = k }, label = { Text(label, fontFamily = Mono) })
                    }
                    IconButton(onClick = { audio = !audio }, Modifier.size(36.dp)) {
                        Icon(if (audio) Icons.Default.VolumeUp else Icons.Default.VolumeOff, stringResource(R.string.cd_pps_click), tint = if (audio) Cyan else MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }

        ChronosCard {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column {
                    Text(stringResource(R.string.tz_header), fontFamily = Mono, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(tz.displayName, fontWeight = FontWeight.SemiBold)
                }
                TextButton(onClick = { pickerOpen = !pickerOpen }) { Text(stringResource(R.string.tz_change)) }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatTile("IANA", tz.iana, Modifier.weight(1f), Color_text())
                StatTile(stringResource(R.string.tile_utc_offset), tz.offsetFormatted, Modifier.weight(1f), Cyan)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatTile(stringResource(R.string.tile_dst), if (tz.isDst) stringResource(R.string.dst_active) else stringResource(R.string.dst_standard), Modifier.weight(1f), if (tz.isDst) Amber else Emerald)
                StatTile("BLE CTS 0x2A0F", stringResource(R.string.tz_ble_value, tz.quarterHours, tz.dstOffsetCode), Modifier.weight(1f), Blue)
            }
            tz.nextTransition?.let { nt ->
                val hours = if (nt.gapHours % 1.0 == 0.0) nt.gapHours.toInt().toString() else nt.gapHours.toString()
                Text(
                    if (nt.gapHours > 0) stringResource(R.string.tz_next_forward, hours, nt.date)
                    else stringResource(R.string.tz_next_back, hours, nt.date),
                    fontFamily = Mono, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (pickerOpen) {
                HorizontalDivider()
                TimeZoneEngine.popular.forEach { id ->
                    Text(
                        when (id) {
                            TimeZoneEngine.AUTO -> stringResource(R.string.tz_auto)
                            "UTC" -> "UTC"
                            else -> "$id (${TimeZoneEngine.zoneName(id)})"
                        },
                        Modifier.fillMaxWidth().clickable { tzId = id; pickerOpen = false }.padding(vertical = 8.dp),
                        fontFamily = Mono, fontSize = 12.sp,
                        color = if (id == tzId) Cyan else MaterialTheme.colorScheme.onSurface,
                        fontWeight = if (id == tzId) FontWeight.Bold else FontWeight.Normal,
                    )
                }
            }
        }

        Text(stringResource(R.string.sync_header), fontFamily = Mono, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StatTile(stringResource(R.string.tile_offset_vs_system), "%+.3f ms".format(st.offsetNs / 1e6), Modifier.weight(1f), Emerald)
            StatTile(stringResource(R.string.tile_drift), "%+.1f ppb".format(st.driftPpb), Modifier.weight(1f), Cyan)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StatTile(stringResource(R.string.tile_root_disp), "%.2f ms".format(st.rootDispersionMs), Modifier.weight(1f), Amber)
            StatTile(stringResource(R.string.tile_root_delay), "%.2f ms".format(st.rootDelayMs), Modifier.weight(1f), Purple)
        }
        Text(
            stringResource(R.string.clock_note),
            fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Start,
        )
    }
}

@Composable
private fun Color_text() = MaterialTheme.colorScheme.onSurface
