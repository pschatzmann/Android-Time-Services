package com.pschatzmann.timeservices

import android.annotation.SuppressLint
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import java.util.Collections

/**
 * Tracks whether any Wi-Fi, mobile or Ethernet network is up. Networks without internet access
 * (a LAN-only Wi-Fi, for instance) count, because the NTP server is useful there too.
 * Phone hotspot (tethering) is not visible to apps as a network, so it does not count.
 */
class NetworkMonitor(ctx: Context, private val onChange: (Boolean) -> Unit) {
    private val cm = ctx.getSystemService(ConnectivityManager::class.java)
    private val networks: MutableSet<Network> = Collections.synchronizedSet(mutableSetOf())

    private val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            networks.add(network)
            onChange(true)
        }

        override fun onLost(network: Network) {
            networks.remove(network)
            onChange(networks.isNotEmpty())
        }
    }

    @Suppress("DEPRECATION")
    @SuppressLint("MissingPermission")
    fun isCurrentlyAvailable(): Boolean = try {
        cm.allNetworks.any { n ->
            cm.getNetworkCapabilities(n)?.let {
                it.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                    it.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
                    it.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
            } == true
        }
    } catch (e: Exception) {
        true
    }

    @SuppressLint("MissingPermission")
    fun start() {
        val request = NetworkRequest.Builder()
            .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .addTransportType(NetworkCapabilities.TRANSPORT_CELLULAR)
            .addTransportType(NetworkCapabilities.TRANSPORT_ETHERNET)
            .build()
        try {
            cm.registerNetworkCallback(request, callback)
        } catch (e: Exception) {
            onChange(true) // cannot observe connectivity: do not block the server
        }
    }
}
