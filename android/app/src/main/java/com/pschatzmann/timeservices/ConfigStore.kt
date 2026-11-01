package com.pschatzmann.timeservices

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Persists [SystemConfig] as JSON in SharedPreferences (replaces the Node server's in-memory config). */
class ConfigStore(ctx: Context) {
    private val prefs = ctx.getSharedPreferences("timeservices", Context.MODE_PRIVATE)

    fun load(): SystemConfig {
        val raw = prefs.getString(KEY_CONFIG, null) ?: return Defaults.config()
        return try {
            parse(JSONObject(raw))
        } catch (e: Exception) {
            Defaults.config()
        }
    }

    fun save(config: SystemConfig) {
        prefs.edit().putString(KEY_CONFIG, toJson(config).toString()).apply()
    }

    fun loadDark(): Boolean = prefs.getBoolean(KEY_DARK, true)

    fun saveDark(dark: Boolean) {
        prefs.edit().putBoolean(KEY_DARK, dark).apply()
    }

    private fun toJson(c: SystemConfig) = JSONObject().apply {
        put("keepAwake", c.keepAwake)
        put("gnssRawEnabled", c.gnssRawEnabled)
        put("publishSourceId", c.publishSourceId)
        put("disciplining", JSONObject().apply {
            put("algorithm", c.disciplining.algorithm)
            put("pllTimeConstantSec", c.disciplining.pllTimeConstantSec)
            put("fllBandwidthHz", c.disciplining.fllBandwidthHz)
            put("maxSlewPpm", c.disciplining.maxSlewPpm)
            put("holdoverTimeoutSec", c.disciplining.holdoverTimeoutSec)
            put("preferStratum1", c.disciplining.preferStratum1)
        })
        put("ntpServer", JSONObject().apply {
            put("enabled", c.ntpServer.enabled)
            put("listenPort", c.ntpServer.listenPort)
            put("stratum", c.ntpServer.stratum)
            put("refId", c.ntpServer.refId)
            put("leapIndicator", c.ntpServer.leapIndicator)
            put("rateLimitPerMin", c.ntpServer.rateLimitPerMin)
            put("allowSubnets", JSONArray(c.ntpServer.allowSubnets))
        })
        put("bleCts", JSONObject().apply {
            put("enabled", c.bleCts.enabled)
            put("advIntervalMs", c.bleCts.advIntervalMs)
            put("sendNotifications", c.bleCts.sendNotifications)
            put("notifyIntervalMs", c.bleCts.notifyIntervalMs)
        })
        put("sources", JSONArray().also { arr ->
            c.sources.forEach { s ->
                arr.put(JSONObject().apply {
                    put("id", s.id)
                    put("name", s.name)
                    put("type", s.type.name)
                    put("enabled", s.enabled)
                    put("stratum", s.stratum)
                    put("weight", s.weight)
                    put("pollIntervalSec", s.pollIntervalSec)
                    put("hostOrPort", s.hostOrPort)
                    put("deviceAddress", s.deviceAddress)
                })
            }
        })
    }

    private fun parse(o: JSONObject): SystemConfig {
        val d = o.getJSONObject("disciplining")
        val n = o.getJSONObject("ntpServer")
        val b = o.getJSONObject("bleCts")
        val subnets = n.getJSONArray("allowSubnets")
        val srcs = o.getJSONArray("sources")
        return SystemConfig(
            keepAwake = o.optBoolean("keepAwake", false),
            gnssRawEnabled = o.optBoolean("gnssRawEnabled", true),
            publishSourceId = o.optString("publishSourceId", "fused"),
            disciplining = DiscipliningConfig(
                algorithm = d.getString("algorithm"),
                pllTimeConstantSec = d.getInt("pllTimeConstantSec"),
                fllBandwidthHz = d.getDouble("fllBandwidthHz"),
                maxSlewPpm = d.getInt("maxSlewPpm"),
                holdoverTimeoutSec = d.getInt("holdoverTimeoutSec"),
                preferStratum1 = d.getBoolean("preferStratum1"),
            ),
            ntpServer = NtpServerConfig(
                enabled = n.getBoolean("enabled"),
                listenPort = n.getInt("listenPort"),
                stratum = n.getInt("stratum"),
                refId = n.getString("refId"),
                leapIndicator = n.getInt("leapIndicator"),
                rateLimitPerMin = n.getInt("rateLimitPerMin"),
                allowSubnets = List(subnets.length()) { subnets.getString(it) },
            ),
            bleCts = BleCtsConfig(
                enabled = b.getBoolean("enabled"),
                advIntervalMs = b.getInt("advIntervalMs"),
                sendNotifications = b.getBoolean("sendNotifications"),
                notifyIntervalMs = b.optInt("notifyIntervalMs", 1000),
            ),
            sources = (0 until srcs.length()).map { srcs.getJSONObject(it) }.filter { it.getString("type") != "ATOMIC" }.map { s ->
                SourceConfig(
                    id = s.getString("id"),
                    name = s.getString("name"),
                    type = SourceType.valueOf(s.getString("type")),
                    enabled = s.getBoolean("enabled"),
                    stratum = s.getInt("stratum"),
                    weight = s.getDouble("weight"),
                    pollIntervalSec = s.getInt("pollIntervalSec"),
                    hostOrPort = s.optString("hostOrPort", ""),
                    deviceAddress = s.optString("deviceAddress", ""),
                )
            },
        )
    }

    private companion object {
        const val KEY_CONFIG = "config"
        const val KEY_DARK = "dark"
    }
}
