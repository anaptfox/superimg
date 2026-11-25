package dev.superimg.export

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.PorterDuff
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.view.Surface
import dev.superimg.SuperImgArtifactSession
import dev.superimg.SuperImgViewport
import dev.superimg.compose.DisplayListAndroidRenderer
import dev.superimg.compose.SuperImgSprite
import dev.superimg.compose.SuperImgTypefaceRegistry
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonElement
import java.io.File
import kotlin.coroutines.coroutineContext
import kotlin.math.roundToInt
import kotlin.math.roundToLong

public data class MediaCodecExportOptions(
    val width: Int? = null,
    val height: Int? = null,
    val fps: Int? = null,
    val totalFrames: Int? = null,
    val bitRate: Int = 8_000_000,
    val iFrameIntervalSeconds: Int = 1,
    val backgroundColorArgb: Int = Color.BLACK,
    val edition: String? = null,
    val data: JsonElement? = null,
    val sprites: Map<String, SuperImgSprite> = emptyMap(),
    val typefaces: SuperImgTypefaceRegistry = SuperImgTypefaceRegistry.Empty,
    val onProgress: ((completedFrames: Int, totalFrames: Int) -> Unit)? = null,
)

public data class MediaCodecExportResult(
    val outputFile: File,
    val width: Int,
    val height: Int,
    val fps: Int,
    val totalFrames: Int,
)

/**
 * Offscreen hardware-accelerated H.264/MP4 exporter using Android `MediaCodec` +
 * `MediaMuxer` + `Surface`, mirroring Swift's `AVAssetWriter` pipeline.
 *
 * Writes to a sibling temporary file and atomically renames on completion so partial
 * artifacts are never left at [outputFile].
 */
