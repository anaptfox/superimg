package dev.superimg

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin
import kotlin.math.sqrt

public class SvgPathParseException(message: String) : IllegalArgumentException(message)

/**
 * Platform-agnostic vector path segment emitted by [SvgPathParser].
 */
public sealed interface SvgPathSegment {
    public data class MoveTo(val x: Double, val y: Double) : SvgPathSegment
    public data class LineTo(val x: Double, val y: Double) : SvgPathSegment
    public data class CubicTo(
        val x1: Double,
        val y1: Double,
        val x2: Double,
        val y2: Double,
        val x: Double,
        val y: Double,
    ) : SvgPathSegment

    public data class QuadTo(
        val x1: Double,
        val y1: Double,
        val x: Double,
        val y: Double,
    ) : SvgPathSegment

    public data class ArcTo(
        val rx: Double,
        val ry: Double,
        val xAxisRotationDegrees: Double,
        val largeArc: Boolean,
        val sweep: Boolean,
        val x: Double,
        val y: Double,
    ) : SvgPathSegment

    public data object Close : SvgPathSegment
}

/**
 * Pure-Kotlin SVG path `d` tokenizer and parser supporting M/L/H/V/C/S/Q/T/A/Z
 * (both absolute uppercase and relative lowercase commands).
 *
 * Emits normalized absolute [SvgPathSegment] primitives suitable for Android
 * `Path`, Compose `Path`, or Skia `Path` builders.
 */
