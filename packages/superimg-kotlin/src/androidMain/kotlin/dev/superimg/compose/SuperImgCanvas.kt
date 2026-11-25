package dev.superimg.compose

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.DashPathEffect
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.os.Build
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.platform.LocalDensity
import dev.superimg.CoalescedFrameScheduler
import dev.superimg.DisplayAnchor
import dev.superimg.DisplayBlendMode
import dev.superimg.DisplayFillRule
import dev.superimg.DisplayFontStyle
import dev.superimg.DisplayImageFit
import dev.superimg.DisplayLineCap
import dev.superimg.DisplayLineJoin
import dev.superimg.DisplayListFrame
import dev.superimg.DisplayOp
import dev.superimg.DisplayPaint
import dev.superimg.DisplayStroke
import dev.superimg.LoadedSuperImgArtifact
import dev.superimg.SuperImgArtifactSession
import dev.superimg.SuperImgBenchmark
import dev.superimg.SuperImgViewport
import dev.superimg.SvgPathParser
import dev.superimg.SvgPathSegment
import dev.superimg.parseHexColorRgba
import kotlinx.serialization.json.JsonElement
import java.io.File
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

public data class SuperImgSprite(
    val bitmap: Bitmap,
    val pixelArt: Boolean = false,
)

public sealed interface SuperImgPlayback {
    public data object OnDemand : SuperImgPlayback
    public data class Automatic(val framesPerSecond: Int = 60, val loop: Boolean = true) : SuperImgPlayback
}

/**
 * Metadata emitted once a [DisplayListFrame] has been drawn onto the Compose canvas.
 */
public data class SuperImgAppliedFrame(
    val seconds: Double,
    val revision: Long,
    val viewportSize: Size,
    val scale: Float,
    val offsetX: Float,
    val offsetY: Float,
    val artworkWidth: Double,
    val artworkHeight: Double,
    private val anchors: List<DisplayAnchor>,
) {
    /**
     * Returns the canvas-local pixel coordinates for an authored anchor, or `null`
     * if missing, outside authored artwork bounds, or outside the visible viewport.
     */
    public fun anchor(entity: String, named: String): Offset? {
        val raw = anchors.firstOrNull { it.entity == entity && it.name == named } ?: return null
        if (raw.x < 0.0 || raw.y < 0.0 || raw.x > artworkWidth || raw.y > artworkHeight) {
            return null
        }
        val mappedX = (raw.x * scale + offsetX).toFloat()
        val mappedY = (raw.y * scale + offsetY).toFloat()
        if (mappedX < 0f || mappedY < 0f || mappedX > viewportSize.width || mappedY > viewportSize.height) {
            return null
        }
        return Offset(mappedX, mappedY)
    }
}

/**
 * Resolves font families from vendored `.superimg/fonts/` bytes or system fallbacks.
 */
public class SuperImgTypefaceRegistry(
    private val byFamily: Map<String, Typeface> = emptyMap(),
) {
    public fun resolve(family: String, weight: Int, style: DisplayFontStyle): Typeface {
        val normalized = family.trim().lowercase()
        val base = byFamily[normalized]
            ?: byFamily[normalized.substringBefore(',').trim().trim('"', '\'')]
            ?: Typeface.create(family.substringBefore(',').trim().trim('"', '\''), Typeface.NORMAL)

        val italic = style == DisplayFontStyle.ITALIC
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            Typeface.create(base, weight.coerceIn(1, 1000), italic)
        } else {
            val legacyStyle = when {
                weight >= 600 && italic -> Typeface.BOLD_ITALIC
                weight >= 600 -> Typeface.BOLD
                italic -> Typeface.ITALIC
                else -> Typeface.NORMAL
            }
            Typeface.create(base, legacyStyle)
        }
    }

    public companion object {
        public val Empty: SuperImgTypefaceRegistry = SuperImgTypefaceRegistry()

        /**
         * Builds a typeface registry from verified `.superimg/fonts/` bytes by materializing
         * temporary cache files (required on Android API < 26 or standard `Typeface.createFromFile`).
         */
        public fun fromArtifact(
            artifact: LoadedSuperImgArtifact,
            cacheDir: File,
        ): SuperImgTypefaceRegistry {
            if (artifact.fonts.isEmpty()) return Empty
            cacheDir.mkdirs()
            val map = LinkedHashMap<String, Typeface>()
            for ((key, bytes) in artifact.fonts) {
                val safeName = key.substringAfterLast('/').replace(Regex("[^A-Za-z0-9._-]"), "_")
                val outFile = File(cacheDir, safeName)
                if (!outFile.exists() || outFile.length() != bytes.size.toLong()) {
                    outFile.writeBytes(bytes)
                }
                val tf = runCatching { Typeface.createFromFile(outFile) }.getOrNull() ?: continue
                val familyKey = safeName
                    .substringBeforeLast('.')
                    .substringAfter('-')
                    .lowercase()
                map[key.lowercase()] = tf
                if (familyKey.isNotEmpty()) {
                    map[familyKey] = tf
                }
            }
            return SuperImgTypefaceRegistry(map)
        }
    }
}

