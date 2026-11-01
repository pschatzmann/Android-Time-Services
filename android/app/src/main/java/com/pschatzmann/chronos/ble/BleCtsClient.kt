package com.pschatzmann.chronos.ble

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import com.pschatzmann.chronos.R
import com.pschatzmann.chronos.UiText
import com.pschatzmann.chronos.res

data class BleSample(val offsetMs: Double, val rttMs: Double, val atMs: Long, val parsed: CtsParsed)

/**
 * Connects to a peer exposing the Current Time Service and periodically reads 0x2A2B.
 * The offset is the peer's time minus the midpoint of our read request/response.
 */
@SuppressLint("MissingPermission")
class BleCtsClient(
    private val ctx: Context,
    private val pollMs: () -> Long,
    private val onSample: (BleSample) -> Unit,
    private val onState: (UiText) -> Unit,
) {
    private val handler = Handler(Looper.getMainLooper())
    private var gatt: BluetoothGatt? = null
    private var scanning = false
    private var wanted = false
    private var address: String = ""
    private var localInfo: ByteArray? = null
    private var tSend = 0L
    private var scanCb: ScanCallback? = null

    val isRunning: Boolean get() = wanted

    fun start(deviceAddress: String) {
        if (wanted && address == deviceAddress) return
        stop()
        wanted = true
        address = deviceAddress.trim()
        connectOrScan()
    }

    fun stop() {
        wanted = false
        handler.removeCallbacksAndMessages(null)
        stopScan()
        try {
            gatt?.disconnect()
            gatt?.close()
        } catch (_: Exception) {
        }
        gatt = null
        onState(res(R.string.bc_idle))
    }

    private fun adapter(): BluetoothAdapter? =
        (ctx.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

    private fun connectOrScan() {
        if (!wanted) return
        val ad = adapter()
        if (ad == null || !ad.isEnabled) {
            onState(res(R.string.bc_bt_off))
            retryLater()
            return
        }
        if (BluetoothAdapter.checkBluetoothAddress(address.uppercase())) {
            onState(res(R.string.bc_connecting, address))
            connect(ad.getRemoteDevice(address.uppercase()))
        } else {
            val scanner = ad.bluetoothLeScanner
            if (scanner == null) {
                onState(res(R.string.bc_scan_unavail))
                return
            }
            onState(res(R.string.bc_scanning))
            val cb = object : ScanCallback() {
                override fun onScanResult(callbackType: Int, result: ScanResult) {
                    stopScan()
                    onState(res(R.string.bc_connecting, result.device.address))
                    connect(result.device)
                }

                override fun onScanFailed(errorCode: Int) {
                    onState(res(R.string.bc_scan_failed, errorCode))
                    retryLater()
                }
            }
            scanCb = cb
            scanning = true
            try {
                scanner.startScan(
                    listOf(ScanFilter.Builder().setServiceUuid(ParcelUuid(Cts.SERVICE)).build()),
                    ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_BALANCED).build(),
                    cb,
                )
            } catch (e: SecurityException) {
                onState(res(R.string.ble_err_denied))
            }
            handler.postDelayed({
                if (scanning) {
                    stopScan()
                    onState(res(R.string.bc_none_found))
                    retryLater()
                }
            }, 20_000)
        }
    }

    private fun stopScan() {
        if (!scanning) return
        scanning = false
        try {
            scanCb?.let { adapter()?.bluetoothLeScanner?.stopScan(it) }
        } catch (_: Exception) {
        }
        scanCb = null
    }

    private fun connect(device: android.bluetooth.BluetoothDevice) {
        gatt = device.connectGatt(ctx, false, callback, android.bluetooth.BluetoothDevice.TRANSPORT_LE)
    }

    private fun retryLater() {
        if (!wanted) return
        handler.postDelayed({ connectOrScan() }, 10_000)
    }

    private fun readCurrent(g: BluetoothGatt) {
        if (!wanted) return
        val ch = g.getService(Cts.SERVICE)?.getCharacteristic(Cts.CURRENT_TIME)
        if (ch == null) {
            onState(res(R.string.bc_no_char))
            return
        }
        tSend = System.currentTimeMillis()
        g.readCharacteristic(ch)
    }

    private fun handleRead(g: BluetoothGatt, uuid: java.util.UUID, value: ByteArray, status: Int) {
        val tRecv = System.currentTimeMillis()
        if (status != BluetoothGatt.GATT_SUCCESS) {
            onState(res(R.string.bc_read_failed, status))
            handler.postDelayed({ readCurrent(g) }, pollMs())
            return
        }
        when (uuid) {
            Cts.LOCAL_TIME_INFO -> {
                localInfo = value
                handler.post { readCurrent(g) }
            }
            Cts.CURRENT_TIME -> {
                val parsed = CtsCodec.decodeCurrentTime(value, localInfo)
                if (parsed != null) {
                    val mid = (tSend + tRecv) / 2.0
                    onSample(BleSample(parsed.epochMs - mid, (tRecv - tSend).toDouble(), tRecv, parsed))
                    onState(res(R.string.bc_connected))
                }
                handler.postDelayed({ readCurrent(g) }, pollMs())
            }
        }
    }

    private val callback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                g.discoverServices()
            } else {
                handler.post {
                    onState(res(R.string.bc_disconnected))
                    try {
                        g.close()
                    } catch (_: Exception) {
                    }
                    if (gatt === g) gatt = null
                    retryLater()
                }
            }
        }

        override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
            handler.post {
                val svc = g.getService(Cts.SERVICE)
                if (svc == null) {
                    onState(res(R.string.bc_no_service))
                    return@post
                }
                val local = svc.getCharacteristic(Cts.LOCAL_TIME_INFO)
                if (local != null) g.readCharacteristic(local) else readCurrent(g)
            }
        }

        @Deprecated("Used on API < 33")
        override fun onCharacteristicRead(g: BluetoothGatt, ch: BluetoothGattCharacteristic, status: Int) {
            @Suppress("DEPRECATION")
            handleRead(g, ch.uuid, ch.value ?: ByteArray(0), status)
        }

        override fun onCharacteristicRead(g: BluetoothGatt, ch: BluetoothGattCharacteristic, value: ByteArray, status: Int) {
            handleRead(g, ch.uuid, value, status)
        }
    }
}