public object SvgPathParser {
    public fun parse(d: String): List<SvgPathSegment> {
        val scanner = Scanner(d)
        val segments = ArrayList<SvgPathSegment>()

        var currentX = 0.0
        var currentY = 0.0
        var subpathStartX = 0.0
        var subpathStartY = 0.0
        var lastCubicCtrlX = 0.0
        var lastCubicCtrlY = 0.0
        var lastQuadCtrlX = 0.0
        var lastQuadCtrlY = 0.0
        var prevCmd = '\u0000'

        while (scanner.skipSeparators()) {
            val cmdChar = if (scanner.peekIsCommand()) {
                scanner.readCommand()
            } else {
                if (prevCmd == '\u0000') {
                    throw SvgPathParseException("Expected SVG path command at index ${scanner.index}")
                }
                when (prevCmd) {
                    'M' -> 'L'
                    'm' -> 'l'
                    else -> prevCmd
                }
            }

            val isRelative = cmdChar in 'a'..'z'
            when (cmdChar) {
                'M', 'm' -> {
                    val x = scanner.readNumber() + if (isRelative) currentX else 0.0
                    val y = scanner.readNumber() + if (isRelative) currentY else 0.0
                    segments += SvgPathSegment.MoveTo(x, y)
                    currentX = x
                    currentY = y
                    subpathStartX = x
                    subpathStartY = y
                    prevCmd = cmdChar
                    // Subsequent coordinate pairs after M/m are implicit L/l per SVG spec.
                    while (scanner.hasMoreNumbers()) {
                        val lx = scanner.readNumber() + if (isRelative) currentX else 0.0
                        val ly = scanner.readNumber() + if (isRelative) currentY else 0.0
                        segments += SvgPathSegment.LineTo(lx, ly)
                        currentX = lx
                        currentY = ly
                        prevCmd = if (isRelative) 'l' else 'L'
                    }
                }

                'L', 'l' -> {
                    do {
                        val x = scanner.readNumber() + if (isRelative) currentX else 0.0
                        val y = scanner.readNumber() + if (isRelative) currentY else 0.0
                        segments += SvgPathSegment.LineTo(x, y)
                        currentX = x
                        currentY = y
                    } while (scanner.hasMoreNumbers())
                    prevCmd = cmdChar
                }

                'H', 'h' -> {
                    do {
                        val x = scanner.readNumber() + if (isRelative) currentX else 0.0
                        segments += SvgPathSegment.LineTo(x, currentY)
                        currentX = x
                    } while (scanner.hasMoreNumbers())
                    prevCmd = cmdChar
                }

                'V', 'v' -> {
                    do {
                        val y = scanner.readNumber() + if (isRelative) currentY else 0.0
                        segments += SvgPathSegment.LineTo(currentX, y)
                        currentY = y
                    } while (scanner.hasMoreNumbers())
                    prevCmd = cmdChar
                }

                'C', 'c' -> {
                    do {
                        val baseX = if (isRelative) currentX else 0.0
                        val baseY = if (isRelative) currentY else 0.0
                        val x1 = scanner.readNumber() + baseX
                        val y1 = scanner.readNumber() + baseY
                        val x2 = scanner.readNumber() + baseX
                        val y2 = scanner.readNumber() + baseY
                        val x = scanner.readNumber() + baseX
                        val y = scanner.readNumber() + baseY
                        segments += SvgPathSegment.CubicTo(x1, y1, x2, y2, x, y)
                        lastCubicCtrlX = x2
                        lastCubicCtrlY = y2
                        currentX = x
                        currentY = y
                        prevCmd = cmdChar
                    } while (scanner.hasMoreNumbers())
                }

                'S', 's' -> {
                    do {
                        val baseX = if (isRelative) currentX else 0.0
                        val baseY = if (isRelative) currentY else 0.0
                        val x1 = if (prevCmd == 'C' || prevCmd == 'c' || prevCmd == 'S' || prevCmd == 's') {
                            2.0 * currentX - lastCubicCtrlX
                        } else {
                            currentX
                        }
                        val y1 = if (prevCmd == 'C' || prevCmd == 'c' || prevCmd == 'S' || prevCmd == 's') {
                            2.0 * currentY - lastCubicCtrlY
                        } else {
                            currentY
                        }
                        val x2 = scanner.readNumber() + baseX
                        val y2 = scanner.readNumber() + baseY
                        val x = scanner.readNumber() + baseX
                        val y = scanner.readNumber() + baseY
                        segments += SvgPathSegment.CubicTo(x1, y1, x2, y2, x, y)
                        lastCubicCtrlX = x2
                        lastCubicCtrlY = y2
                        currentX = x
                        currentY = y
                        prevCmd = cmdChar
                    } while (scanner.hasMoreNumbers())
                }

                'Q', 'q' -> {
                    do {
                        val baseX = if (isRelative) currentX else 0.0
                        val baseY = if (isRelative) currentY else 0.0
                        val x1 = scanner.readNumber() + baseX
                        val y1 = scanner.readNumber() + baseY
                        val x = scanner.readNumber() + baseX
                        val y = scanner.readNumber() + baseY
                        segments += SvgPathSegment.QuadTo(x1, y1, x, y)
                        lastQuadCtrlX = x1
                        lastQuadCtrlY = y1
                        currentX = x
                        currentY = y
                        prevCmd = cmdChar
                    } while (scanner.hasMoreNumbers())
                }

                'T', 't' -> {
                    do {
                        val baseX = if (isRelative) currentX else 0.0
                        val baseY = if (isRelative) currentY else 0.0
                        val x1 = if (prevCmd == 'Q' || prevCmd == 'q' || prevCmd == 'T' || prevCmd == 't') {
                            2.0 * currentX - lastQuadCtrlX
                        } else {
                            currentX
                        }
                        val y1 = if (prevCmd == 'Q' || prevCmd == 'q' || prevCmd == 'T' || prevCmd == 't') {
                            2.0 * currentY - lastQuadCtrlY
                        } else {
                            currentY
                        }
                        val x = scanner.readNumber() + baseX
                        val y = scanner.readNumber() + baseY
                        segments += SvgPathSegment.QuadTo(x1, y1, x, y)
                        lastQuadCtrlX = x1
                        lastQuadCtrlY = y1
                        currentX = x
                        currentY = y
                        prevCmd = cmdChar
                    } while (scanner.hasMoreNumbers())
                }

                'A', 'a' -> {
                    do {
                        val baseX = if (isRelative) currentX else 0.0
                        val baseY = if (isRelative) currentY else 0.0
                        val rx = scanner.readNumber()
                        val ry = scanner.readNumber()
                        val xAxisRotation = scanner.readNumber()
                        val largeArc = scanner.readFlag()
                        val sweep = scanner.readFlag()
                        val x = scanner.readNumber() + baseX
                        val y = scanner.readNumber() + baseY
                        segments += SvgPathSegment.ArcTo(
                            rx = rx,
                            ry = ry,
                            xAxisRotationDegrees = xAxisRotation,
                            largeArc = largeArc,
                            sweep = sweep,
                            x = x,
                            y = y,
                        )
                        currentX = x
                        currentY = y
                        prevCmd = cmdChar
                    } while (scanner.hasMoreNumbers())
                }

                'Z', 'z' -> {
                    segments += SvgPathSegment.Close
                    currentX = subpathStartX
                    currentY = subpathStartY
                    prevCmd = cmdChar
                }

                else -> throw SvgPathParseException("Unsupported SVG path command '$cmdChar'")
            }
        }

        return segments
    }