/**
 * Decodes verified `.superimg/assets/` image bytes into [SuperImgSprite] bitmaps.
 */
public fun LoadedSuperImgArtifact.decodeImageSprites(): Map<String, SuperImgSprite> {
    val result = LinkedHashMap<String, SuperImgSprite>()
    for ((key, bytes) in assets) {
        val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: continue
        result[key] = SuperImgSprite(bitmap = bitmap, pixelArt = false)
    }
    for (asset in job.resolvedAssets) {
        if (asset.type == "image" && !result.containsKey(asset.key)) {
            val bytes = assetBytes(asset.src) ?: continue
            val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: continue
            result[asset.key] = SuperImgSprite(bitmap = bitmap, pixelArt = false)
        }
    }
    return result
}

/**
 * Stateless Compose composable that renders a single validated [DisplayListFrame].
 */
@Composable
public fun SuperImgCanvas(
    frame: DisplayListFrame,
    modifier: Modifier = Modifier,
    sprites: Map<String, SuperImgSprite> = emptyMap(),
    typefaces: SuperImgTypefaceRegistry = SuperImgTypefaceRegistry.Empty,
    seconds: Double = 0.0,
    revision: Long = 0L,
    onFrameApplied: ((SuperImgAppliedFrame) -> Unit)? = null,
) {
    val pathCache = remember { HashMap<String, Path>() }
    val latestOnFrameApplied by rememberUpdatedState(onFrameApplied)

    Canvas(modifier = modifier.fillMaxSize()) {
        if (size.width <= 0f || size.height <= 0f || frame.width <= 0.0 || frame.height <= 0.0) {
            return@Canvas
        }
        val fitScale = min(size.width / frame.width.toFloat(), size.height / frame.height.toFloat())
        val offsetX = (size.width - frame.width.toFloat() * fitScale) / 2f
        val offsetY = (size.height - frame.height.toFloat() * fitScale) / 2f

        drawIntoCanvas { canvas ->
            DisplayListAndroidRenderer.drawFrame(
                canvas = canvas.nativeCanvas,
                viewportWidthPx = size.width,
                viewportHeightPx = size.height,
                frame = frame,
                sprites = sprites,
                typefaces = typefaces,
                pathCache = pathCache,
            )
        }

        latestOnFrameApplied?.invoke(
            SuperImgAppliedFrame(
                seconds = seconds,
                revision = revision,
                viewportSize = size,
                scale = fitScale,
                offsetX = offsetX,
                offsetY = offsetY,
                artworkWidth = frame.width,
                artworkHeight = frame.height,
                anchors = frame.anchors,
            ),
        )
    }
}

/**
 * Reactive Compose player composable backed by [SuperImgArtifactSession] and
 * [CoalescedFrameScheduler] (single-in-flight, latest-pending coalescing).
 */
