package com.pschatzmann.timeservices.ui

import com.pschatzmann.timeservices.R
import androidx.compose.ui.res.stringResource
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.SatelliteAlt
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pschatzmann.timeservices.TimeEngine
import com.pschatzmann.timeservices.asString
import com.pschatzmann.timeservices.SourceConfig
import com.pschatzmann.timeservices.SourceStatus
import com.pschatzmann.timeservices.SourceTelemetry
import com.pschatzmann.timeservices.SourceType
import com.pschatzmann.timeservices.net.NtpResult
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

private fun statusColor(s: SourceStatus) = when (s) {
    SourceStatus.LOCKED -> Emerald
    SourceStatus.CANDIDATE -> Cyan
    SourceStatus.OUTLIER -> Amber
    SourceStatus.STANDBY -> Color(0xFF64748B)
    SourceStatus.ERROR -> Rose
}

private fun icon(t: SourceType): ImageVector = when (t) {
    SourceType.GPS -> Icons.Default.SatelliteAlt
    SourceType.NTP -> Icons.Default.Language
    SourceType.BLE_CTS -> Icons.Default.Bluetooth
}

@Composable
fun SourcesScreen(vm: TimeEngine, requestPermissions: () -> Unit) {
    val cfg by vm.config.collectAsStateWithLifecycle()
    val tel by vm.telemetry.collectAsStateWithLifecycle()
    val gnss by vm.gnssState.collectAsStateWithLifecycle()
    val bleState by vm.bleClientState.collectAsStateWithLifecycle()
    val hasLoc by vm.hasLocationPermission.collectAsStateWithLifecycle()
    val hasBle by vm.hasBlePermission.collectAsStateWithLifecycle()
    var expanded by rememberSaveable { mutableStateOf<String?>(null) }

    Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        ScreenTitle(
            stringResource(R.string.sources_title),
            stringResource(R.string.sources_subtitle),
        )
        cfg.sources.forEach { src ->
            val t = tel[src.id] ?: SourceTelemetry()
            SourceCard(
                src, t, expanded == src.id,
                onToggleExpand = { expanded = if (expanded == src.id) null else src.id },
                onEnabled = { vm.toggleSource(src.id, it) },
                canEnable = src.type != SourceType.GPS || gnss.supported,
                onWeight = { vm.setWeight(src.id, it) },
                onTarget = { vm.setSourceTarget(src.id, it) },
            ) {
                when (src.type) {
                    SourceType.GPS -> {
                        if (!gnss.supported) {
                            Text(
                                stringResource(R.string.gnss_unsupported_note),
                                fontSize = 12.sp, color = Amber,
                            )
                        } else if (!hasLoc) {
                            Button(onClick = requestPermissions) { Text(stringResource(R.string.grant_location)) }
                        } else {
                            KeyValue(stringResource(R.string.gnss_active), stringResource(if (gnss.active) R.string.yes else R.string.no))
                            KeyValue(stringResource(R.string.gnss_sats), "${gnss.satsUsed}/${gnss.satsVisible}")
                            KeyValue(stringResource(R.string.gnss_fix), if (gnss.hasFix) stringResource(R.string.gnss_fix_yes, gnss.accuracyM.toDouble()) else stringResource(R.string.gnss_fix_waiting))
                            Text(gnssRawStatusText(gnss, cfg.gnssRawEnabled), fontFamily = Mono, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(stringResource(R.string.gnss_note), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    SourceType.BLE_CTS -> {
                        if (!hasBle) Button(onClick = requestPermissions) { Text(stringResource(R.string.grant_bluetooth)) }
                        KeyValue(stringResource(R.string.ble_client_state), bleState.asString())
                        Text(stringResource(R.string.ble_note), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    SourceType.NTP -> {}
                }
            }
        }
        NtpProber(vm)
    }
}

@Composable
private fun SourceCard(
    src: SourceConfig,
    t: SourceTelemetry,
    expanded: Boolean,
    onToggleExpand: () -> Unit,
    onEnabled: (Boolean) -> Unit,
    canEnable: Boolean,
    onWeight: (Double) -> Unit,
    onTarget: (String) -> Unit,
    extra: @Composable () -> Unit,
) {
    AppCard(Modifier.clickable(onClick = onToggleExpand)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(icon(src.type), null, tint = statusColor(t.status))
            Column(Modifier.weight(1f)) {
                Text(src.displayName(), fontWeight = FontWeight.SemiBold)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    StatusDot(statusColor(t.status))
                    Text(
                        t.status.label(),
                        fontFamily = Mono, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Switch(checked = src.enabled, onCheckedChange = onEnabled, enabled = canEnable || src.enabled)
        }
        if (src.enabled) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatTile(stringResource(R.string.tile_offset), "%+.3f ms".format(t.offsetMs), Modifier.weight(1f), Cyan, valueSize = 13.sp)
                StatTile(stringResource(R.string.tile_delay), "%.2f ms".format(t.delayMs), Modifier.weight(1f), Purple, valueSize = 13.sp)
                StatTile(stringResource(R.string.tile_jitter), "%.2f ms".format(t.jitterMs), Modifier.weight(1f), Amber, valueSize = 13.sp)
            }
        }
        if (expanded) {
            HorizontalDivider()
            KeyValue(stringResource(R.string.kv_reach), (t.reach and 0xFF).toString(8).padStart(3, '0'))
            KeyValue(stringResource(R.string.kv_stratum), src.stratum.toString())
            KeyValue(stringResource(R.string.kv_poll), stringResource(R.string.poll_value, src.pollIntervalSec))
            KeyValue(
                stringResource(R.string.kv_last_seen),
                if (t.lastSeen == 0L) stringResource(R.string.never) else SimpleDateFormat("HH:mm:ss", Locale.US).format(Date(t.lastSeen)),
            )
            t.detail?.let { Text(it.asString(), fontFamily = Mono, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            if (src.type == SourceType.NTP || src.type == SourceType.BLE_CTS) {
                var text by remember(src.id, src.hostOrPort, src.deviceAddress) {
                    mutableStateOf(if (src.type == SourceType.NTP) src.hostOrPort else src.deviceAddress)
                }
                OutlinedTextField(
                    value = text,
                    onValueChange = { text = it; onTarget(it) },
                    label = { Text(if (src.type == SourceType.NTP) stringResource(R.string.field_host) else stringResource(R.string.field_peer)) },
                    singleLine = true, modifier = Modifier.fillMaxWidth(),
                )
            }
            Text(stringResource(R.string.weight_label, src.weight), fontFamily = Mono, fontSize = 12.sp)
            Slider(value = src.weight.toFloat(), onValueChange = { onWeight(Math.round(it * 20) / 20.0) }, valueRange = 0f..1f)
            extra()
        }
    }
}

@Composable
private fun NtpProber(vm: TimeEngine) {
    val online by vm.networkAvailable.collectAsStateWithLifecycle()
    var host by rememberSaveable { mutableStateOf("time.cloudflare.com") }
    var busy by remember { mutableStateOf(false) }
    var result by remember { mutableStateOf<Result<NtpResult>?>(null) }
    val scope = rememberCoroutineScope()
    val iso = remember { SimpleDateFormat("HH:mm:ss.SSS'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") } }

    AppCard {
        Text(stringResource(R.string.ntp_analyser), fontWeight = FontWeight.SemiBold)
        OutlinedTextField(host, { host = it }, label = { Text(stringResource(R.string.field_host)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Button(
            onClick = {
                busy = true
                scope.launch {
                    try {
                        result = vm.probeNtp(host)
                    } catch (e: kotlinx.coroutines.CancellationException) {
                        throw e
                    } catch (e: Throwable) {
                        result = Result.failure(e)
                    } finally {
                        busy = false
                    }
                }
            },
            enabled = !busy && online,
        ) { Text(if (busy) stringResource(R.string.querying) else stringResource(R.string.btn_query_udp)) }
        if (!online) {
            Text(stringResource(R.string.query_offline_note), color = Rose, fontFamily = Mono, fontSize = 11.sp)
        }
        result?.fold(
            onSuccess = { r ->
                KeyValue(stringResource(R.string.tile_offset), "%+.3f ms".format(r.offsetMs), Cyan)
                KeyValue(stringResource(R.string.kv_rtt), "%.3f ms".format(r.delayMs))
                KeyValue(stringResource(R.string.kv_stratum_ref), "${r.stratum} / ${r.refId}")
                KeyValue(stringResource(R.string.kv_precision), "2^${r.precision} s")
                KeyValue(stringResource(R.string.kv_root), "%.2f / %.2f ms".format(r.rootDelayMs, r.rootDispersionMs))
                KeyValue(stringResource(R.string.kv_t1), iso.format(Date(r.t1)))
                KeyValue(stringResource(R.string.kv_t2), iso.format(Date(r.t2.toLong())))
                KeyValue(stringResource(R.string.kv_t3), iso.format(Date(r.t3.toLong())))
                KeyValue(stringResource(R.string.kv_t4), iso.format(Date(r.t4)))
                Text(r.rawHex, fontFamily = Mono, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            },
            onFailure = { Text(it.message ?: stringResource(R.string.query_failed), color = Rose, fontFamily = Mono, fontSize = 12.sp) },
        )
    }
}