public class SuperImgMediaCodecExporter {
    public suspend fun exportMp4(
        session: SuperImgArtifactSession,
        outputFile: File,
        options: MediaCodecExportOptions = MediaCodecExportOptions(),
    ): MediaCodecExportResult = withContext(Dispatchers.Default) {
        val media = session.artifact.media
        val width = alignEven(options.width ?: media.canvas.width.roundToInt())
        val height = alignEven(options.height ?: media.canvas.height.roundToInt())
        val fps = (options.fps ?: media.clock.fps.roundToInt()).coerceAtLeast(1)
        val totalFrames = (options.totalFrames ?: media.clock.totalFrames).coerceAtLeast(1)

        require(width > 0 && height > 0) { "Export dimensions must be positive: ${width}x$height" }

        val parent = outputFile.absoluteFile.parentFile
        if (parent != null && !parent.exists()) {
            parent.mkdirs()
        }
        val tempFile = File(parent, ".${outputFile.name}.tmp-${System.nanoTime()}")

        val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height).apply {
            setInteger(
                MediaFormat.KEY_COLOR_FORMAT,
                MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface,
            )
            setInteger(MediaFormat.KEY_BIT_RATE, options.bitRate)
            setInteger(MediaFormat.KEY_FRAME_RATE, fps)
            setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, options.iFrameIntervalSeconds)
            // Keep PTS monotonic without B-frame reordering for deterministic Surface muxing.
            setInteger(MediaFormat.KEY_MAX_B_FRAMES, 0)
        }

        val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
        var inputSurface: Surface? = null
        var muxer: MediaMuxer? = null
        var muxerStarted = false
        var trackIndex = -1
        var encodedFrameIndex = 0
        val bufferInfo = MediaCodec.BufferInfo()
        val pathCache = HashMap<String, android.graphics.Path>()
        val viewport = SuperImgViewport(width = width.toDouble(), height = height.toDouble(), scale = 1.0)

        try {
            codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            inputSurface = codec.createInputSurface()
            codec.start()

            muxer = MediaMuxer(tempFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)

            for (frameIndex in 0 until totalFrames) {
                coroutineContext.ensureActive()

                val seconds = frameIndex.toDouble() / fps.toDouble()
                val frame = session.sample(
                    seconds = seconds,
                    viewport = viewport,
                    frame = frameIndex,
                    data = options.data,
                    edition = options.edition,
                )

                val canvas: Canvas = inputSurface.lockHardwareCanvas()
                try {
                    canvas.drawColor(options.backgroundColorArgb, PorterDuff.Mode.SRC)
                    DisplayListAndroidRenderer.drawFrame(
                        canvas = canvas,
                        viewportWidthPx = width.toFloat(),
                        viewportHeightPx = height.toFloat(),
                        frame = frame,
                        sprites = options.sprites,
                        typefaces = options.typefaces,
                        pathCache = pathCache,
                    )
                } finally {
                    inputSurface.unlockCanvasAndPost(canvas)
                }

                val drainState = drainEncoder(
                    codec = codec,
                    muxer = muxer,
                    bufferInfo = bufferInfo,
                    endOfStream = false,
                    fps = fps,
                    muxerStarted = muxerStarted,
                    trackIndex = trackIndex,
                    encodedFrameIndex = encodedFrameIndex,
                )
                muxerStarted = drainState.muxerStarted
                trackIndex = drainState.trackIndex
                encodedFrameIndex = drainState.encodedFrameIndex

                options.onProgress?.invoke(frameIndex + 1, totalFrames)
            }

            codec.signalEndOfInputStream()
            drainEncoder(
                codec = codec,
                muxer = muxer,
                bufferInfo = bufferInfo,
                endOfStream = true,
                fps = fps,
                muxerStarted = muxerStarted,
                trackIndex = trackIndex,
                encodedFrameIndex = encodedFrameIndex,
            )

            if (muxerStarted) {
                muxer.stop()
            }
            muxer.release()
            muxer = null

            if (outputFile.exists() && !outputFile.delete()) {
                throw IllegalStateException("Could not replace existing output file: $outputFile")
            }
            if (!tempFile.renameTo(outputFile)) {
                tempFile.copyTo(outputFile, overwrite = true)
                tempFile.delete()
            }

            MediaCodecExportResult(
                outputFile = outputFile,
                width = width,
                height = height,
                fps = fps,
                totalFrames = totalFrames,
            )
        } catch (t: Throwable) {
            tempFile.delete()
            throw t
        } finally {
            runCatching { codec.stop() }
            runCatching { codec.release() }
            runCatching { inputSurface?.release() }
            runCatching {
                if (muxerStarted) muxer?.stop()
                muxer?.release()
            }
        }
    }

    private data class DrainState(
        val muxerStarted: Boolean,
        val trackIndex: Int,
        val encodedFrameIndex: Int,
    )

    private fun drainEncoder(
        codec: MediaCodec,
        muxer: MediaMuxer,
        bufferInfo: MediaCodec.BufferInfo,
        endOfStream: Boolean,
        fps: Int,
        muxerStarted: Boolean,
        trackIndex: Int,
        encodedFrameIndex: Int,
    ): DrainState {
        var started = muxerStarted
        var track = trackIndex
        var nextFrameIdx = encodedFrameIndex
        val timeoutUs = if (endOfStream) 10_000L else 0L

        while (true) {
            val outputIndex = codec.dequeueOutputBuffer(bufferInfo, timeoutUs)
            when {
                outputIndex == MediaCodec.INFO_TRY_AGAIN_LATER -> {
                    if (!endOfStream) break
                }
                outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                    check(!started) { "MediaCodec output format changed after muxer started" }
                    track = muxer.addTrack(codec.outputFormat)
                    muxer.start()
                    started = true
                }
                outputIndex >= 0 -> {
                    val encodedBuffer = codec.getOutputBuffer(outputIndex)
                        ?: throw IllegalStateException("MediaCodec output buffer $outputIndex was null")

                    val isConfig = (bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0
                    if (!isConfig && bufferInfo.size > 0) {
                        check(started) { "MediaMuxer not started before writing sample" }
                        encodedBuffer.position(bufferInfo.offset)
                        encodedBuffer.limit(bufferInfo.offset + bufferInfo.size)
                        bufferInfo.presentationTimeUs = computePresentationTimeUs(nextFrameIdx, fps)
                        nextFrameIdx++
                        muxer.writeSampleData(track, encodedBuffer, bufferInfo)
                    }

                    codec.releaseOutputBuffer(outputIndex, false)
                    if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                        break
                    }
                }
            }
        }

        return DrainState(
            muxerStarted = started,
            trackIndex = track,
            encodedFrameIndex = nextFrameIdx,
        )
    }

    internal fun computePresentationTimeUs(frameIndex: Int, fps: Int): Long =
        ((frameIndex.toDouble() * 1_000_000.0) / fps.toDouble()).roundToLong()

    private fun alignEven(value: Int): Int =
        if (value <= 2) 2 else value and 1.inv()
}
