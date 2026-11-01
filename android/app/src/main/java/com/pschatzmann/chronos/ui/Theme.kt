package com.pschatzmann.chronos.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.background
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.log10
import kotlin.math.pow
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

val Cyan = Color(0xFF06B6D4)
val Emerald = Color(0xFF10B981)
val Amber = Color(0xFFF59E0B)
val Purple = Color(0xFFA78BFA)
val Blue = Color(0xFF3B82F6)
val Rose = Color(0xFFF43F5E)

private val DarkScheme = darkColorScheme(
    primary = Cyan, onPrimary = Color(0xFF020617),
    background = Color(0xFF020617), onBackground = Color(0xFFF1F5F9),
    surface = Color(0xFF0F172A), onSurface = Color(0xFFF1F5F9),
    surfaceVariant = Color(0xFF1E293B), onSurfaceVariant = Color(0xFF94A3B8),
    outline = Color(0xFF1E293B), secondary = Emerald,
)
private val LightScheme = lightColorScheme(
    primary = Color(0xFF0891B2), onPrimary = Color.White,
    background = Color(0xFFF8FAFC), onBackground = Color(0xFF0F172A),
    surface = Color.White, onSurface = Color(0xFF0F172A),
    surfaceVariant = Color(0xFFE2E8F0), onSurfaceVariant = Color(0xFF475569),
    outline = Color(0xFFCBD5E1), secondary = Color(0xFF059669),
)

@Composable
fun ChronosTheme(dark: Boolean, content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (dark) DarkScheme else LightScheme, content = content)
}

val Mono = FontFamily.Monospace

@Composable
fun ChronosCard(
    modifier: Modifier = Modifier,
    accent: Color? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, accent?.copy(alpha = 0.5f) ?: MaterialTheme.colorScheme.outline),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp), content = content)
    }
}

