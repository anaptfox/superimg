package dev.superimg

import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs
import kotlin.test.assertTrue

class SvgPathParserTest {
    @Test
    fun parsesMoveLineHorizontalVerticalAndCloseCommands() {
        val segments = SvgPathParser.parse("M 10 20 l 30 0 h 10 v -5 L 50 40 Z")
        assertEquals(6, segments.size)
        assertEquals(SvgPathSegment.MoveTo(10.0, 20.0), segments[0])
        assertEquals(SvgPathSegment.LineTo(40.0, 20.0), segments[1])
        assertEquals(SvgPathSegment.LineTo(50.0, 20.0), segments[2])
        assertEquals(SvgPathSegment.LineTo(50.0, 15.0), segments[3])
        assertEquals(SvgPathSegment.LineTo(50.0, 40.0), segments[4])
        assertEquals(SvgPathSegment.Close, segments[5])
    }

    @Test
    fun parsesImplicitLineToAfterMoveTo() {
        val segments = SvgPathParser.parse("m 5,5 10,15 20,-5")
        assertEquals(
            listOf(
                SvgPathSegment.MoveTo(5.0, 5.0),
                SvgPathSegment.LineTo(15.0, 20.0),
                SvgPathSegment.LineTo(35.0, 15.0),
            ),
            segments,
        )
    }

    @Test
    fun parsesCubicSmoothCubicQuadraticAndSmoothQuadratic() {
        val segments = SvgPathParser.parse("M 0 0 C 10 0 20 10 20 20 S 30 40 40 40 Q 50 40 50 50 T 60 60")
        assertEquals(5, segments.size)
        assertEquals(SvgPathSegment.CubicTo(10.0, 0.0, 20.0, 10.0, 20.0, 20.0), segments[1])
        // Reflected control point of (20,10) across (20,20) is (20,30)
        assertEquals(SvgPathSegment.CubicTo(20.0, 30.0, 30.0, 40.0, 40.0, 40.0), segments[2])
        assertEquals(SvgPathSegment.QuadTo(50.0, 40.0, 50.0, 50.0), segments[3])
        // Reflected quad control point of (50,40) across (50,50) is (50,60)
        assertEquals(SvgPathSegment.QuadTo(50.0, 60.0, 60.0, 60.0), segments[4])
    }

    @Test
    fun parsesCompactArcFlagsAndScientificNotation() {
        val segments = SvgPathParser.parse("M10 10a25.5 25.5 0 0150 0A1e1 1e1 -45 10 80 10")
        assertEquals(3, segments.size)

        val arc1 = assertIs<SvgPathSegment.ArcTo>(segments[1])
        assertEquals(25.5, arc1.rx)
        assertEquals(25.5, arc1.ry)
        assertEquals(0.0, arc1.xAxisRotationDegrees)
        assertEquals(false, arc1.largeArc)
        assertEquals(true, arc1.sweep)
        assertEquals(60.0, arc1.x)
        assertEquals(10.0, arc1.y)

        val arc2 = assertIs<SvgPathSegment.ArcTo>(segments[2])
        assertEquals(10.0, arc2.rx)
        assertEquals(-45.0, arc2.xAxisRotationDegrees)
        assertEquals(true, arc2.largeArc)
        assertEquals(false, arc2.sweep)
        assertEquals(80.0, arc2.x)
        assertEquals(10.0, arc2.y)

        val cubics = SvgPathParser.arcToCubics(10.0, 10.0, arc1)
        assertTrue(cubics.isNotEmpty())
        val last = assertIs<SvgPathSegment.CubicTo>(cubics.last())
        assertTrue(abs(last.x - 60.0) < 1e-6)
        assertTrue(abs(last.y - 10.0) < 1e-6)
    }

    @Test
    fun rejectsMalformedPath() {
        assertFailsWith<SvgPathParseException> { SvgPathParser.parse("10 20") }
        assertFailsWith<SvgPathParseException> { SvgPathParser.parse("M 10") }
        assertFailsWith<SvgPathParseException> { SvgPathParser.parse("M 0 0 X 10 10") }
    }
}