@Composable
public fun SuperImgCanvas(
    session: SuperImgArtifactSession,
    modifier: Modifier = Modifier,
    playback: SuperImgPlayback = SuperImgPlayback.Automatic(),
    sprites: Map<String, SuperImgSprite> = emptyMap(),
    typefaces: SuperImgTypefaceRegistry = SuperImgTypefaceRegistry.Empty,
    data: JsonElement? = null,
    edition: String? = null,
    requestedSeconds: Double = 0.0,
    revision: Long = 0L,
    benchmark: SuperImgBenchmark? = null,
    onFrameApplied: ((SuperImgAppliedFrame) -> Unit)? = null,
    onError: ((Throwable) -> Unit)? = null,
) {
    val scope = rememberCoroutineScope()
    val density = LocalDensity.current
    var currentFrame by remember(session) { mutableStateOf<DisplayListFrame?>(null) }
    var currentSeconds by remember(session) { mutableStateOf(0.0) }
    var currentRevision by remember(session) { mutableLongStateOf(revision) }

    val latestOnError by rememberUpdatedState(onError)

    val scheduler = remember(session, scope) {
        CoalescedFrameScheduler(
            scope = scope,
            sampler = { req ->
                val startNs = System.nanoTime()
                val sampled = session.sample(
                    seconds = req.seconds,
                    viewport = req.viewport,
                    data = req.data,
                    edition = req.edition,
                )
                val elapsedMs = (System.nanoTime() - startNs) / 1_000_000.0
                benchmark?.record(sampleMilliseconds = elapsedMs, renderMilliseconds = 0.0)
                sampled
            },
            onFrame = { accepted ->
                currentFrame = accepted.frame
                currentSeconds = accepted.seconds
                currentRevision = accepted.revision
            },
            onError = { error ->
                latestOnError?.invoke(error)
            },
        )
    }

    DisposableEffect(scheduler) {
        onDispose { scheduler.reset() }
    }

    BoxWithConstraints(modifier = modifier.fillMaxSize()) {
        val widthPx = constraints.maxWidth.toDouble()
        val heightPx = constraints.maxHeight.toDouble()
        val viewport = remember(widthPx, heightPx, density.density) {
            SuperImgViewport(
                width = widthPx.coerceAtLeast(1.0),
                height = heightPx.coerceAtLeast(1.0),
                scale = density.density.toDouble(),
            )
        }

        LaunchedEffect(viewport) {
            scheduler.invalidateGeneration()
        }

        LaunchedEffect(revision, data, edition) {
            scheduler.bumpRevision()
            if (playback is SuperImgPlayback.OnDemand && widthPx > 0.0 && heightPx > 0.0) {
                scheduler.enqueue(requestedSeconds, viewport, data, edition)
            }
        }

        LaunchedEffect(playback, viewport, requestedSeconds, data, edition) {
            if (widthPx <= 0.0 || heightPx <= 0.0) return@LaunchedEffect
            when (playback) {
                is SuperImgPlayback.OnDemand -> {
                    scheduler.enqueue(requestedSeconds, viewport, data, edition)
                }
                is SuperImgPlayback.Automatic -> {
                    val fps = playback.framesPerSecond.coerceAtLeast(1)
                    val duration = session.artifact.media.clock.durationSeconds
                    val minIntervalNs = 1_000_000_000L / fps
                    var originNs = -1L
                    var lastTickNs = -1L
                    while (true) {
                        withFrameNanos { frameNs ->
                            if (originNs < 0L) originNs = frameNs
                            if (lastTickNs < 0L || frameNs - lastTickNs >= minIntervalNs) {
                                lastTickNs = frameNs
                                val rawSec = (frameNs - originNs) / 1_000_000_000.0
                                val sec = if (playback.loop && duration > 0.0) {
                                    rawSec % duration
                                } else {
                                    rawSec
                                }
                                scheduler.enqueue(sec, viewport, data, edition)
                            }
                        }
                    }
                }
            }
        }

        currentFrame?.let { frame ->
            SuperImgCanvas(
                frame = frame,
                modifier = Modifier.fillMaxSize(),
                sprites = sprites,
                typefaces = typefaces,
                seconds = currentSeconds,
                revision = currentRevision,
                onFrameApplied = onFrameApplied,
            )
        }
    }
}

/**
 * Shared Android [Canvas] renderer for [DisplayListFrame] used by both Jetpack Compose
 * [SuperImgCanvas] and [dev.superimg.export.SuperImgMediaCodecExporter].
 */