@Composable
fun Chip(text: String, color: Color = Cyan, filled: Boolean = false) {
    Surface(
        shape = RoundedCornerShape(50),
        color = if (filled) color else color.copy(alpha = 0.15f),
        border = BorderStroke(1.dp, color.copy(alpha = 0.4f)),
    ) {
        Text(
            text,
            Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            color = if (filled) Color(0xFF020617) else color,
            fontFamily = Mono, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
fun StatTile(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    color: Color = Emerald,
    sub: String? = null,
    valueSize: androidx.compose.ui.unit.TextUnit = 17.sp,
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Column(Modifier.padding(12.dp)) {
            Text(label.uppercase(), fontSize = 10.sp, fontFamily = Mono, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, fontSize = valueSize, fontFamily = Mono, fontWeight = FontWeight.Bold, color = color, maxLines = 1)
            if (sub != null) Text(sub, fontSize = 10.sp, fontFamily = Mono, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun ScreenTitle(title: String, subtitle: String) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(title, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text(subtitle, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun KeyValue(key: String, value: String, valueColor: Color = MaterialTheme.colorScheme.onSurface) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(key, fontSize = 12.sp, fontFamily = Mono, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontSize = 12.sp, fontFamily = Mono, fontWeight = FontWeight.SemiBold, color = valueColor)
    }
}

@Composable
fun StatusDot(color: Color) {
    Box(Modifier.size(8.dp).background(color, CircleShape))
}

class ChartSeries(val values: List<Double?>, val color: Color, val dashed: Boolean = false)

/** Round step (1, 2, 5 x 10^n) giving about [targetTicks] gridlines over [range]. */
private fun niceStep(range: Double, targetTicks: Int): Double {
    val raw = range / targetTicks
    val mag = 10.0.pow(floor(log10(raw)))
    val norm = raw / mag
    val nice = when {
        norm < 1.5 -> 1.0
        norm < 3.0 -> 2.0
        norm < 7.0 -> 5.0
        else -> 10.0
    }
    return nice * mag
}

/** Multi-series line chart with a vertical value scale; null values break the line. */
@Composable
fun LineChart(series: List<ChartSeries>, modifier: Modifier = Modifier, minY: Double? = null, maxY: Double? = null) {
    val grid = MaterialTheme.colorScheme.outline
    val axis = MaterialTheme.colorScheme.onSurfaceVariant
    val measurer = rememberTextMeasurer()
    val labelStyle = TextStyle(fontSize = 10.sp, fontFamily = Mono, color = axis)

    Canvas(modifier.fillMaxWidth().height(170.dp)) {
        val all = series.flatMap { it.values }.filterNotNull().filter { it.isFinite() }
        var lo = minY ?: (all.minOrNull() ?: 0.0)
        var hi = maxY ?: (all.maxOrNull() ?: 1.0)
        if (hi - lo < 1e-9) {
            lo -= 0.5
            hi += 0.5
        }
        // Axis bounds snap to round numbers so the labels read cleanly (e.g. -0.2 / 0 / 0.2).
        val step = niceStep(hi - lo, 4)
        val axisLo = if (minY != null) lo else floor(lo / step) * step
        val axisHi = if (maxY != null) hi else ceil(hi / step) * step
        // Large scales are abbreviated (6M, 500k) so the axis stays narrow.
        val (divisor, suffix) = when {
            step >= 1e6 -> 1e6 to "M"
            step >= 1e3 -> 1e3 to "k"
            else -> 1.0 to ""
        }
        val decimals = (-floor(log10(step / divisor))).toInt().coerceIn(0, 4)
        fun label(v: Double): String =
            if (abs(v) < step * 1e-6) "0" else "%.${decimals}f".format(v / divisor) + suffix

        val ticks = buildList {
            var v = ceil(axisLo / step - 1e-9) * step
            while (v <= axisHi + step * 1e-6) {
                add(v)
                v += step
            }
        }
        val layouts = ticks.map { measurer.measure(label(it), labelStyle) }
        val labelW = (layouts.maxOfOrNull { it.size.width } ?: 0).toFloat()
        val left = labelW + 12f
        val right = 8f
        val top = 10f
        val bottom = 10f
        val plotW = size.width - left - right
        val plotH = size.height - top - bottom
        fun yOf(v: Double) = top + plotH - ((v - axisLo) / (axisHi - axisLo)).toFloat() * plotH

        ticks.forEach { v ->
            val y = yOf(v)
            val isZero = abs(v) < step * 1e-6
            drawLine(
                if (isZero) axis.copy(alpha = 0.5f) else grid,
                Offset(left, y), Offset(size.width - right, y),
                strokeWidth = if (isZero) 2f else 1f,
                pathEffect = if (isZero) null else PathEffect.dashPathEffect(floatArrayOf(6f, 6f)),
            )
        }
        drawLine(grid, Offset(left, top), Offset(left, top + plotH), strokeWidth = 1f)

        for (s in series) {
            val n = s.values.size
            if (n < 2) continue
            val path = Path()
            var pen = false
            s.values.forEachIndexed { i, v ->
                if (v == null || !v.isFinite()) {
                    pen = false
                    return@forEachIndexed
                }
                val x = left + plotW * i / (n - 1)
                val y = yOf(v.coerceIn(axisLo, axisHi))
                if (!pen) path.moveTo(x, y) else path.lineTo(x, y)
                pen = true
            }
            drawPath(
                path, s.color,
                style = Stroke(
                    width = 4f,
                    pathEffect = if (s.dashed) PathEffect.dashPathEffect(floatArrayOf(10f, 6f)) else null,
                ),
            )
        }

        // Axis labels last: text drawing must not be able to affect the lines above.
        ticks.forEachIndexed { i, v ->
            val l = layouts[i]
            val ty = (yOf(v) - l.size.height / 2f).coerceIn(0f, size.height - l.size.height)
            drawText(l, topLeft = Offset(left - 8f - l.size.width, ty))
        }
    }
}

/** One-to-two line explanation shown under a chart. */
@Composable
fun ChartNote(text: String) {
    Text(text, fontSize = 11.sp, lineHeight = 15.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

/** Short explanation under a section heading. */
@Composable
fun SectionNote(text: String) {
    Text(text, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
}
