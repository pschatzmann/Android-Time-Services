package com.pschatzmann.chronos.ble

import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.UUID

/** Bluetooth SIG Current Time Service (0x1805) identifiers and encoders/decoders. */
object Cts {
    val SERVICE: UUID = UUID.fromString("00001805-0000-1000-8000-00805f9b34fb")
    val CURRENT_TIME: UUID = UUID.fromString("00002a2b-0000-1000-8000-00805f9b34fb")
    val LOCAL_TIME_INFO: UUID = UUID.fromString("00002a0f-0000-1000-8000-00805f9b34fb")
    val REF_TIME_INFO: UUID = UUID.fromString("00002a14-0000-1000-8000-00805f9b34fb")
    val CCCD: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

    /** Adjust-reason bit 1 = "external reference time update". */
    const val ADJUST_EXTERNAL_REF = 0x02

    // Reference time source values (0x2A14)
    const val SRC_UNKNOWN = 0
    const val SRC_NTP = 1
    const val SRC_GPS = 2
    const val SRC_RADIO = 3
    const val SRC_MANUAL = 4
    const val SRC_ATOMIC = 5 // part of the BLE spec, not used by this app
    const val SRC_CELLULAR = 6
}

data class CtsParsed(
    val epochMs: Long,
    val year: Int,
    val month: Int,
    val day: Int,
    val hours: Int,
    val minutes: Int,
    val seconds: Int,
    val dayOfWeek: Int,
    val fractions256: Int,
    val subsecondMs: Int,
    val adjustReason: Int,
    val hex: String,
)

fun ByteArray.toHex(): String = joinToString(" ") { "%02x".format(it) }

object CtsCodec {
    /** Current Time (0x2A2B), 10 bytes: local wall-clock time of [zone], fractions in 1/256 s. */
    fun encodeCurrentTime(epochMs: Long, zone: ZoneId, adjustReason: Int = Cts.ADJUST_EXTERNAL_REF): ByteArray {
        val z = Instant.ofEpochMilli(epochMs).atZone(zone)
        val b = ByteArray(10)
        b[0] = (z.year and 0xFF).toByte()
        b[1] = ((z.year shr 8) and 0xFF).toByte()
        b[2] = z.monthValue.toByte()
        b[3] = z.dayOfMonth.toByte()
        b[4] = z.hour.toByte()
        b[5] = z.minute.toByte()
        b[6] = z.second.toByte()
        b[7] = z.dayOfWeek.value.toByte() // 1 = Monday .. 7 = Sunday
        b[8] = ((Math.floorMod(epochMs, 1000L) * 256) / 1000).toInt().toByte()
        b[9] = adjustReason.toByte()
        return b
    }

    /** Local Time Information (0x2A0F): [standard offset in 15 min units, DST code 0/2/4/8]. */
    fun encodeLocalTimeInfo(epochMs: Long, zone: ZoneId): ByteArray {
        val inst = Instant.ofEpochMilli(epochMs)
        val rules = zone.rules
        val std = rules.getStandardOffset(inst).totalSeconds / 900
        val dstMin = rules.getDaylightSavings(inst).toMinutes()
        val code = when {
            dstMin >= 120 -> 8
            dstMin >= 60 -> 4
            dstMin >= 30 -> 2
            else -> 0
        }
        return byteArrayOf(std.toByte(), code.toByte())
    }

    /** Reference Time Information (0x2A14): [source, accuracy (125 ms units), days, hours]. */
    fun encodeRefTimeInfo(source: Int, accuracyMs: Double): ByteArray {
        val acc = if (accuracyMs.isNaN()) 255 else Math.ceil(accuracyMs / 125.0).toInt().coerceIn(0, 254)
        return byteArrayOf(source.toByte(), acc.toByte(), 0, 0)
    }

    /** Decodes 0x2A2B. [localInfo] (0x2A0F) converts the local wall time to UTC; without it UTC is assumed. */
    fun decodeCurrentTime(b: ByteArray, localInfo: ByteArray?): CtsParsed? {
        if (b.size < 10) return null
        val year = (b[0].toInt() and 0xFF) or ((b[1].toInt() and 0xFF) shl 8)
        val month = b[2].toInt() and 0xFF
        val day = b[3].toInt() and 0xFF
        val hours = b[4].toInt() and 0xFF
        val minutes = b[5].toInt() and 0xFF
        val seconds = b[6].toInt() and 0xFF
        val dow = b[7].toInt() and 0xFF
        val frac = b[8].toInt() and 0xFF
        val reason = b[9].toInt() and 0xFF
        val offsetSec = if (localInfo != null && localInfo.size >= 2) {
            localInfo[0].toInt() * 900 + (localInfo[1].toInt() and 0xFF) * 900
        } else {
            0
        }
        val epochMs = try {
            LocalDateTime.of(year, month, day, hours, minutes, seconds)
                .toInstant(ZoneOffset.ofTotalSeconds(offsetSec)).toEpochMilli() + frac * 1000L / 256
        } catch (e: Exception) {
            return null
        }
        return CtsParsed(
            epochMs, year, month, day, hours, minutes, seconds, dow, frac,
            Math.round(frac / 256.0 * 1000).toInt(), reason, b.toHex(),
        )
    }
}
