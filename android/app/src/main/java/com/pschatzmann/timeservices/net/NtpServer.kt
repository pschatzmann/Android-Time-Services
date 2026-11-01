package com.pschatzmann.timeservices.net

import android.util.Log
import com.pschatzmann.timeservices.NtpServerConfig
import com.pschatzmann.timeservices.NtpServerState
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.Inet4Address
import java.net.InetAddress
import java.net.SocketException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

/** What the server advertises about the disciplined clock at the moment it answers a request. */
data class NtpServerClock(
    val nowMs: Long,
    val stratum: Int,
    val leapIndicator: Int,
    val rootDelayMs: Double,
    val rootDispersionMs: Double,
    val lastDisciplineMs: Long,
)

/**
 * RFC 5905 UDP server. Android does not allow binding ports below 1024 without root,
 * so the default listen port is 12123.
 */
class NtpServer(
    private val clock: () -> NtpServerClock,
    private val onState: (NtpServerState) -> Unit,
) {
    private var socket: DatagramSocket? = null
    private val running = AtomicBoolean(false)
    private var served = 0L
    private var dropped = 0L
    private var lastClient = ""

    private class Window(var startMs: Long, var count: Int)

    private val windows = ConcurrentHashMap<String, Window>()

    @Synchronized
    fun start(cfg: NtpServerConfig) {
        stop()
        val sock = try {
            DatagramSocket(null).apply {
                reuseAddress = true
                bind(java.net.InetSocketAddress(cfg.listenPort))
            }
        } catch (e: Exception) {
            onState(NtpServerState(running = false, port = cfg.listenPort, error = com.pschatzmann.timeservices.raw(e)))
            return
        }
        socket = sock
        running.set(true)
        served = 0
        dropped = 0
        lastClient = ""
        onState(NtpServerState(running = true, port = cfg.listenPort))
        val subnets = cfg.allowSubnets.mapNotNull { parseCidr(it) }
        val allowAll = cfg.allowSubnets.any { it.trim() == "0.0.0.0/0" || it.trim() == "::/0" }

        thread(name = "ntp-server", isDaemon = true) {
            val buf = ByteArray(512)
            var failures = 0
            while (running.get() && !sock.isClosed) {
                val pkt = DatagramPacket(buf, buf.size)
                try {
                    sock.receive(pkt)
                    failures = 0
                } catch (e: SocketException) {
                    if (running.get() && !sock.isClosed) {
                        running.set(false)
                        onState(NtpServerState(running = false, port = cfg.listenPort, error = com.pschatzmann.timeservices.raw(e)))
                    }
                    break
                } catch (e: Exception) {
                    if (++failures >= 10) {
                        running.set(false)
                        onState(NtpServerState(running = false, port = cfg.listenPort, error = com.pschatzmann.timeservices.raw(e)))
                        break
                    }
                    Thread.sleep(100)
                    continue
                }
                try {
                    val rxMs = clock().nowMs
                    if (pkt.length < 48) continue
                    val mode = buf[0].toInt() and 0x07
                    if (mode != 3 && mode != 1) continue

                    val client = pkt.address
                    if (!allowAll && !subnets.any { it.contains(client) }) {
                        dropped++
                        report(cfg.listenPort)
                        continue
                    }
                    if (cfg.rateLimitPerMin > 0 && !withinRate(client.hostAddress ?: "", cfg.rateLimitPerMin, rxMs)) {
                        dropped++
                        report(cfg.listenPort)
                        continue
                    }

                    val c = clock()
                    val resp = ByteArray(48)
                    val vn = ((buf[0].toInt() shr 3) and 0x07).coerceIn(1, 4)
                    resp[0] = (((c.leapIndicator and 3) shl 6) or (vn shl 3) or 4).toByte()
                    resp[1] = c.stratum.toByte()
                    resp[2] = buf[2]
                    resp[3] = (-18).toByte()
                    Ntp.writeU32(resp, 4, (c.rootDelayMs / 1000.0 * 65536.0).toLong().coerceAtLeast(0))
                    Ntp.writeU32(resp, 8, (c.rootDispersionMs / 1000.0 * 65536.0).toLong().coerceAtLeast(0))
                    val ref = cfg.refId.padEnd(4, ' ').take(4)
                    for (i in 0 until 4) resp[12 + i] = ref[i].code.toByte()
                    Ntp.writeTimestamp(resp, 16, c.lastDisciplineMs)
                    System.arraycopy(buf, 40, resp, 24, 8) // origin = client's transmit timestamp
                    Ntp.writeTimestamp(resp, 32, rxMs)
                    Ntp.writeTimestamp(resp, 40, clock().nowMs)

                    try {
                        sock.send(DatagramPacket(resp, resp.size, client, pkt.port))
                        served++
                        lastClient = client.hostAddress ?: ""
                        report(cfg.listenPort)
                    } catch (e: Exception) {
                        // client vanished; ignore
                    }
                } catch (e: Exception) {
                    Log.w("TimeServices", "NTP request handling failed", e)
                }
            }
        }
    }

    @Synchronized
    fun stop() {
        running.set(false)
        socket?.close()
        socket = null
        windows.clear()
        onState(NtpServerState(running = false))
    }

    private fun report(port: Int) {
        onState(NtpServerState(running = true, port = port, packetsServed = served, dropped = dropped, lastClient = lastClient))
    }

    private fun withinRate(key: String, limit: Int, nowMs: Long): Boolean {
        val w = windows.getOrPut(key) { Window(nowMs, 0) }
        synchronized(w) {
            if (nowMs - w.startMs >= 60_000) {
                w.startMs = nowMs
                w.count = 0
            }
            w.count++
            return w.count <= limit
        }
    }

    private class Cidr(val net: ByteArray, val prefix: Int) {
        fun contains(addr: InetAddress): Boolean {
            val a = addr.address
            if (a.size != net.size) return false
            var bits = prefix
            for (i in a.indices) {
                if (bits <= 0) break
                val mask = if (bits >= 8) 0xFF else (0xFF shl (8 - bits)) and 0xFF
                if ((a[i].toInt() and mask) != (net[i].toInt() and mask)) return false
                bits -= 8
            }
            return true
        }
    }

    private fun parseCidr(text: String): Cidr? = try {
        val parts = text.trim().split("/")
        val addr = InetAddress.getByName(parts[0])
        val prefix = if (parts.size > 1) parts[1].toInt() else (if (addr is Inet4Address) 32 else 128)
        Cidr(addr.address, prefix)
    } catch (e: Exception) {
        null
    }
}
