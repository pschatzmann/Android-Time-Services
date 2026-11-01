package com.pschatzmann.chronos

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.annotation.StringRes
import androidx.compose.ui.res.stringResource
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ShowChart
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Sensors
import androidx.compose.material.icons.filled.CellTower
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pschatzmann.chronos.ui.ChronosTheme
import com.pschatzmann.chronos.ui.Chip
import com.pschatzmann.chronos.ui.ClockScreen
import com.pschatzmann.chronos.ui.Emerald
import com.pschatzmann.chronos.ui.MetricsScreen
import com.pschatzmann.chronos.ui.PublishScreen
import com.pschatzmann.chronos.ui.SettingsScreen
import com.pschatzmann.chronos.ui.SourcesScreen
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp
import com.pschatzmann.chronos.ui.Amber

private enum class Screen(@StringRes val label: Int, val icon: ImageVector) {
    Clock(R.string.nav_clock, Icons.Default.Schedule),
    Sources(R.string.nav_sources, Icons.Default.Sensors),
    Publish(R.string.nav_publish, Icons.Default.CellTower),
    Metrics(R.string.nav_metrics, Icons.Default.ShowChart),
    Settings(R.string.nav_settings, Icons.Default.Settings),
}

class MainActivity : AppCompatActivity() {
    private val engine: ChronosEngine get() = (application as ChronosApp).engine

    override fun onStart() {
        super.onStart()
        engine.setUiVisible(true)
    }

    override fun onStop() {
        engine.setUiVisible(false)
        super.onStop()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val dark by engine.darkTheme.collectAsStateWithLifecycle()
            ChronosTheme(dark) { ChronosRoot(engine) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ChronosRoot(vm: ChronosEngine) {
    var screen by rememberSaveable { mutableStateOf(Screen.Clock) }
    val dark by vm.darkTheme.collectAsStateWithLifecycle()
    val syncing by vm.syncing.collectAsStateWithLifecycle()
    val st by vm.status.collectAsStateWithLifecycle()

    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { }
    val context = androidx.compose.ui.platform.LocalContext.current
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= 33 &&
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED
        ) {
            launcher.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
        }
    }
    val requestPermissions: () -> Unit = {
        val perms = buildList {
            add(Manifest.permission.ACCESS_FINE_LOCATION)
            if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
            if (Build.VERSION.SDK_INT >= 31) {
                add(Manifest.permission.BLUETOOTH_SCAN)
                add(Manifest.permission.BLUETOOTH_ADVERTISE)
                add(Manifest.permission.BLUETOOTH_CONNECT)
            }
        }
        launcher.launch(perms.toTypedArray())
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.app_name), fontSize = 18.sp, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis) },
                actions = {
                    Chip(
                        if (st.synced) "S${st.activeStratum} ${st.lockedRefId}" else stringResource(R.string.chip_unsync),
                        if (st.synced) Emerald else Amber,
                    )
                    IconButton(onClick = { vm.forceSync() }) {
                        if (syncing) CircularProgressIndicator(Modifier.padding(4.dp), strokeWidth = 2.dp)
                        else Icon(Icons.Default.Sync, stringResource(R.string.cd_sync_now))
                    }
                    IconButton(onClick = { vm.toggleTheme() }) {
                        Icon(if (dark) Icons.Default.LightMode else Icons.Default.DarkMode, stringResource(R.string.cd_toggle_theme))
                    }
                },
            )
        },
        bottomBar = {
            NavigationBar {
                Screen.entries.forEach {
                    NavigationBarItem(
                        selected = screen == it,
                        onClick = { screen = it },
                        icon = { Icon(it.icon, stringResource(it.label)) },
                        label = { Text(stringResource(it.label), fontSize = 10.sp, maxLines = 1) },
                    )
                }
            }
        },
    ) { pad ->
        Box(Modifier.padding(pad)) {
            when (screen) {
                Screen.Clock -> ClockScreen(vm)
                Screen.Sources -> SourcesScreen(vm, requestPermissions)
                Screen.Publish -> PublishScreen(vm, requestPermissions) { screen = Screen.Settings }
                Screen.Metrics -> MetricsScreen(vm)
                Screen.Settings -> SettingsScreen(vm)
            }
        }
    }
}