public object DisplayListAndroidRenderer {
    public fun drawFrame(
        canvas: Canvas,
        viewportWidthPx: Float,
        viewportHeightPx: Float,
        frame: DisplayListFrame,
        sprites: Map<String, SuperImgSprite> = emptyMap(),
        typefaces: SuperImgTypefaceRegistry = SuperImgTypefaceRegistry.Empty,
        pathCache: MutableMap<String, Path>? = null,
    ) {
        if (viewportWidthPx <= 0f || viewportHeightPx <= 0f || frame.width <= 0.0 || frame.height <= 0.0) {
            return
        }

        val fw = frame.width.toFloat()
        val fh = frame.height.toFloat()
        val scale = min(viewportWidthPx / fw, viewportHeightPx / fh)
        val offsetX = (viewportWidthPx - fw * scale) / 2f
        val offsetY = (viewportHeightPx - fh * scale) / 2f

        val rootSave = canvas.save()
        canvas.translate(offsetX, offsetY)
        canvas.scale(scale, scale)
        canvas.clipRect(0f, 0f, fw, fh)

        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        val matrix = Matrix()
        val matrixValues = FloatArray(9)
        val rectF = RectF()
        val clipRectF = RectF()

        for (op in frame.ops) {
            if (op.opacity <= 0.0) continue

            val opSave = canvas.save()

            // 1. Apply clip stack in current coordinate space before op transform.
            op.clips?.forEach { clip ->
                clipRectF.set(
                    clip.x.toFloat(),
                    clip.y.toFloat(),
                    (clip.x + clip.width).toFloat(),
                    (clip.y + clip.height).toFloat(),
                )
                val clipRadius = clip.radius?.toFloat() ?: 0f
                if (clipRadius > 0f) {
                    val clipPath = Path().apply {
                        addRoundRect(clipRectF, clipRadius, clipRadius, Path.Direction.CW)
                    }
                    canvas.clipPath(clipPath)
                } else {
                    canvas.clipRect(clipRectF)
                }
            }

            // 2. Apply op 2D affine matrix `{ a, b, c, d, e, f }`.
            op.matrix?.let { m ->
                matrixValues[0] = m.a.toFloat()
                matrixValues[1] = m.c.toFloat()
                matrixValues[2] = m.e.toFloat()
                matrixValues[3] = m.b.toFloat()
                matrixValues[4] = m.d.toFloat()
                matrixValues[5] = m.f.toFloat()
                matrixValues[6] = 0f
                matrixValues[7] = 0f
                matrixValues[8] = 1f
                matrix.setValues(matrixValues)
                canvas.concat(matrix)
            }

            // 3. Isolate layer when opacity < 1 or non-normal blendMode is active.
            val blend = op.blendMode ?: DisplayBlendMode.NORMAL
            if (op.opacity < 1.0 || blend != DisplayBlendMode.NORMAL) {
                val layerPaint = Paint().apply {
                    alpha = (op.opacity * 255.0).roundToInt().coerceIn(0, 255)
                    applyBlendMode(this, blend)
                }
                canvas.saveLayer(null, layerPaint)
            }

            when (op) {
                is DisplayOp.Rect -> drawRectOp(canvas, op, paint, rectF)
                is DisplayOp.Ellipse -> drawEllipseOp(canvas, op, paint, rectF)
                is DisplayOp.Path -> drawPathOp(canvas, op, paint, pathCache)
                is DisplayOp.Image -> drawImageOp(canvas, op, sprites, paint, rectF)
                is DisplayOp.Text -> drawTextOp(canvas, op, typefaces, paint)
            }

            canvas.restoreToCount(opSave)
        }

        canvas.restoreToCount(rootSave)
    }

    private fun drawRectOp(canvas: Canvas, op: DisplayOp.Rect, paint: Paint, rectF: RectF) {
        rectF.set(
            op.bounds.x.toFloat(),
            op.bounds.y.toFloat(),
            (op.bounds.x + op.bounds.width).toFloat(),
            (op.bounds.y + op.bounds.height).toFloat(),
        )
        val radius = op.radius?.toFloat() ?: 0f

        op.fill?.let { fill ->
            configureFillPaint(paint, fill, rectF)
            if (radius > 0f) {
                canvas.drawRoundRect(rectF, radius, radius, paint)
            } else {
                canvas.drawRect(rectF, paint)
            }
        }
        op.stroke?.let { stroke ->
            if (stroke.width > 0.0) {
                configureStrokePaint(paint, stroke)
                if (radius > 0f) {
                    canvas.drawRoundRect(rectF, radius, radius, paint)
                } else {
                    canvas.drawRect(rectF, paint)
                }
            }
        }
    }

