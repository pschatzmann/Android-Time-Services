package com.pschatzmann.timeservices

import android.content.Context
import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

/**
 * Text produced by the engine, Bluetooth or network code. It is kept as a resource id plus
 * arguments (not a ready-made string) so it is translated when shown, in the current app language.
 */
sealed interface UiText {
    data class Res(@StringRes val id: Int, val args: List<Any> = emptyList()) : UiText

    /** Text that is not ours to translate, e.g. a system exception message. */
    data class Raw(val text: String) : UiText
}

fun res(@StringRes id: Int, vararg args: Any): UiText = UiText.Res(id, args.toList())

fun raw(e: Throwable): UiText = UiText.Raw(e.message ?: e.javaClass.simpleName)

fun UiText.resolve(ctx: Context): String = when (this) {
    is UiText.Res -> ctx.getString(id, *args.toTypedArray())
    is UiText.Raw -> text
}

@Composable
fun UiText.asString(): String = resolve(LocalContext.current)