    /**
     * Converts an SVG elliptical arc segment from `(startX, startY)` into a sequence of
     * cubic Bezier curves (or a single `LineTo` when `rx == 0` or `ry == 0`) following the
     * W3C SVG 1.1 Implementation Notes (F.6.5 & F.6.6).
     */
    public fun arcToCubics(
        startX: Double,
        startY: Double,
        arc: SvgPathSegment.ArcTo,
    ): List<SvgPathSegment> {
        val x0 = startX
        val y0 = startY
        val x = arc.x
        val y = arc.y
        if (x0 == x && y0 == y) return emptyList()
        var rx = abs(arc.rx)
        var ry = abs(arc.ry)
        if (rx == 0.0 || ry == 0.0) {
            return listOf(SvgPathSegment.LineTo(x, y))
        }

        val phi = arc.xAxisRotationDegrees * PI / 180.0
        val cosPhi = cos(phi)
        val sinPhi = sin(phi)

        val dx2 = (x0 - x) / 2.0
        val dy2 = (y0 - y) / 2.0
        val x1p = cosPhi * dx2 + sinPhi * dy2
        val y1p = -sinPhi * dx2 + cosPhi * dy2

        var rxSq = rx * rx
        var rySq = ry * ry
        val x1pSq = x1p * x1p
        val y1pSq = y1p * y1p

        val lambda = x1pSq / rxSq + y1pSq / rySq
        if (lambda > 1.0) {
            val scale = sqrt(lambda)
            rx *= scale
            ry *= scale
            rxSq = rx * rx
            rySq = ry * ry
        }

        val sign = if (arc.largeArc == arc.sweep) -1.0 else 1.0
        val num = max(0.0, rxSq * rySq - rxSq * y1pSq - rySq * x1pSq)
        val den = rxSq * y1pSq + rySq * x1pSq
        val factor = if (den == 0.0) 0.0 else sign * sqrt(num / den)

        val cxp = factor * (rx * y1p / ry)
        val cyp = factor * -(ry * x1p / rx)

        val cx = cosPhi * cxp - sinPhi * cyp + (x0 + x) / 2.0
        val cy = sinPhi * cxp + cosPhi * cyp + (y0 + y) / 2.0

        val ux = (x1p - cxp) / rx
        val uy = (y1p - cyp) / ry
        val vx = (-x1p - cxp) / rx
        val vy = (-y1p - cyp) / ry

        val theta1 = vectorAngle(1.0, 0.0, ux, uy)
        var dTheta = vectorAngle(ux, uy, vx, vy)
        if (!arc.sweep && dTheta > 0.0) {
            dTheta -= 2.0 * PI
        } else if (arc.sweep && dTheta < 0.0) {
            dTheta += 2.0 * PI
        }

        val segCount = max(1, ceil(abs(dTheta) / (PI / 2.0)).toInt())
        val delta = dTheta / segCount
        val alpha = (4.0 / 3.0) * kotlin.math.tan(delta / 4.0)

        val out = ArrayList<SvgPathSegment.CubicTo>(segCount)
        var t1 = theta1
        for (i in 0 until segCount) {
            val t2 = t1 + delta
            val cos1 = cos(t1)
            val sin1 = sin(t1)
            val cos2 = cos(t2)
            val sin2 = sin(t2)

            val p1x = cos1 - alpha * sin1
            val p1y = sin1 + alpha * cos1
            val p2x = cos2 + alpha * sin2
            val p2y = sin2 - alpha * cos2

            val c1x = cx + cosPhi * (rx * p1x) - sinPhi * (ry * p1y)
            val c1y = cy + sinPhi * (rx * p1x) + cosPhi * (ry * p1y)
            val c2x = cx + cosPhi * (rx * p2x) - sinPhi * (ry * p2y)
            val c2y = cy + sinPhi * (rx * p2x) + cosPhi * (ry * p2y)
            val ex = if (i == segCount - 1) x else cx + cosPhi * (rx * cos2) - sinPhi * (ry * sin2)
            val ey = if (i == segCount - 1) y else cy + sinPhi * (rx * cos2) + cosPhi * (ry * sin2)

            out += SvgPathSegment.CubicTo(c1x, c1y, c2x, c2y, ex, ey)
            t1 = t2
        }
        return out
    }

