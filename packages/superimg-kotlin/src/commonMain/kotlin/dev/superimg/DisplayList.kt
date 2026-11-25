package dev.superimg

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonClassDiscriminator

public const val DISPLAY_LIST_KIND: String = "@foxworth/superimg/display-list"
public const val DISPLAY_LIST_SCHEMA_VERSION: Int = 1

@OptIn(ExperimentalSerializationApi::class)
public val DisplayListJson: Json = Json {
    ignoreUnknownKeys = false
    encodeDefaults = true
    explicitNulls = false
}

public class DisplayListValidationException(message: String) : IllegalArgumentException(message)

@Serializable
public data class DisplayListFrame(
    val kind: String = DISPLAY_LIST_KIND,
    val schemaVersion: Int = DISPLAY_LIST_SCHEMA_VERSION,
    val width: Double,
    val height: Double,
    val ops: List<DisplayOp>,
    val anchors: List<DisplayAnchor> = emptyList(),
    val issues: List<DisplayIssue> = emptyList(),
) {
    /**
     * Strictly validates the frame against DisplayList v1 invariants:
     * finite coordinates, unique operation IDs, valid hex colors, and non-negative bounds.
     */
    public fun validate() {
        requireValid(kind == DISPLAY_LIST_KIND) {
            "Expected kind '$DISPLAY_LIST_KIND', got '$kind'"
        }
        requireValid(schemaVersion == DISPLAY_LIST_SCHEMA_VERSION) {
            "Unsupported DisplayList schemaVersion: $schemaVersion"
        }
        requireValid(width.isFinite() && height.isFinite() && width > 0.0 && height > 0.0) {
            "Canvas dimensions must be finite and positive: ${width}x$height"
        }

        val seenIds = HashSet<String>(ops.size)
        for (op in ops) {
            requireValid(op.id.isNotEmpty()) { "DisplayOp id must be non-empty" }
            requireValid(seenIds.add(op.id)) { "Duplicate DisplayOp id '${op.id}'" }
            op.bounds.validate("op '${op.id}' bounds")
            requireValid(op.opacity.isFinite() && op.opacity in 0.0..1.0) {
                "Invalid opacity ${op.opacity} on op '${op.id}'"
            }
            op.matrix?.validate("op '${op.id}' matrix")
            op.clips?.forEachIndexed { index, clip ->
                clip.validate("op '${op.id}' clips[$index]")
            }
            when (op) {
                is DisplayOp.Rect -> {
                    op.fill?.validate("op '${op.id}' fill")
                    op.stroke?.validate("op '${op.id}' stroke")
                    if (op.radius != null) {
                        requireValid(op.radius.isFinite() && op.radius >= 0.0) {
                            "Invalid radius ${op.radius} on rect '${op.id}'"
                        }
                    }
                }
                is DisplayOp.Ellipse -> {
                    op.fill?.validate("op '${op.id}' fill")
                    op.stroke?.validate("op '${op.id}' stroke")
                }
                is DisplayOp.Path -> {
                    requireValid(op.d.isNotBlank()) { "Path op '${op.id}' has blank 'd'" }
                    op.fill?.validate("op '${op.id}' fill")
                    op.stroke?.validate("op '${op.id}' stroke")
                }
                is DisplayOp.Image -> {
                    requireValid(op.asset.isNotEmpty()) { "Image op '${op.id}' missing asset" }
                    if (op.radius != null) {
                        requireValid(op.radius.isFinite() && op.radius >= 0.0) {
                            "Invalid radius ${op.radius} on image '${op.id}'"
                        }
                    }
                }
                is DisplayOp.Text -> {
                    requireValid(op.fontFamily.isNotEmpty()) {
                        "Text op '${op.id}' missing fontFamily"
                    }
                    requireValid(op.fontSize.isFinite() && op.fontSize > 0.0) {
                        "Text op '${op.id}' invalid fontSize ${op.fontSize}"
                    }
                    requireValid(op.fontWeight in 1..1000) {
                        "Text op '${op.id}' invalid fontWeight ${op.fontWeight}"
                    }
                    requireValid(parseHexColorRgba(op.color) != null) {
                        "Text op '${op.id}' invalid hex color '${op.color}'"
                    }
                    if (op.letterSpacing != null) {
                        requireValid(op.letterSpacing.isFinite()) {
                            "Text op '${op.id}' invalid letterSpacing ${op.letterSpacing}"
                        }
                    }
                    if (op.lineHeight != null) {
                        requireValid(op.lineHeight.isFinite() && op.lineHeight > 0.0) {
                            "Text op '${op.id}' invalid lineHeight ${op.lineHeight}"
                        }
                    }
                    op.lines.forEachIndexed { index, line ->
                        line.validate("op '${op.id}' lines[$index]")
                    }
                }
            }
        }

        val seenAnchors = HashMap<String, HashSet<String>>()
        for (anchor in anchors) {
            requireValid(anchor.entity.isNotEmpty() && anchor.name.isNotEmpty()) {
                "Anchor entity and name must be non-empty"
            }
            requireValid(anchor.x.isFinite() && anchor.y.isFinite()) {
                "Anchor '${anchor.entity}.${anchor.name}' coordinates must be finite"
            }
            val names = seenAnchors.getOrPut(anchor.entity) { HashSet() }
            requireValid(names.add(anchor.name)) {
                "Duplicate anchor '${anchor.entity}.${anchor.name}'"
            }
        }

        for (issue in issues) {
            if (issue.nodeId != null) {
                requireValid(issue.nodeId.isNotEmpty()) { "Issue nodeId must be non-empty when present" }
            }
            requireValid(issue.code.isNotEmpty()) { "Issue code must be non-empty" }
            requireValid(issue.message.isNotEmpty()) { "Issue message must be non-empty" }
        }
    }

    /** Convenience lookup matching Swift's anchor query semantics in raw artwork space. */
    public fun rawAnchor(entity: String, name: String): DisplayAnchor? =
        anchors.firstOrNull { it.entity == entity && it.name == name }
}

