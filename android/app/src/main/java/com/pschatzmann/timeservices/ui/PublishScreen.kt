package com.pschatzmann.timeservices.ui

import com.pschatzmann.timeservices.R
import androidx.compose.ui.res.stringResource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pschatzmann.timeservices.TimeEngine
import com.pschatzmann.timeservices.asString
import com.pschatzmann.timeservices.TimeZoneEngine
import com.pschatzmann.timeservices.ble.CtsCodec
import com.pschatzmann.timeservices.ble.toHex
import com.pschatzmann.timeservices.net.NtpResult
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun PublishScreen(vm: TimeEngine, requestPermissions: () -> Unit, openSettings: () -> Unit) {
    val cfg by vm.config.collectAsStateWithLifecycle()
    val ntp by vm.ntpServerState.collectAsStateWithLifecycle()
    val ble by vm.bleServerState.collectAsStateWithLifecycle()
    val hasBle by vm.hasBlePermission.collectAsStateWithLifecycle()
    val sourceLabel = when (cfg.publishSourceId) {
        TimeEngine.PUBLISH_FUSED -> stringResource(R.string.src_fused)
        TimeEngine.PUBLISH_SYSTEM -> stringResource(R.string.src_system)
        else -> cfg.sources.firstOrNull { it.id == cfg.publishSourceId }?.displayName() ?: stringResource(R.string.src_missing)
    }
    var test by remember { mutableStateOf<Result<NtpResult>?>(null) }
    var testing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    // Live preview of the packet this phone would publish over BLE CTS.
    var packetHex by remember { mutableStateOf("") }
    LaunchedEffect(Unit) {
        while (true) {
            packetHex = CtsCodec.encodeCurrentTime(vm.nowMs(), TimeZoneEngine.zone(TimeZoneEngine.AUTO)).toHex()
            delay(500)
        }
    }

    Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        ScreenTitle(
            stringResource(R.string.publish_title),
            stringResource(R.string.publish_subtitle),
        )

        AppCard(accent = if (cfg.ntpServer.enabled) Cyan else null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(stringResource(R.string.ntp_server_title), fontWeight = FontWeight.SemiBold)
                    Text(
                        when {
                            ntp.waitingForNetwork -> stringResource(R.string.state_waiting_network)
                            ntp.error != null -> stringResource(R.string.state_error)
                            ntp.running -> stringResource(R.string.ntp_serving, ntp.port)
                            else -> stringResource(R.string.state_stopped)
                        },
                        fontFamily = Mono, fontSize = 12.sp,
                        color = when {
                            ntp.error != null -> Rose
                            ntp.running -> Emerald
                            else -> MaterialTheme.colorScheme.onSurfaceVariant
                        },
                    )
                }
                Switch(cfg.ntpServer.enabled, { vm.toggleNtpServer(it) })
            }
            ntp.error?.let { Text(it.asString(), color = Rose, fontFamily = Mono, fontSize = 11.sp) }
            KeyValue(stringResource(R.string.kv_time_source), sourceLabel)
            KeyValue(stringResource(R.string.kv_stratum_refid), "${cfg.ntpServer.stratum} / ${cfg.ntpServer.refId}")
            KeyValue(stringResource(R.string.kv_packets), ntp.packetsServed.toString())
            KeyValue(stringResource(R.string.kv_dropped), ntp.dropped.toString())
            KeyValue(stringResource(R.string.kv_last_client), ntp.lastClient.ifEmpty { "-" })
            Text(
                stringResource(R.string.ntp_port_note, cfg.ntpServer.listenPort),
                fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Button(
                enabled = ntp.running && !testing,
                onClick = {
                    testing = true
                    scope.launch {
                        try {
                            test = vm.probeLocalServer()
                        } catch (e: kotlinx.coroutines.CancellationException) {
                            throw e
                        } catch (e: Throwable) {
                            test = Result.failure(e)
                        } finally {
                            testing = false
                        }
                    }
                },
            ) { Text(if (testing) stringResource(R.string.querying) else stringResource(R.string.btn_test_self)) }
            test?.fold(
                onSuccess = { r ->
                    KeyValue(stringResource(R.string.kv_reply), "${r.stratum} / ${r.refId}", Emerald)
                    KeyValue(stringResource(R.string.kv_offset_loopback), "%+.3f ms".format(r.offsetMs))
                    KeyValue(stringResource(R.string.tile_delay), "%.3f ms".format(r.delayMs))
                },
                onFailure = { Text(it.message ?: stringResource(R.string.failed), color = Rose, fontFamily = Mono, fontSize = 11.sp) },
            )
        }

        AppCard(accent = if (cfg.bleCts.enabled) Blue else null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("BLE Current Time Service (0x1805)", fontWeight = FontWeight.SemiBold)
                    Text(
                        when {
                            ble.waitingForBluetooth -> stringResource(R.string.state_waiting_bluetooth)
                            ble.error != null -> stringResource(R.string.state_error)
                            ble.running -> stringResource(R.string.ble_advertising)
                            else -> stringResource(R.string.state_stopped)
                        },
                        fontFamily = Mono, fontSize = 12.sp,
                        color = when {
                            ble.error != null -> Rose
                            ble.running -> Emerald
                            else -> MaterialTheme.colorScheme.onSurfaceVariant
                        },
                    )
                }
                Switch(cfg.bleCts.enabled, { vm.toggleBleServer(it) })
            }
            ble.error?.let { Text(it.asString(), color = Rose, fontFamily = Mono, fontSize = 11.sp) }
            if (!hasBle) Button(onClick = requestPermissions) { Text(stringResource(R.string.grant_bluetooth)) }
            KeyValue(stringResource(R.string.kv_peers), ble.connected.toString())
            KeyValue(stringResource(R.string.kv_subscribers), ble.subscribers.toString())
            KeyValue(stringResource(R.string.kv_notifications), if (cfg.bleCts.sendNotifications) stringResource(R.string.notify_every, formatInterval(cfg.bleCts.notifyIntervalMs)) else stringResource(R.string.notif_off))
            Text(stringResource(R.string.ble_preview), fontFamily = Mono, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(ble.lastPacketHex.ifEmpty { packetHex }, fontFamily = Mono, fontSize = 13.sp, color = Blue)
            Text(
                stringResource(R.string.ble_note_pub),
                fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Button(onClick = openSettings) { Text(stringResource(R.string.btn_server_settings)) }
    }
}
