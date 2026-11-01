package com.pschatzmann.chronos.ui

import com.pschatzmann.chronos.R
import androidx.compose.ui.res.stringResource
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AssistChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import com.pschatzmann.chronos.SourceConfig
import com.pschatzmann.chronos.SourceType
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.clickable
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Button
import androidx.compose.ui.platform.LocalContext
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pschatzmann.chronos.BleCtsConfig
import com.pschatzmann.chronos.ChronosEngine
import com.pschatzmann.chronos.DiscipliningConfig
import com.pschatzmann.chronos.NtpServerConfig

/** Editable copy of one NTP server while the Settings screen is open. */
private data class NtpRow(
    val id: String,
    val name: String,
    val host: String,
    val poll: String,
    val enabled: Boolean,
    val weight: Double,
    val stratum: Int,
)

private val ntpPresets = listOf(
    "pool.ntp.org", "time.nist.gov", "time.windows.com", "time.apple.com",
    "ptbtime1.ptb.de", "time.cloudflare.com", "time.google.com",
)

/** host or host:port, no spaces; port 1..65535. */
private fun isValidNtpHost(text: String): Boolean {
    val t = text.trim()
    if (t.isEmpty() || t.any { it.isWhitespace() }) return false
    val parts = t.split(":")
    if (parts.size > 2) return false
    if (parts.size == 2 && parts[1].toIntOrNull()?.let { it in 1..65535 } != true) return false
    return parts[0].isNotEmpty() && parts[0].all { it.isLetterOrDigit() || it == '.' || it == '-' }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SettingsScreen(vm: ChronosEngine) {
    val cfg by vm.config.collectAsStateWithLifecycle()

    var port by remember(cfg) { mutableStateOf(cfg.ntpServer.listenPort.toString()) }
    var stratum by remember(cfg) { mutableStateOf(cfg.ntpServer.stratum.toString()) }
    var refId by remember(cfg) { mutableStateOf(cfg.ntpServer.refId) }
    var leap by remember(cfg) { mutableStateOf(cfg.ntpServer.leapIndicator) }
    var rate by remember(cfg) { mutableStateOf(cfg.ntpServer.rateLimitPerMin.toString()) }
    var subnets by remember(cfg) { mutableStateOf(cfg.ntpServer.allowSubnets.joinToString(", ")) }
    var adv by remember(cfg) { mutableStateOf(cfg.bleCts.advIntervalMs.toString()) }
    var notify by remember(cfg) { mutableStateOf(cfg.bleCts.sendNotifications) }
    var notifyUnit by remember(cfg) {
        mutableStateOf(
            when {
                cfg.bleCts.notifyIntervalMs % 3_600_000 == 0 -> 3_600_000
                cfg.bleCts.notifyIntervalMs % 60_000 == 0 -> 60_000
                else -> 1_000
            },
        )
    }
    var notifyValue by remember(cfg) {
        mutableStateOf((cfg.bleCts.notifyIntervalMs / notifyUnit.toDouble()).toString().removeSuffix(".0"))
    }
    var algo by remember(cfg) { mutableStateOf(cfg.disciplining.algorithm) }
    var tau by remember(cfg) { mutableStateOf(cfg.disciplining.pllTimeConstantSec.toString()) }
    var fll by remember(cfg) { mutableStateOf(cfg.disciplining.fllBandwidthHz.toString()) }
    var slew by remember(cfg) { mutableStateOf(cfg.disciplining.maxSlewPpm.toString()) }
    var holdover by remember(cfg) { mutableStateOf(cfg.disciplining.holdoverTimeoutSec.toString()) }
    var pref1 by remember(cfg) { mutableStateOf(cfg.disciplining.preferStratum1) }
    var keepAwake by remember(cfg) { mutableStateOf(cfg.keepAwake) }
    var pubSource by remember(cfg) { mutableStateOf(cfg.publishSourceId) }
    var ntpRows by remember(cfg) {
        mutableStateOf(
            cfg.sources.filter { it.type == SourceType.NTP }.map {
                NtpRow(it.id, it.name, it.hostOrPort, it.pollIntervalSec.toString(), it.enabled, it.weight, it.stratum)
            },
        )
    }
    var newRowCounter by remember { mutableStateOf(0) }
    fun addRow(host: String) {
        if (ntpRows.any { it.host.equals(host, ignoreCase = true) } && host.isNotEmpty()) return
        newRowCounter++
        ntpRows = ntpRows + NtpRow("src_ntp_${System.currentTimeMillis()}_$newRowCounter", "", host, "16", true, 0.25, 2)
    }
    fun updateRow(row: NtpRow) {
        ntpRows = ntpRows.map { if (it.id == row.id) row else it }
    }
    val context = LocalContext.current

    @Composable
    fun num(label: String, value: String, onChange: (String) -> Unit, decimal: Boolean = false) =
        OutlinedTextField(
            value, onChange, label = { Text(label) }, singleLine = true, modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = if (decimal) KeyboardType.Decimal else KeyboardType.Number),
        )

    Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        ScreenTitle(stringResource(R.string.nav_settings), stringResource(R.string.settings_subtitle))

        ChronosCard {
            Text(stringResource(R.string.ntp_servers_title), fontWeight = FontWeight.SemiBold)
            Text(
                stringResource(R.string.ntp_servers_note),
                fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            ntpRows.forEach { row ->
                val valid = isValidNtpHost(row.host)
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        OutlinedTextField(
                            row.host, { updateRow(row.copy(host = it.trim())) },
                            label = { Text(stringResource(R.string.field_host)) }, singleLine = true, isError = !valid,
                            modifier = Modifier.weight(1f),
                        )
                        Switch(row.enabled, { updateRow(row.copy(enabled = it)) })
                        IconButton(onClick = { ntpRows = ntpRows.filter { it.id != row.id } }) {
                            Icon(Icons.Default.Delete, stringResource(R.string.cd_remove_server))
                        }
                    }
                    if (!valid) {
                        Text(
                            stringResource(R.string.ntp_host_invalid),
                            fontSize = 11.sp, color = MaterialTheme.colorScheme.error,
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            row.name, { updateRow(row.copy(name = it)) },
                            label = { Text(stringResource(R.string.f_ntp_name)) }, singleLine = true, modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            row.poll, { updateRow(row.copy(poll = it.filter { c -> c.isDigit() })) },
                            label = { Text(stringResource(R.string.f_ntp_poll)) }, singleLine = true, modifier = Modifier.width(110.dp),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        )
                    }
                }
                HorizontalDivider()
            }
            Text(stringResource(R.string.ntp_quick_add), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ntpPresets.filter { p -> ntpRows.none { it.host.equals(p, ignoreCase = true) } }.forEach { p ->
                    AssistChip(onClick = { addRow(p) }, label = { Text(p, fontFamily = Mono, fontSize = 12.sp) })
                }
            }
            OutlinedButton(onClick = { addRow("") }) {
                Icon(Icons.Default.Add, null)
                Text(stringResource(R.string.btn_add_server), Modifier.padding(start = 8.dp))
            }
        }

        ChronosCard {
            Text(stringResource(R.string.pub_source_title), fontWeight = FontWeight.SemiBold)
            Text(
                stringResource(R.string.pub_source_note),
                fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            val options = buildList {
                add(ChronosEngine.PUBLISH_FUSED to stringResource(R.string.pub_fused))
                add(ChronosEngine.PUBLISH_SYSTEM to stringResource(R.string.pub_system))
                cfg.sources.forEach {
                    add(it.id to (it.displayName() + if (it.enabled) "" else stringResource(R.string.disabled_suffix)))
                }
            }
            options.forEach { (id, label) ->
                Row(
                    Modifier.fillMaxWidth().clickable { pubSource = id },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RadioButton(selected = pubSource == id, onClick = { pubSource = id })
                    Text(label, fontSize = 14.sp)
                }
            }
        }

        ChronosCard {
            Text(stringResource(R.string.ntp_cfg_title), fontWeight = FontWeight.SemiBold)
            SectionNote(stringResource(R.string.ntp_cfg_note))
            num(stringResource(R.string.f_port), port, { port = it })
            num(stringResource(R.string.kv_stratum), stratum, { stratum = it })
            OutlinedTextField(refId, { refId = it.take(4) }, label = { Text(stringResource(R.string.f_refid)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Text(stringResource(R.string.f_leap), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(0 to stringResource(R.string.leap_none), 1 to stringResource(R.string.leap_add), 2 to stringResource(R.string.leap_del), 3 to stringResource(R.string.leap_unsync)).forEach { (v, l) ->
                    FilterChip(selected = leap == v, onClick = { leap = v }, label = { Text(l, fontFamily = Mono) })
                }
            }
            num(stringResource(R.string.f_rate), rate, { rate = it })
            OutlinedTextField(
                subnets, { subnets = it }, label = { Text(stringResource(R.string.f_subnets)) },
                modifier = Modifier.fillMaxWidth(),
            )
        }

        ChronosCard {
            Text("BLE Current Time Service", fontWeight = FontWeight.SemiBold)
            SectionNote(stringResource(R.string.ble_cfg_note))
            num(stringResource(R.string.f_adv), adv, { adv = it })
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.f_notify), Modifier.weight(1f))
                Switch(notify, { notify = it })
            }
            num(stringResource(R.string.f_notify_interval), notifyValue, { notifyValue = it }, decimal = true)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(1_000 to stringResource(R.string.unit_seconds), 60_000 to stringResource(R.string.unit_minutes), 3_600_000 to stringResource(R.string.unit_hours)).forEach { (u, label) ->
                    FilterChip(selected = notifyUnit == u, onClick = { notifyUnit = u }, label = { Text(label) })
                }
            }
        }

        ChronosCard {
            Text(stringResource(R.string.disc_title), fontWeight = FontWeight.SemiBold)
            SectionNote(stringResource(R.string.disc_note))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("kalman" to stringResource(R.string.algo_kalman), "marzullo" to stringResource(R.string.algo_marzullo), "pll_fll" to "PLL/FLL").forEach { (k, l) ->
                    FilterChip(selected = algo == k, onClick = { algo = k }, label = { Text(l, fontFamily = Mono) })
                }
            }
            num(stringResource(R.string.f_tau), tau, { tau = it })
            num(stringResource(R.string.f_fll), fll, { fll = it }, decimal = true)
            num(stringResource(R.string.f_slew), slew, { slew = it })
            num(stringResource(R.string.f_holdover), holdover, { holdover = it })
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.f_prefer1), Modifier.weight(1f))
                Switch(pref1, { pref1 = it })
            }
        }

        ChronosCard {
            Text(stringResource(R.string.bg_title), fontWeight = FontWeight.SemiBold)
            Text(
                stringResource(R.string.bg_note),
                fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.bg_keep_awake), Modifier.weight(1f))
                Switch(keepAwake, { keepAwake = it })
            }
            OutlinedButton(onClick = {
                context.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }) { Text(stringResource(R.string.bg_battery)) }
        }

        ChronosCard {
            Text(stringResource(R.string.lang_title), fontWeight = FontWeight.SemiBold)
            SectionNote(stringResource(R.string.lang_note))
            val current = AppCompatDelegate.getApplicationLocales().toLanguageTags().substringBefore(',').substringBefore('-')
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(
                    "" to R.string.lang_system, "en" to R.string.lang_en, "de" to R.string.lang_de,
                    "fr" to R.string.lang_fr, "es" to R.string.lang_es,
                ).forEach { (tag, label) ->
                    FilterChip(
                        selected = current == tag,
                        onClick = {
                            AppCompatDelegate.setApplicationLocales(
                                if (tag.isEmpty()) LocaleListCompat.getEmptyLocaleList() else LocaleListCompat.forLanguageTags(tag),
                            )
                        },
                        label = { Text(stringResource(label)) },
                    )
                }
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            Button(
                onClick = {
                    vm.updateConfig { c ->
                        val oldById = c.sources.associateBy { it.id }
                        val newNtp = ntpRows.filter { isValidNtpHost(it.host) }.map { r ->
                            SourceConfig(
                                id = r.id,
                                name = r.name.trim().ifEmpty { r.host.trim() },
                                type = SourceType.NTP,
                                enabled = r.enabled,
                                stratum = oldById[r.id]?.stratum ?: r.stratum,
                                weight = r.weight,
                                pollIntervalSec = r.poll.toIntOrNull()?.coerceIn(4, 86_400) ?: 16,
                                hostOrPort = r.host.trim(),
                            )
                        }
                        // Keep the original position of the NTP block among the other sources.
                        val sources = buildList {
                            var inserted = false
                            for (s in c.sources) {
                                if (s.type == SourceType.NTP) {
                                    if (!inserted) {
                                        addAll(newNtp)
                                        inserted = true
                                    }
                                } else {
                                    add(s)
                                }
                            }
                            if (!inserted) addAll(newNtp)
                        }
                        val publish = if (
                            pubSource == ChronosEngine.PUBLISH_FUSED || pubSource == ChronosEngine.PUBLISH_SYSTEM ||
                            sources.any { it.id == pubSource }
                        ) pubSource else ChronosEngine.PUBLISH_FUSED
                        c.copy(
                            keepAwake = keepAwake,
                            publishSourceId = publish,
                            sources = sources,
                            ntpServer = NtpServerConfig(
                                enabled = c.ntpServer.enabled,
                                listenPort = port.toIntOrNull()?.coerceIn(1024, 65535) ?: c.ntpServer.listenPort,
                                stratum = stratum.toIntOrNull()?.coerceIn(1, 15) ?: c.ntpServer.stratum,
                                refId = refId.ifBlank { c.ntpServer.refId },
                                leapIndicator = leap,
                                rateLimitPerMin = rate.toIntOrNull()?.coerceAtLeast(0) ?: c.ntpServer.rateLimitPerMin,
                                allowSubnets = subnets.split(",").map { it.trim() }.filter { it.isNotEmpty() }.ifEmpty { listOf("0.0.0.0/0") },
                            ),
                            bleCts = BleCtsConfig(
                                enabled = c.bleCts.enabled,
                                advIntervalMs = adv.toIntOrNull()?.coerceIn(20, 10000) ?: c.bleCts.advIntervalMs,
                                sendNotifications = notify,
                                notifyIntervalMs = notifyValue.replace(',', '.').toDoubleOrNull()
                                    ?.let { Math.round(it * notifyUnit).toInt().coerceIn(100, 86_400_000) }
                                    ?: c.bleCts.notifyIntervalMs,
                            ),
                            disciplining = DiscipliningConfig(
                                algorithm = algo,
                                pllTimeConstantSec = tau.toIntOrNull()?.coerceAtLeast(1) ?: c.disciplining.pllTimeConstantSec,
                                fllBandwidthHz = fll.toDoubleOrNull() ?: c.disciplining.fllBandwidthHz,
                                maxSlewPpm = slew.toIntOrNull()?.coerceAtLeast(1) ?: c.disciplining.maxSlewPpm,
                                holdoverTimeoutSec = holdover.toIntOrNull()?.coerceAtLeast(1) ?: c.disciplining.holdoverTimeoutSec,
                                preferStratum1 = pref1,
                            ),
                        )
                    }
                },
                modifier = Modifier.weight(1f),
            ) { Text(stringResource(R.string.btn_save)) }
            OutlinedButton(onClick = { vm.resetDefaults() }, modifier = Modifier.weight(1f)) { Text(stringResource(R.string.btn_reset)) }
        }
    }
}