@Serializable
public data class DisplayBounds(
    val x: Double,
    val y: Double,
    val width: Double,
    val height: Double,
) {
    internal fun validate(label: String) {
        requireValid(
            x.isFinite() && y.isFinite() && width.isFinite() && height.isFinite() &&
                width >= 0.0 && height >= 0.0,
        ) {
            "Invalid $label: ($x, $y, $width, $height)"
        }
    }
}

@Serializable
public data class DisplayMatrix(
    val a: Double,
    val b: Double,
    val c: Double,
    val d: Double,
    val e: Double,
    val f: Double,
) {
    internal fun validate(label: String) {
        requireValid(
            a.isFinite() && b.isFinite() && c.isFinite() &&
                d.isFinite() && e.isFinite() && f.isFinite(),
        ) {
            "Non-finite $label"
        }
    }

    public fun mapPoint(x: Double, y: Double): Pair<Double, Double> =
        (a * x + c * y + e) to (b * x + d * y + f)
}

@Serializable
public enum class DisplayBlendMode {
    @SerialName("normal")
    NORMAL,

    @SerialName("multiply")
    MULTIPLY,

    @SerialName("screen")
    SCREEN,

    @SerialName("overlay")
    OVERLAY,
}

@Serializable
public data class DisplayClip(
    val x: Double,
    val y: Double,
    val width: Double,
    val height: Double,
    val radius: Double? = null,
) {
    internal fun validate(label: String) {
        requireValid(
            x.isFinite() && y.isFinite() && width.isFinite() && height.isFinite() &&
                width >= 0.0 && height >= 0.0,
        ) {
            "Invalid $label: ($x, $y, $width, $height)"
        }
        if (radius != null) {
            requireValid(radius.isFinite() && radius >= 0.0) {
                "Invalid $label radius: $radius"
            }
        }
    }
}

@OptIn(ExperimentalSerializationApi::class)
@Serializable
@JsonClassDiscriminator("kind")
public sealed interface DisplayOp {
    public val id: String
    public val bounds: DisplayBounds
    public val matrix: DisplayMatrix?
    public val opacity: Double
    public val blendMode: DisplayBlendMode?
    public val clips: List<DisplayClip>?

    @Serializable
    @SerialName("rect")
    public data class Rect(
        override val id: String,
        override val bounds: DisplayBounds,
        override val matrix: DisplayMatrix? = null,
        override val opacity: Double = 1.0,
        override val blendMode: DisplayBlendMode? = null,
        override val clips: List<DisplayClip>? = null,
        val fill: DisplayPaint? = null,
        val stroke: DisplayStroke? = null,
        val radius: Double? = null,
    ) : DisplayOp