    private fun drawEllipseOp(canvas: Canvas, op: DisplayOp.Ellipse, paint: Paint, rectF: RectF) {
        rectF.set(
            op.bounds.x.toFloat(),
            op.bounds.y.toFloat(),
            (op.bounds.x + op.bounds.width).toFloat(),
            (op.bounds.y + op.bounds.height).toFloat(),
        )
        op.fill?.let { fill ->
            configureFillPaint(paint, fill, rectF)
            canvas.drawOval(rectF, paint)
        }
        op.stroke?.let { stroke ->
            if (stroke.width > 0.0) {
                configureStrokePaint(paint, stroke)
                canvas.drawOval(rectF, paint)
            }
        }
    }

    private fun drawPathOp(
        canvas: Canvas,
        op: DisplayOp.Path,
        paint: Paint,
        pathCache: MutableMap<String, Path>?,
    ) {
        val fillType = when (op.fillRule) {
            DisplayFillRule.EVENODD -> Path.FillType.EVEN_ODD
            DisplayFillRule.NONZERO, null -> Path.FillType.WINDING
        }
        val cacheKey = "${fillType.name}:${op.d}"
        val androidPath = pathCache?.get(cacheKey) ?: buildAndroidPath(op.d, fillType).also {
            pathCache?.put(cacheKey, it)
        }

        val boundsRect = RectF(
            op.bounds.x.toFloat(),
            op.bounds.y.toFloat(),
            (op.bounds.x + op.bounds.width).toFloat(),
            (op.bounds.y + op.bounds.height).toFloat(),
        )
        op.fill?.let { fill ->
            configureFillPaint(paint, fill, boundsRect)
            canvas.drawPath(androidPath, paint)
        }
        op.stroke?.let { stroke ->
            if (stroke.width > 0.0) {
                configureStrokePaint(paint, stroke)
                canvas.drawPath(androidPath, paint)
            }
        }
    }

    private fun drawImageOp(
        canvas: Canvas,
        op: DisplayOp.Image,
        sprites: Map<String, SuperImgSprite>,
        paint: Paint,
        rectF: RectF,
    ) {
        val sprite = sprites[op.asset] ?: return
        val bmp = sprite.bitmap
        if (bmp.width <= 0 || bmp.height <= 0 || op.bounds.width <= 0.0 || op.bounds.height <= 0.0) {
            return
        }

        val bx = op.bounds.x.toFloat()
        val by = op.bounds.y.toFloat()
        val bw = op.bounds.width.toFloat()
        val bh = op.bounds.height.toFloat()
        rectF.set(bx, by, bx + bw, by + bh)

        val save = canvas.save()
        val radius = op.radius?.toFloat() ?: 0f
        if (radius > 0f) {
            val clipPath = Path().apply { addRoundRect(rectF, radius, radius, Path.Direction.CW) }
            canvas.clipPath(clipPath)
        } else {
            canvas.clipRect(rectF)
        }

        val iw = bmp.width.toFloat()
        val ih = bmp.height.toFloat()
        val dst = RectF()
        when (op.fit) {
            DisplayImageFit.FILL -> dst.set(bx, by, bx + bw, by + bh)
            DisplayImageFit.CONTAIN -> {
                val s = min(bw / iw, bh / ih)
                val dw = iw * s
                val dh = ih * s
                val dx = bx + (bw - dw) / 2f
                val dy = by + (bh - dh) / 2f
                dst.set(dx, dy, dx + dw, dy + dh)
            }
            DisplayImageFit.COVER -> {
                val s = max(bw / iw, bh / ih)
                val dw = iw * s
                val dh = ih * s
                val dx = bx + (bw - dw) / 2f
                val dy = by + (bh - dh) / 2f
                dst.set(dx, dy, dx + dw, dy + dh)
            }
        }

        paint.reset()
        paint.isAntiAlias = !(sprite.pixelArt || (op.pixelArt == true))
        paint.isFilterBitmap = !(sprite.pixelArt || (op.pixelArt == true))
        canvas.drawBitmap(bmp, null, dst, paint)
        canvas.restoreToCount(save)
    }

