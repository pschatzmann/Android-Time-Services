package com.pschatzmann.timeservices.ui

import com.pschatzmann.timeservices.R
import androidx.compose.ui.res.stringResource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pschatzmann.timeservices.TimeEngine

@Composable
fun MetricsScreen(vm: TimeEngine) {
    val history by vm.history.collectAsStateWithLifecycle()
    val st by vm.status.collectAsStateWithLifecycle()
    var windowSec by rememberSaveable { mutableIntStateOf(60) }
    val pts = history.takeLast(windowSec)

    Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        ScreenTitle(
            stringResource(R.string.metrics_title),
            stringResource(R.string.metrics_subtitle),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(60 to stringResource(R.string.window_1m), 300 to stringResource(R.string.window_5m), 900 to stringResource(R.string.window_15m)).forEach { (s, label) ->
                FilterChip(selected = windowSec == s, onClick = { windowSec = s }, label = { Text(label, fontFamily = Mono) })
            }
        }

        AppCard {
            Row {
                Text(stringResource(R.string.chart_fused), fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                Text("%+.3f ms".format(st.offsetNs / 1e6), fontFamily = Mono, fontSize = 12.sp, color = Cyan)
            }
            LineChart(listOf(ChartSeries(pts.map { it.fusedOffsetMs }, Cyan)))
            Text(stringResource(R.string.chart_offset_ms), fontFamily = Mono, fontSize = 10.sp, color = Cyan)
            ChartNote(stringResource(R.string.chart_note_offset))
            LineChart(listOf(ChartSeries(pts.map { it.driftPpb }, Emerald, dashed = true)))
            Text(stringResource(R.string.chart_drift_now, st.driftPpb), fontFamily = Mono, fontSize = 10.sp, color = Emerald)
            ChartNote(stringResource(R.string.chart_note_drift))
        }

        AppCard {
            Text(stringResource(R.string.chart_per_source), fontWeight = FontWeight.SemiBold)
            LineChart(
                listOf(
                    ChartSeries(pts.map { it.ntpOffsetMs }, Cyan),
                    ChartSeries(pts.map { it.gpsOffsetMs }, Amber, dashed = true),
                    ChartSeries(pts.map { it.bleOffsetMs }, Purple),
                ),
            )
            Text("● NTP  ", color = Cyan, fontFamily = Mono, fontSize = 10.sp)
            Text(stringResource(R.string.legend_gnss_dashed), color = Amber, fontFamily = Mono, fontSize = 10.sp)
            Text("● BLE CTS", color = Purple, fontFamily = Mono, fontSize = 10.sp)
            ChartNote(stringResource(R.string.chart_note_sources))
        }

        AppCard {
            Text(stringResource(R.string.chart_delay), fontWeight = FontWeight.SemiBold)
            LineChart(
                listOf(ChartSeries(pts.map { it.ntpDelayMs }, Cyan), ChartSeries(pts.map { it.bleDelayMs }, Purple)),
                minY = 0.0,
            )
            Text(stringResource(R.string.legend_ntp_rtt), color = Cyan, fontFamily = Mono, fontSize = 10.sp)
            Text(stringResource(R.string.legend_ble_rtt), color = Purple, fontFamily = Mono, fontSize = 10.sp)
            ChartNote(stringResource(R.string.chart_note_delay))
        }
    }
}