    @Serializable
    @SerialName("ellipse")
    public data class Ellipse(
        override val id: String,
        override val bounds: DisplayBounds,
        override val matrix: DisplayMatrix? = null,
        override val opacity: Double = 1.0,
        override val blendMode: DisplayBlendMode? = null,
        override val clips: List<DisplayClip>? = null,
        val fill: DisplayPaint? = null,
        val stroke: DisplayStroke? = null,
    ) : DisplayOp

    @Serializable
    @SerialName("path")
    public data class Path(
        override val id: String,
        override val bounds: DisplayBounds,
        override val matrix: DisplayMatrix? = null,
        override val opacity: Double = 1.0,
        override val blendMode: DisplayBlendMode? = null,
        override val clips: List<DisplayClip>? = null,
        val d: String,
        val fill: DisplayPaint? = null,
        val fillRule: DisplayFillRule? = null,
        val stroke: DisplayStroke? = null,
    ) : DisplayOp

    @Serializable
    @SerialName("image")
    public data class Image(
        override val id: String,
        override val bounds: DisplayBounds,
        override val matrix: DisplayMatrix? = null,
        override val opacity: Double = 1.0,
        override val blendMode: DisplayBlendMode? = null,
        override val clips: List<DisplayClip>? = null,
        val asset: String,
        val fit: DisplayImageFit,
        val pixelArt: Boolean? = null,
        val radius: Double? = null,
    ) : DisplayOp

    @Serializable
    @SerialName("text")
    public data class Text(
        override val id: String,
        override val bounds: DisplayBounds,
        override val matrix: DisplayMatrix? = null,
        override val opacity: Double = 1.0,
        override val blendMode: DisplayBlendMode? = null,
        override val clips: List<DisplayClip>? = null,
        val lines: List<DisplayTextLine>,
        val fontFamily: String,
        val fontSize: Double,
        val fontWeight: Int,
        val fontStyle: DisplayFontStyle,
        val letterSpacing: Double? = null,
        val lineHeight: Double? = null,
        val align: DisplayTextAlign,
        val color: String,
        val metricsExact: Boolean,
    ) : DisplayOp
}

@Serializable
public enum class DisplayFillRule {
    @SerialName("nonzero")
    NONZERO,

    @SerialName("evenodd")
    EVENODD,
}

@Serializable
public enum class DisplayImageFit {
    @SerialName("cover")
    COVER,

    @SerialName("contain")
    CONTAIN,

    @SerialName("fill")
    FILL,
}

@Serializable
public enum class DisplayFontStyle {
    @SerialName("normal")
    NORMAL,

    @SerialName("italic")
    ITALIC,
}

@Serializable
public enum class DisplayTextAlign {
    @SerialName("left")
    LEFT,

    @SerialName("center")
    CENTER,

    @SerialName("right")
    RIGHT,
}

@Serializable
public data class DisplayTextLine(
    val text: String,
    val x: Double,
    val y: Double,
    val baselineY: Double,
    val width: Double,
) {
    internal fun validate(label: String) {
        requireValid(x.isFinite() && y.isFinite() && baselineY.isFinite() && width.isFinite() && width >= 0.0) {
            "Invalid $label coordinates"
        }
    }
}

@Serializable
public data class GradientStop(
    val color: String,
    val offset: Double,
) {
    internal fun validate(label: String) {
        requireValid(parseHexColorRgba(color) != null) {
            "Invalid gradient stop color '$color' in $label"
        }
        requireValid(offset.isFinite() && offset in 0.0..1.0) {
            "Invalid gradient stop offset $offset in $label"
        }
    }
}

@OptIn(ExperimentalSerializationApi::class)
@Serializable
@JsonClassDiscriminator("kind")
public sealed interface DisplayPaint {
    @Serializable
    @SerialName("solid")
    public data class Solid(val color: String) : DisplayPaint

    @Serializable
    @SerialName("linearGradient")
    public data class LinearGradient(
        val x1: Double,
        val y1: Double,
        val x2: Double,
        val y2: Double,
        val stops: List<GradientStop>,
    ) : DisplayPaint

    @Serializable
    @SerialName("radialGradient")
    public data class RadialGradient(
        val cx: Double,
        val cy: Double,
        val r: Double,
        val stops: List<GradientStop>,
    ) : DisplayPaint
}