    private fun drawTextOp(
        canvas: Canvas,
        op: DisplayOp.Text,
        typefaces: SuperImgTypefaceRegistry,
        paint: Paint,
    ) {
        val rgba = parseHexColorRgba(op.color) ?: return
        paint.reset()
        paint.isAntiAlias = true
        paint.isSubpixelText = true
        paint.style = Paint.Style.FILL
        paint.color = rgba.toArgbInt()
        paint.textSize = op.fontSize.toFloat()
        paint.textAlign = Paint.Align.LEFT
        paint.typeface = typefaces.resolve(op.fontFamily, op.fontWeight, op.fontStyle)
        if (op.letterSpacing != null && op.fontSize > 0.0) {
            paint.letterSpacing = (op.letterSpacing / op.fontSize).toFloat()
        }

        for (line in op.lines) {
            if (line.text.isEmpty()) continue
            canvas.drawText(line.text, line.x.toFloat(), line.baselineY.toFloat(), paint)
        }
    }

    private fun configureFillPaint(paint: Paint, fill: DisplayPaint, bounds: RectF) {
        paint.reset()
        paint.isAntiAlias = true
        paint.style = Paint.Style.FILL
        paint.pathEffect = null

        when (fill) {
            is DisplayPaint.Solid -> {
                paint.shader = null
                paint.color = parseHexColorRgba(fill.color)?.toArgbInt() ?: 0
            }
            is DisplayPaint.LinearGradient -> {
                if (fill.stops.size == 1) {
                    paint.shader = null
                    paint.color = parseHexColorRgba(fill.stops[0].color)?.toArgbInt() ?: 0
                    return
                }
                val colors = IntArray(fill.stops.size) { i ->
                    parseHexColorRgba(fill.stops[i].color)?.toArgbInt() ?: 0
                }
                val positions = FloatArray(fill.stops.size) { i ->
                    fill.stops[i].offset.toFloat()
                }
                val x1 = bounds.left + fill.x1.toFloat() * bounds.width()
                val y1 = bounds.top + fill.y1.toFloat() * bounds.height()
                val x2 = bounds.left + fill.x2.toFloat() * bounds.width()
                val y2 = bounds.top + fill.y2.toFloat() * bounds.height()
                paint.shader = LinearGradient(x1, y1, x2, y2, colors, positions, Shader.TileMode.CLAMP)
            }
            is DisplayPaint.RadialGradient -> {
                if (fill.stops.size == 1 || fill.r <= 0.0 || bounds.width() <= 0f || bounds.height() <= 0f) {
                    paint.shader = null
                    paint.color = parseHexColorRgba(fill.stops.last().color)?.toArgbInt() ?: 0
                    return
                }
                val colors = IntArray(fill.stops.size) { i ->
                    parseHexColorRgba(fill.stops[i].color)?.toArgbInt() ?: 0
                }
                val positions = FloatArray(fill.stops.size) { i ->
                    fill.stops[i].offset.toFloat()
                }
                val cx = bounds.left + fill.cx.toFloat() * bounds.width()
                val cy = bounds.top + fill.cy.toFloat() * bounds.height()
                val radius = (max(bounds.width(), bounds.height()) * fill.r.toFloat()).coerceAtLeast(0.5f)
                paint.shader = RadialGradient(cx, cy, radius, colors, positions, Shader.TileMode.CLAMP)
            }
        }
    }

