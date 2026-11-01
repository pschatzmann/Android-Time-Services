package com.pschatzmann.chronos

import java.time.Instant
import java.time.ZoneId
import java.time.format.TextStyle
import java.util.Locale

data class TimeZoneDetails(
    val iana: String,
    val displayName: String,
    val shortName: String,
    val offsetMinutes: Int,
    val offsetFormatted: String,
    /** Standard-time offset in 15 min units, as carried by BLE CTS Local Time Information (0x2A0F). */
    val quarterHours: Int,
    val isDst: Boolean,
    /** 0=standard, 2=+30 min, 4=+1 h, 8=+2 h (BLE CTS DST Offset). */
    val dstOffsetCode: Int,
    val nextTransition: NextTransition?,
)

data class NextTransition(val gapHours: Double, val date: String)

object TimeZoneEngine {
    const val AUTO = "AUTO"

    /** Zones offered in the picker; AUTO follows the device setting. */
    val popular: List<String> = listOf(
        AUTO, "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
        "America/Anchorage", "Pacific/Honolulu", "Europe/London", "Europe/Berlin", "Europe/Paris",
        "Europe/Zurich", "Europe/Helsinki", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo",
        "Australia/Sydney", "Pacific/Auckland",
    )

    /** Long zone name in the current app language, e.g. "Mitteleuropäische Zeit". */
    fun zoneName(id: String): String =
        ZoneId.of(id).getDisplayName(TextStyle.FULL, Locale.getDefault())

    fun zone(selected: String): ZoneId =
        if (selected == AUTO) ZoneId.systemDefault() else ZoneId.of(selected)

    fun details(epochMs: Long, selected: String): TimeZoneDetails {
        val zone = zone(selected)
        val instant = Instant.ofEpochMilli(epochMs)
        val rules = zone.rules
        val offsetSec = rules.getOffset(instant).totalSeconds
        val offsetMin = offsetSec / 60
        val stdMin = rules.getStandardOffset(instant).totalSeconds / 60
        val dstMin = rules.getDaylightSavings(instant).toMinutes().toInt()

        val sign = if (offsetMin >= 0) "+" else "-"
        val abs = Math.abs(offsetMin)
        val formatted = "UTC%s%02d:%02d".format(sign, abs / 60, abs % 60)

        val dstCode = when {
            dstMin >= 120 -> 8
            dstMin >= 60 -> 4
            dstMin >= 30 -> 2
            else -> 0
        }
        val isDst = rules.isDaylightSavings(instant)

        val next = rules.nextTransition(instant)
        val nextInfo = next?.let {
            NextTransition(
                gapHours = (it.offsetAfter.totalSeconds - it.offsetBefore.totalSeconds) / 3600.0,
                date = it.dateTimeBefore.toLocalDate().toString(),
            )
        }

        return TimeZoneDetails(
            iana = zone.id,
            displayName = zone.getDisplayName(TextStyle.FULL, Locale.getDefault()),
            shortName = zone.getDisplayName(TextStyle.SHORT, Locale.getDefault()),
            offsetMinutes = offsetMin,
            offsetFormatted = formatted,
            quarterHours = stdMin / 15,
            isDst = isDst,
            dstOffsetCode = dstCode,
            nextTransition = nextInfo,
        )
    }
}