internal fun DisplayPaint.validate(label: String) {
    when (this) {
        is DisplayPaint.Solid -> {
            requireValid(parseHexColorRgba(color) != null) {
                "Invalid solid color '$color' in $label"
            }
        }
        is DisplayPaint.LinearGradient -> {
            requireValid(x1.isFinite() && y1.isFinite() && x2.isFinite() && y2.isFinite()) {
                "Non-finite linearGradient coordinates in $label"
            }
            requireValid(stops.isNotEmpty()) { "linearGradient requires at least one stop in $label" }
            stops.forEachIndexed { index, stop -> stop.validate("$label.stops[$index]") }
        }
        is DisplayPaint.RadialGradient -> {
            requireValid(cx.isFinite() && cy.isFinite() && r.isFinite() && r >= 0.0) {
                "Invalid radialGradient geometry in $label"
            }
            requireValid(stops.isNotEmpty()) { "radialGradient requires at least one stop in $label" }
            stops.forEachIndexed { index, stop -> stop.validate("$label.stops[$index]") }
        }
    }
}

@Serializable
public enum class DisplayLineCap {
    @SerialName("butt")
    BUTT,

    @SerialName("round")
    ROUND,

    @SerialName("square")
    SQUARE,
}

@Serializable
public enum class DisplayLineJoin {
    @SerialName("miter")
    MITER,

    @SerialName("round")
    ROUND,

    @SerialName("bevel")
    BEVEL,
}

@Serializable
public data class DisplayStroke(
    val color: String,
    val width: Double,
    val lineCap: DisplayLineCap? = null,
    val lineJoin: DisplayLineJoin? = null,
    val dashArray: List<Double>? = null,
    val dashOffset: Double? = null,
) {
    internal fun validate(label: String) {
        requireValid(parseHexColorRgba(color) != null) {
            "Invalid stroke color '$color' in $label"
        }
        requireValid(width.isFinite() && width >= 0.0) {
            "Invalid stroke width $width in $label"
        }
        dashArray?.forEachIndexed { index, dash ->
            requireValid(dash.isFinite() && dash >= 0.0) {
                "Invalid stroke dashArray[$index]=$dash in $label"
            }
        }
        if (dashOffset != null) {
            requireValid(dashOffset.isFinite()) {
                "Invalid stroke dashOffset $dashOffset in $label"
            }
        }
    }
}

@Serializable
public data class DisplayAnchor(
    val entity: String,
    val name: String,
    val x: Double,
    val y: Double,
)

@Serializable
public data class DisplayIssue(
    val nodeId: String? = null,
    val code: String,
    val message: String,
)

/**
 * Unpacked 8-bit sRGB + alpha color components.
 */
public data class RgbaColor(
    val r: Int,
    val g: Int,
    val b: Int,
    val a: Int,
) {
    /** Packed 0xAARRGGBB 32-bit integer matching Android Color / Compose Color(Int). */
    public fun toArgbInt(): Int =
        ((a and 0xFF) shl 24) or
            ((r and 0xFF) shl 16) or
            ((g and 0xFF) shl 8) or
            (b and 0xFF)
}

/**
 * Parses canonical `#rrggbb` or `#rrggbbaa` hex color strings.
 * Returns null for invalid formats (including 3-digit shorthand or non-hex digits).
 */
public fun parseHexColorRgba(color: String): RgbaColor? {
    if (!color.startsWith('#')) return null
    val hex = color.substring(1)
    if (hex.length != 6 && hex.length != 8) return null
    for (ch in hex) {
        val isHex = ch in '0'..'9' || ch in 'a'..'f' || ch in 'A'..'F'
        if (!isHex) return null
    }
    val r = hex.substring(0, 2).toInt(16)
    val g = hex.substring(2, 4).toInt(16)
    val b = hex.substring(4, 6).toInt(16)
    val a = if (hex.length == 8) hex.substring(6, 8).toInt(16) else 0xFF
    return RgbaColor(r = r, g = g, b = b, a = a)
}

/**
 * Decodes and optionally validates a DisplayList v1 JSON payload.
 */
public fun parseDisplayListFrame(json: String, validate: Boolean = true): DisplayListFrame {
    val frame = DisplayListJson.decodeFromString<DisplayListFrame>(json)
    if (validate) frame.validate()
    return frame
}

/**
 * Encodes a DisplayList v1 frame using the canonical JSON configuration.
 */
public fun encodeDisplayListFrame(frame: DisplayListFrame, validate: Boolean = true): String {
    if (validate) frame.validate()
    return DisplayListJson.encodeToString(frame)
}

private inline fun requireValid(condition: Boolean, lazyMessage: () -> String) {
    if (!condition) throw DisplayListValidationException(lazyMessage())
}
