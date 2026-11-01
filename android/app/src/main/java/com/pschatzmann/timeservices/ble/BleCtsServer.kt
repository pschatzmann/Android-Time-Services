package com.pschatzmann.timeservices.ble

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import com.pschatzmann.timeservices.BleCtsConfig
import com.pschatzmann.timeservices.BleServerState
import com.pschatzmann.timeservices.R
import com.pschatzmann.timeservices.UiText
import com.pschatzmann.timeservices.res
import java.time.ZoneId

/**
 * Publishes the disciplined clock as a BLE GATT Current Time Service peripheral.
 * Peers can read 0x2A2B / 0x2A0F / 0x2A14 and subscribe to 0x2A2B notifications (1 Hz).
 * The advertised name is the phone's own Bluetooth name.
 */
@SuppressLint("MissingPermission")
class BleCtsServer(
    private val ctx: Context,
    private val nowMs: () -> Long,
    private val refInfo: () -> Pair<Int, Double>, // (source, accuracy ms)
    private val onState: (BleServerState) -> Unit,
) {
    private val handler = Handler(Looper.getMainLooper())
    private var manager: BluetoothManager? = null
    private var gattServer: BluetoothGattServer? = null
    private var advertiser: BluetoothLeAdvertiser? = null
    private var currentChar: BluetoothGattCharacteristic? = null
    private val connected = mutableSetOf<BluetoothDevice>()
    private val subscribers = mutableSetOf<BluetoothDevice>()
    private var cfg = BleCtsConfig()
    private var running = false
    private var lastHex = ""

    private val zone: ZoneId get() = ZoneId.systemDefault()

    private var lastNotifyAt = 0L

    /** Runs at least once a second to refresh the UI preview; notifies peers every cfg.notifyIntervalMs. */
    private val ticker = object : Runnable {
        override fun run() {
            if (!running) return
            val bytes = CtsCodec.encodeCurrentTime(nowMs(), zone)
            lastHex = bytes.toHex()
            val interval = cfg.notifyIntervalMs.coerceIn(100, 86_400_000)
            val now = android.os.SystemClock.elapsedRealtime()
            val due = now - lastNotifyAt >= interval - 5
            if (cfg.sendNotifications && subscribers.isNotEmpty() && due) {
                lastNotifyAt = now
                currentChar?.let { ch ->
                    @Suppress("DEPRECATION")
                    ch.value = bytes
                    for (d in subscribers.toList()) {
                        try {
                            @Suppress("DEPRECATION")
                            gattServer?.notifyCharacteristicChanged(d, ch, false)
                        } catch (_: Exception) {
                        }
                    }
                }
            }
            publish(null)
            handler.postDelayed(this, minOf(interval, 1000).toLong())
        }
    }

    private val advCallback = object : AdvertiseCallback() {
        override fun onStartFailure(errorCode: Int) {
            publish(res(R.string.ble_err_adv_fail, errorCode))
        }
    }

    private val serverCallback = object : BluetoothGattServerCallback() {
        override fun onConnectionStateChange(device: BluetoothDevice, status: Int, newState: Int) {
            handler.post {
                if (newState == BluetoothProfile.STATE_CONNECTED) {
                    connected.add(device)
                } else {
                    connected.remove(device)
                    subscribers.remove(device)
                }
                publish(null)
            }
        }

        override fun onServiceAdded(status: Int, service: BluetoothGattService) {
            if (status == BluetoothGatt.GATT_SUCCESS) startAdvertising() else publish(res(R.string.ble_err_add_status, status))
        }

        override fun onCharacteristicReadRequest(
            device: BluetoothDevice, requestId: Int, offset: Int, characteristic: BluetoothGattCharacteristic,
        ) {
            val now = nowMs()
            val full = when (characteristic.uuid) {
                Cts.CURRENT_TIME -> CtsCodec.encodeCurrentTime(now, zone)
                Cts.LOCAL_TIME_INFO -> CtsCodec.encodeLocalTimeInfo(now, zone)
                Cts.REF_TIME_INFO -> refInfo().let { CtsCodec.encodeRefTimeInfo(it.first, it.second) }
                else -> null
            }
            if (full == null || offset > full.size) {
                gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_FAILURE, offset, null)
            } else {
                gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, full.copyOfRange(offset, full.size))
            }
        }

        override fun onDescriptorReadRequest(
            device: BluetoothDevice, requestId: Int, offset: Int, descriptor: BluetoothGattDescriptor,
        ) {
            val v = if (subscribers.contains(device)) BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
            else BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE
            gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, v)
        }

        override fun onDescriptorWriteRequest(
            device: BluetoothDevice, requestId: Int, descriptor: BluetoothGattDescriptor,
            preparedWrite: Boolean, responseNeeded: Boolean, offset: Int, value: ByteArray?,
        ) {
            if (descriptor.uuid == Cts.CCCD && value != null) {
                handler.post {
                    if (value.isNotEmpty() && value[0].toInt() != 0) subscribers.add(device) else subscribers.remove(device)
                    publish(null)
                }
            }
            if (responseNeeded) {
                gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value)
            }
        }
    }

    fun start(config: BleCtsConfig) {
        stop()
        cfg = config
        val mgr = ctx.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        val adapter = mgr?.adapter
        if (mgr == null || adapter == null) return fail(res(R.string.ble_err_no_bt))
        if (!adapter.isEnabled) return fail(res(R.string.ble_err_off))
        val adv = adapter.bluetoothLeAdvertiser ?: return fail(res(R.string.ble_err_no_adv))
        manager = mgr
        advertiser = adv

        val server = try {
            mgr.openGattServer(ctx, serverCallback)
        } catch (e: SecurityException) {
            return fail(res(R.string.ble_err_denied))
        } ?: return fail(res(R.string.ble_err_gatt))
        gattServer = server

        val service = BluetoothGattService(Cts.SERVICE, BluetoothGattService.SERVICE_TYPE_PRIMARY)
        val current = BluetoothGattCharacteristic(
            Cts.CURRENT_TIME,
            BluetoothGattCharacteristic.PROPERTY_READ or BluetoothGattCharacteristic.PROPERTY_NOTIFY,
            BluetoothGattCharacteristic.PERMISSION_READ,
        )
        current.addDescriptor(
            BluetoothGattDescriptor(
                Cts.CCCD,
                BluetoothGattDescriptor.PERMISSION_READ or BluetoothGattDescriptor.PERMISSION_WRITE,
            ),
        )
        currentChar = current
        service.addCharacteristic(current)
        service.addCharacteristic(
            BluetoothGattCharacteristic(
                Cts.LOCAL_TIME_INFO, BluetoothGattCharacteristic.PROPERTY_READ, BluetoothGattCharacteristic.PERMISSION_READ,
            ),
        )
        service.addCharacteristic(
            BluetoothGattCharacteristic(
                Cts.REF_TIME_INFO, BluetoothGattCharacteristic.PROPERTY_READ, BluetoothGattCharacteristic.PERMISSION_READ,
            ),
        )
        running = true
        if (!server.addService(service)) fail(res(R.string.ble_err_add))
    }

    private fun startAdvertising() {
        val mode = when {
            cfg.advIntervalMs <= 250 -> AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY
            cfg.advIntervalMs <= 1000 -> AdvertiseSettings.ADVERTISE_MODE_BALANCED
            else -> AdvertiseSettings.ADVERTISE_MODE_LOW_POWER
        }
        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(mode)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
            .setConnectable(true)
            .build()
        val data = AdvertiseData.Builder()
            .setIncludeDeviceName(false)
            .addServiceUuid(ParcelUuid(Cts.SERVICE))
            .build()
        val scanResponse = AdvertiseData.Builder().setIncludeDeviceName(true).build()
        try {
            advertiser?.startAdvertising(settings, data, scanResponse, advCallback)
        } catch (e: SecurityException) {
            return fail(res(R.string.ble_err_denied))
        }
        handler.removeCallbacks(ticker)
        handler.post(ticker)
        publish(null)
    }

    fun stop() {
        val wasRunning = running
        running = false
        handler.removeCallbacks(ticker)
        try {
            advertiser?.stopAdvertising(advCallback)
            gattServer?.close()
        } catch (_: Exception) {
        }
        advertiser = null
        gattServer = null
        currentChar = null
        connected.clear()
        subscribers.clear()
        if (wasRunning) onState(BleServerState())
    }

    private fun fail(msg: UiText) {
        running = false
        onState(BleServerState(running = false, error = msg))
    }

    private fun publish(error: UiText?) {
        onState(
            BleServerState(
                running = running, connected = connected.size, subscribers = subscribers.size,
                lastPacketHex = lastHex, error = error,
            ),
        )
    }
}
