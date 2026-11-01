package com.pschatzmann.chronos.net

import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress

data class NtpResult(
    val offsetMs: Double,
    val delayMs: Double,
    val stratum: Int,
    val precision: Int,
    val rootDelayMs: Double,
    val rootDispersionMs: Double,
    val refId: String,
    val t1: Long,
    val t2: Double,
    val t3: Double,
    val t4: Long,
    val rawHex: String,
)

/** RFC 5905 helpers shared by the NTP client and the NTP server. */
object Ntp {
    const val NTP_DELTA = 2208988800L
    private const val ERA1_OFFSET = 2085978496L

    fun readU32(b: ByteArray, o: Int): Long =
        ((b[o].toLong() and 0xFF) shl 24) or ((b[o + 1].toLong() and 0xFF) shl 16) or
            ((b[o + 2].toLong() and 0xFF) shl 8) or (b[o + 3].toLong() and 0xFF)

    fun writeU32(b: ByteArray, o: Int, v: Long) {
        b[o] = (v shr 24).toByte()
        b[o + 1] = (v shr 16).toByte()
        b[o + 2] = (v shr 8).toByte()
        b[o + 3] = v.toByte()
    }

    /** Unix epoch milliseconds -> NTP 64 bit timestamp written at [o]. */
    fun writeTimestamp(b: ByteArray, o: Int, unixMs: Long) {
        val sec = Math.floorDiv(unixMs, 1000L) + NTP_DELTA
        val frac = (Math.floorMod(unixMs, 1000L) * 4294967296L) / 1000L
        writeU32(b, o, sec and 0xFFFFFFFFL)
        writeU32(b, o + 4, frac and 0xFFFFFFFFL)
    }

    /** NTP 64 bit timestamp at [o] -> Unix epoch milliseconds (with fractional part). */
    fun readTimestampMs(b: ByteArray, o: Int): Double {
        val s = readU32(b, o)
        val f = readU32(b, o + 4)
        val unixSec = if (s and 0x80000000L != 0L) s - NTP_DELTA else s + ERA1_OFFSET
        return unixSec * 1000.0 + f * 1000.0 / 4294967296.0
    }

    fun toHex(b: ByteArray, len: Int = b.size) =
        (0 until len).joinToString(" ") { "%02x".format(b[it]) }
}

object NtpClient {
    /** Blocking SNTP query (RFC 5905 mode 3). Call from a background thread. */
    fun query(host: String, port: Int = 123, timeoutMs: Int = 2500): NtpResult {
        val addr = InetAddress.getByName(host)
        DatagramSocket().use { socket ->
            socket.soTimeout = timeoutMs
            val req = ByteArray(48)
            req[0] = 0x23 // LI 0, VN 4, mode 3 (client)
            val t1 = System.currentTimeMillis()
            val n1 = System.nanoTime()
            Ntp.writeTimestamp(req, 40, t1)
            socket.send(DatagramPacket(req, req.size, addr, port))

            val buf = ByteArray(128)
            val pkt = DatagramPacket(buf, buf.size)
            socket.receive(pkt)
            val t4 = System.currentTimeMillis()
            val n4 = System.nanoTime()
            if (pkt.length < 48) throw IllegalStateException("Invalid NTP packet length: ${pkt.length}")

            // The server must echo our transmit timestamp in its originate field.
            for (i in 0 until 8) {
                if (buf[24 + i] != req[40 + i]) throw IllegalStateException("NTP response does not match request")
            }

            val stratum = buf[1].toInt() and 0xFF
            if (stratum == 0) {
                throw IllegalStateException("Kiss-o'-Death: " + String(buf, 12, 4, Charsets.US_ASCII).trim())
            }
            val precision = buf[3].toInt()
            val rootDelay = (Ntp.readU32(buf, 4)) / 65536.0 * 1000.0
            val rootDisp = (Ntp.readU32(buf, 8)) / 65536.0 * 1000.0
            val refId = if (stratum <= 1) {
                String(buf, 12, 4, Charsets.US_ASCII).trim { it == '\u0000' || it == ' ' }
            } else {
                "${buf[12].toInt() and 0xFF}.${buf[13].toInt() and 0xFF}.${buf[14].toInt() and 0xFF}.${buf[15].toInt() and 0xFF}"
            }
            val t2 = Ntp.readTimestampMs(buf, 32)
            val t3 = Ntp.readTimestampMs(buf, 40)

            val rttMs = (n4 - n1) / 1e6
            val delay = maxOf(0.001, rttMs - (t3 - t2))
            val offset = ((t2 - t1) + (t3 - t4)) / 2.0

            return NtpResult(
                offsetMs = offset,
                delayMs = delay,
                stratum = stratum,
                precision = precision,
                rootDelayMs = rootDelay,
                rootDispersionMs = rootDisp,
                refId = refId,
                t1 = t1,
                t2 = t2,
                t3 = t3,
                t4 = t4,
                rawHex = Ntp.toHex(buf, 48),
            )
        }
    }
}
