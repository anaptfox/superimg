package dev.superimg

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class DisplayListTest {
    @Test
    fun parsesAndValidatesFullCanonicalDisplayListV1Fixture() {
        val json = """
            {
              "kind": "@foxworth/superimg/display-list",
              "schemaVersion": 1,
              "width": 1080.0,
              "height": 1920.0,
              "ops": [
                {
                  "id": "bg",
                  "kind": "rect",
                  "bounds": { "x": 0.0, "y": 0.0, "width": 1080.0, "height": 1920.0 },
                  "opacity": 1.0,
                  "fill": {
                    "kind": "linearGradient",
                    "x1": 0.0,
                    "y1": 0.0,
                    "x2": 1.0,
                    "y2": 1.0,
                    "stops": [
                      { "color": "#0f172a", "offset": 0.0 },
                      { "color": "#1e293b", "offset": 1.0 }
                    ]
                  },
                  "radius": 0.0
                },
                {
                  "id": "orb",
                  "kind": "ellipse",
                  "bounds": { "x": 200.0, "y": 300.0, "width": 120.0, "height": 120.0 },
                  "matrix": { "a": 1.0, "b": 0.0, "c": 0.0, "d": 1.0, "e": 10.0, "f": 20.0 },
                  "opacity": 0.85,
                  "blendMode": "screen",
                  "clips": [
                    { "x": 100.0, "y": 100.0, "width": 800.0, "height": 800.0, "radius": 24.0 }
                  ],
                  "fill": {
                    "kind": "radialGradient",
                    "cx": 0.5,
                    "cy": 0.5,
                    "r": 0.5,
                    "stops": [
                      { "color": "#38bdf8ff", "offset": 0.0 },
                      { "color": "#38bdf800", "offset": 1.0 }
                    ]
                  },
                  "stroke": {
                    "color": "#ffffff80",
                    "width": 2.0,
                    "lineCap": "round",
                    "lineJoin": "round",
                    "dashArray": [4.0, 2.0],
                    "dashOffset": 1.0
                  }
                },
                {
                  "id": "wave",
                  "kind": "path",
                  "bounds": { "x": 40.0, "y": 500.0, "width": 1000.0, "height": 200.0 },
                  "opacity": 1.0,
                  "d": "M 40 600 Q 540 500 1040 600 Z",
                  "fill": { "kind": "solid", "color": "#22d3ee" },
                  "fillRule": "evenodd"
                },
                {
                  "id": "hero-sprite",
                  "kind": "image",
                  "bounds": { "x": 440.0, "y": 800.0, "width": 200.0, "height": 200.0 },
                  "opacity": 1.0,
                  "asset": "nell",
                  "fit": "cover",
                  "pixelArt": true,
                  "radius": 16.0
                },
                {
                  "id": "headline",
                  "kind": "text",
                  "bounds": { "x": 80.0, "y": 1100.0, "width": 920.0, "height": 140.0 },
                  "opacity": 1.0,
                  "blendMode": "normal",
                  "lines": [
                    { "text": "SuperImg Native", "x": 80.0, "y": 1100.0, "baselineY": 1152.0, "width": 520.0 }
                  ],
                  "fontFamily": "Inter",
                  "fontSize": 64.0,
                  "fontWeight": 700,
                  "fontStyle": "normal",
                  "letterSpacing": -1.5,
                  "lineHeight": 76.0,
                  "align": "left",
                  "color": "#f8fafc",
                  "metricsExact": true
                }
              ],
              "anchors": [
                { "entity": "nell", "name": "talk", "x": 540.0, "y": 790.0 }
              ],
              "issues": [
                { "nodeId": "headline", "code": "FONT_FALLBACK", "message": "Using bundled Inter" }
              ]
            }
        """.trimIndent()

        val frame = parseDisplayListFrame(json)
        assertEquals(DISPLAY_LIST_KIND, frame.kind)
        assertEquals(1, frame.schemaVersion)
        assertEquals(1080.0, frame.width)
        assertEquals(1920.0, frame.height)
        assertEquals(5, frame.ops.size)

        val rectOp = assertIs<DisplayOp.Rect>(frame.ops[0])
        assertIs<DisplayPaint.LinearGradient>(rectOp.fill)

        val ellipseOp = assertIs<DisplayOp.Ellipse>(frame.ops[1])
        assertEquals(DisplayBlendMode.SCREEN, ellipseOp.blendMode)
        assertEquals(1, ellipseOp.clips?.size)
        assertEquals(24.0, ellipseOp.clips?.first()?.radius)

        val pathOp = assertIs<DisplayOp.Path>(frame.ops[2])
        assertEquals(DisplayFillRule.EVENODD, pathOp.fillRule)

        val imageOp = assertIs<DisplayOp.Image>(frame.ops[3])
        assertEquals(DisplayImageFit.COVER, imageOp.fit)
        assertEquals(true, imageOp.pixelArt)

        val textOp = assertIs<DisplayOp.Text>(frame.ops[4])
        assertEquals(DisplayTextAlign.LEFT, textOp.align)
        assertEquals(700, textOp.fontWeight)
        assertEquals(true, textOp.metricsExact)

        assertNotNull(frame.rawAnchor("nell", "talk"))
        assertEquals(1, frame.issues.size)

        val roundTripped = parseDisplayListFrame(encodeDisplayListFrame(frame))
        assertEquals(frame, roundTripped)
    }

    @Test
    fun rejectsDuplicateOpIds() {
        val dup = DisplayListFrame(
            width = 100.0,
            height = 100.0,
            ops = listOf(
                DisplayOp.Rect(
                    id = "box",
                    bounds = DisplayBounds(0.0, 0.0, 10.0, 10.0),
                    fill = DisplayPaint.Solid("#ffffff"),
                ),
                DisplayOp.Rect(
                    id = "box",
                    bounds = DisplayBounds(10.0, 10.0, 10.0, 10.0),
                    fill = DisplayPaint.Solid("#000000"),
                ),
            ),
        )
        assertFailsWith<DisplayListValidationException> { dup.validate() }
    }

    @Test
    fun rejectsInvalidHexColorsAndNonFiniteCoords() {
        assertNull(parseHexColorRgba("#fff"))
        assertNull(parseHexColorRgba("red"))
        assertNull(parseHexColorRgba("#12345z"))

        val valid6 = parseHexColorRgba("#1a2b3c")
        assertNotNull(valid6)
        assertEquals(0xFF1A2B3C.toInt(), valid6.toArgbInt())

        val valid8 = parseHexColorRgba("#1a2b3c80")
        assertNotNull(valid8)
        assertEquals(0x801A2B3C.toInt(), valid8.toArgbInt())

        val badBounds = DisplayListFrame(
            width = 100.0,
            height = 100.0,
            ops = listOf(
                DisplayOp.Rect(
                    id = "nan-rect",
                    bounds = DisplayBounds(Double.NaN, 0.0, 10.0, 10.0),
                    fill = DisplayPaint.Solid("#ffffff"),
                ),
            ),
        )
        assertFailsWith<DisplayListValidationException> { badBounds.validate() }
    }
}