    private fun configureStrokePaint(paint: Paint, stroke: DisplayStroke) {
        paint.reset()
        paint.isAntiAlias = true
        paint.style = Paint.Style.STROKE
        paint.shader = null
        paint.color = parseHexColorRgba(stroke.color)?.toArgbInt() ?: 0
        paint.strokeWidth = stroke.width.toFloat()
        paint.strokeCap = when (stroke.lineCap) {
            DisplayLineCap.ROUND -> Paint.Cap.ROUND
            DisplayLineCap.SQUARE -> Paint.Cap.SQUARE
            DisplayLineCap.BUTT, null -> Paint.Cap.BUTT
        }
        paint.strokeJoin = when (stroke.lineJoin) {
            DisplayLineJoin.ROUND -> Paint.Join.ROUND
            DisplayLineJoin.BEVEL -> Paint.Join.BEVEL
            DisplayLineJoin.MITER, null -> Paint.Join.MITER
        }
        val dash = stroke.dashArray
        if (dash != null && dash.isNotEmpty() && dash.any { it > 0.0 }) {
            val intervals = if (dash.size % 2 == 1) {
                FloatArray(dash.size * 2) { i -> dash[i % dash.size].toFloat() }
            } else {
                FloatArray(dash.size) { i -> dash[i].toFloat() }
            }
            paint.pathEffect = DashPathEffect(intervals, stroke.dashOffset?.toFloat() ?: 0f)
        } else {
            paint.pathEffect = null
        }
    }

    private fun applyBlendMode(paint: Paint, mode: DisplayBlendMode) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            paint.blendMode = when (mode) {
                DisplayBlendMode.NORMAL -> android.graphics.BlendMode.SRC_OVER
                DisplayBlendMode.MULTIPLY -> android.graphics.BlendMode.MULTIPLY
                DisplayBlendMode.SCREEN -> android.graphics.BlendMode.SCREEN
                DisplayBlendMode.OVERLAY -> android.graphics.BlendMode.OVERLAY
            }
        } else {
            val pd = when (mode) {
                DisplayBlendMode.NORMAL -> PorterDuff.Mode.SRC_OVER
                DisplayBlendMode.MULTIPLY -> PorterDuff.Mode.MULTIPLY
                DisplayBlendMode.SCREEN -> PorterDuff.Mode.SCREEN
                DisplayBlendMode.OVERLAY -> PorterDuff.Mode.OVERLAY
            }
            paint.xfermode = PorterDuffXfermode(pd)
        }
    }

    private fun buildAndroidPath(d: String, fillType: Path.FillType): Path {
        val path = Path()
        path.fillType = fillType
        val segments = SvgPathParser.parse(d)
        var curX = 0.0
        var curY = 0.0
        var startX = 0.0
        var startY = 0.0

        for (seg in segments) {
            when (seg) {
                is SvgPathSegment.MoveTo -> {
                    path.moveTo(seg.x.toFloat(), seg.y.toFloat())
                    curX = seg.x
                    curY = seg.y
                    startX = seg.x
                    startY = seg.y
                }
                is SvgPathSegment.LineTo -> {
                    path.lineTo(seg.x.toFloat(), seg.y.toFloat())
                    curX = seg.x
                    curY = seg.y
                }
                is SvgPathSegment.CubicTo -> {
                    path.cubicTo(
                        seg.x1.toFloat(),
                        seg.y1.toFloat(),
                        seg.x2.toFloat(),
                        seg.y2.toFloat(),
                        seg.x.toFloat(),
                        seg.y.toFloat(),
                    )
                    curX = seg.x
                    curY = seg.y
                }
                is SvgPathSegment.QuadTo -> {
                    path.quadTo(seg.x1.toFloat(), seg.y1.toFloat(), seg.x.toFloat(), seg.y.toFloat())
                    curX = seg.x
                    curY = seg.y
                }
                is SvgPathSegment.ArcTo -> {
                    val converted = SvgPathParser.arcToCubics(curX, curY, seg)
                    for (sub in converted) {
                        when (sub) {
                            is SvgPathSegment.LineTo -> path.lineTo(sub.x.toFloat(), sub.y.toFloat())
                            is SvgPathSegment.CubicTo -> path.cubicTo(
                                sub.x1.toFloat(),
                                sub.y1.toFloat(),
                                sub.x2.toFloat(),
                                sub.y2.toFloat(),
                                sub.x.toFloat(),
                                sub.y.toFloat(),
                            )
                            else -> Unit
                        }
                    }
                    curX = seg.x
                    curY = seg.y
                }
                SvgPathSegment.Close -> {
                    path.close()
                    curX = startX
                    curY = startY
                }
            }
        }
        return path
    }
}