    private fun vectorAngle(ux: Double, uy: Double, vx: Double, vy: Double): Double {
        val sign = if (ux * vy - uy * vx < 0.0) -1.0 else 1.0
        val dot = ux * vx + uy * vy
        val len = sqrt(ux * ux + uy * uy) * sqrt(vx * vx + vy * vy)
        if (len == 0.0) return 0.0
        val ratio = (dot / len).coerceIn(-1.0, 1.0)
        return sign * acos(ratio)
    }

    private class Scanner(private val input: String) {
        var index: Int = 0
            private set

        fun skipSeparators(): Boolean {
            while (index < input.length) {
                val ch = input[index]
                if (ch == ',' || ch.isWhitespace()) {
                    index++
                } else {
                    return true
                }
            }
            return false
        }

        fun peekIsCommand(): Boolean {
            if (!skipSeparators()) return false
            val ch = input[index]
            return ch in 'A'..'Z' || ch in 'a'..'z'
        }

        fun readCommand(): Char {
            if (!skipSeparators()) {
                throw SvgPathParseException("Unexpected end of SVG path")
            }
            return input[index++]
        }

        fun hasMoreNumbers(): Boolean {
            if (!skipSeparators()) return false
            val ch = input[index]
            return ch in '0'..'9' || ch == '+' || ch == '-' || ch == '.'
        }

        fun readFlag(): Boolean {
            if (!skipSeparators()) {
                throw SvgPathParseException("Expected SVG arc flag at index $index")
            }
            val ch = input[index]
            if (ch != '0' && ch != '1') {
                throw SvgPathParseException("Invalid SVG arc flag '$ch' at index $index")
            }
            index++
            return ch == '1'
        }

        fun readNumber(): Double {
            if (!skipSeparators()) {
                throw SvgPathParseException("Expected number at index $index")
            }
            val start = index
            if (index < input.length && (input[index] == '+' || input[index] == '-')) {
                index++
            }
            var sawDigits = false
            while (index < input.length && input[index] in '0'..'9') {
                sawDigits = true
                index++
            }
            if (index < input.length && input[index] == '.') {
                index++
                while (index < input.length && input[index] in '0'..'9') {
                    sawDigits = true
                    index++
                }
            }
            if (!sawDigits) {
                throw SvgPathParseException("Invalid number at index $start in '$input'")
            }
            if (index < input.length && (input[index] == 'e' || input[index] == 'E')) {
                val expStart = index
                index++
                if (index < input.length && (input[index] == '+' || input[index] == '-')) {
                    index++
                }
                var sawExpDigits = false
                while (index < input.length && input[index] in '0'..'9') {
                    sawExpDigits = true
                    index++
                }
                if (!sawExpDigits) {
                    index = expStart
                }
            }
            val token = input.substring(start, index)
            return token.toDoubleOrNull()
                ?: throw SvgPathParseException("Malformed number '$token' at index $start")
        }
    }
}
