package dev.superimg

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.decodeFromJsonElement
import kotlin.math.ceil
import kotlin.math.min

public class SuperImgJsException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)

/**
 * Pluggable JavaScript runtime contract implemented by QuickJS, Hermes, JSC, or GraalJS adapters.
 *
 * All bridge calls serialize to/from JSON strings across the JNI/FFI boundary so implementations
 * remain zero-reflection and easy to wire into any JS VM binding (e.g. `quickjs-kt`, `zipline`,
 * or Facebook Hermes).
 */
public interface SuperImgJsEngine {
    /** Evaluates a JS script (such as the SuperImg native runtime shim) inside the VM context. */
    public suspend fun evaluate(script: String, sourceName: String = "runtime.js")

    /**
     * Calls a global JS function addressed by dot-separated path (e.g. `"__superimgNative.sampleArtifact"`)
     * with pre-serialized JSON argument strings, returning the JSON-serialized result string.
     */
    public suspend fun callGlobalJson(functionPath: String, argsJson: List<String>): String

    /** Disposes the underlying VM context and frees native handles. */
    public fun close()
}

/**
 * Adapter contract for QuickJS / Hermes bindings that evaluate raw JS expressions and
 * execute `JSON.stringify(fn(...args))` cleanly on a dedicated single-threaded VM dispatcher.
 */
public abstract class QuickJsEngineAdapter : SuperImgJsEngine {
    /** Evaluates raw JS code synchronously on the QuickJS/Hermes VM thread and returns string output. */
    protected abstract suspend fun evalRawOnVmThread(script: String, sourceName: String): String?

    override suspend fun evaluate(script: String, sourceName: String) {
        evalRawOnVmThread(script, sourceName)
    }

    override suspend fun callGlobalJson(functionPath: String, argsJson: List<String>): String {
        val parts = functionPath.split('.')
        val lookupExpr = parts.joinToString(".")
        val argsList = argsJson.joinToString(", ")
        val invocation = """
            (function() {
              const fn = globalThis.$lookupExpr;
              if (typeof fn !== "function") {
                throw new Error("Missing SuperImg bridge function: globalThis.$functionPath");
              }
              const result = fn($argsList);
              return JSON.stringify(result);
            })()
        """.trimIndent()
        return evalRawOnVmThread(invocation, "$functionPath.call.js")
            ?: throw SuperImgJsException("Bridge function $functionPath returned null/undefined")
    }
}

@Serializable
public data class SuperImgSafeArea(
    val top: Double = 0.0,
    val left: Double = 0.0,
    val bottom: Double = 0.0,
    val right: Double = 0.0,
)

@Serializable
public data class SuperImgViewport(
    val width: Double,
    val height: Double,
    val scale: Double = 1.0,
    val safeArea: SuperImgSafeArea = SuperImgSafeArea(),
    val reduceMotion: Boolean = false,
)

@Serializable
public data class SuperImgSampleRequest(
    val seconds: Double,
    val frame: Int,
    val width: Double,
    val height: Double,
    val scale: Double = 1.0,
    val safeArea: SuperImgSafeArea = SuperImgSafeArea(),
    val reduceMotion: Boolean = false,
    val data: JsonElement? = null,
    val edition: String? = null,
)

@Serializable
private data class LoadArtifactPayload(
    val programCode: String,
    val media: JsonElement,
    val job: JsonElement,
    val fonts: Map<String, String> = emptyMap(),
)

/**
 * Drives the canonical `__superimgNative` JS artifact bridge:
 * - `globalThis.__superimgNative.loadArtifact({ programCode, media, job, fonts })`
 * - `globalThis.__superimgNative.sampleArtifact(id, { seconds, frame, width, height, scale, safeArea, reduceMotion, data, edition })`
 * - `globalThis.__superimgNative.disposeArtifact(id)`
 */
public class SuperImgArtifactSession private constructor(
    private val engine: SuperImgJsEngine,
    private val artifactId: String,
    public val artifact: LoadedSuperImgArtifact,
) {
    private val mutex = Mutex()
    private var disposed = false

    public companion object {
        private const val FN_LOAD = "__superimgNative.loadArtifact"
        private const val FN_SAMPLE = "__superimgNative.sampleArtifact"
        private const val FN_DISPOSE = "__superimgNative.disposeArtifact"

        /**
         * Loads a verified [LoadedSuperImgArtifact] into the JS runtime via `__superimgNative.loadArtifact`.
         */
        public suspend fun load(
            engine: SuperImgJsEngine,
            artifact: LoadedSuperImgArtifact,
            fontManifest: Map<String, String> = emptyMap(),
        ): SuperImgArtifactSession {
            val mediaEl = ArtifactJson.parseToJsonElement(artifact.mediaJson)
            val jobEl = ArtifactJson.parseToJsonElement(artifact.jobJson)
            val payload = LoadArtifactPayload(
                programCode = artifact.programCode,
                media = mediaEl,
                job = jobEl,
                fonts = fontManifest,
            )
            val payloadJson = DisplayListJson.encodeToString(payload)
            val rawId = engine.callGlobalJson(FN_LOAD, listOf(payloadJson))
            val artifactId = decodeArtifactId(rawId)
            return SuperImgArtifactSession(
                engine = engine,
                artifactId = artifactId,
                artifact = artifact,
            )
        }

        private fun decodeArtifactId(rawJson: String): String {
            val trimmed = rawJson.trim()
            if (trimmed.startsWith('"')) {
                val parsed = ArtifactJson.decodeFromString<JsonPrimitive>(trimmed)
                if (parsed.isString && parsed.content.isNotEmpty()) return parsed.content
            }
            if (trimmed.startsWith('{')) {
                val obj = ArtifactJson.decodeFromString<JsonObject>(trimmed)
                val idProp = obj["id"] as? JsonPrimitive
                if (idProp != null && idProp.isString && idProp.content.isNotEmpty()) {
                    return idProp.content
                }
            }
            throw SuperImgJsException("Invalid artifact id returned by $FN_LOAD: $rawJson")
        }
    }

    /**
     * Samples one [DisplayListFrame] at [seconds] and [viewport], validating the returned frame.
     */
    public suspend fun sample(
        seconds: Double,
        viewport: SuperImgViewport,
        frame: Int? = null,
        data: JsonElement? = null,
        edition: String? = null,
    ): DisplayListFrame {
        require(seconds.isFinite() && seconds >= 0.0) { "seconds must be finite and >= 0: $seconds" }
        require(viewport.width.isFinite() && viewport.width > 0.0) { "viewport width must be > 0" }
        require(viewport.height.isFinite() && viewport.height > 0.0) { "viewport height must be > 0" }
        require(viewport.scale.isFinite() && viewport.scale > 0.0) { "viewport scale must be > 0" }

        val fps = artifact.media.clock.fps
        val computedFrame = frame ?: (seconds * fps).toInt().coerceAtLeast(0)
        val request = SuperImgSampleRequest(
            seconds = seconds,
            frame = computedFrame,
            width = viewport.width,
            height = viewport.height,
            scale = viewport.scale,
            safeArea = viewport.safeArea,
            reduceMotion = viewport.reduceMotion,
            data = data,
            edition = edition,
        )
        val idJson = DisplayListJson.encodeToString(artifactId)
        val reqJson = DisplayListJson.encodeToString(request)

        val frameJson = mutex.withLock {
            if (disposed) throw SuperImgJsException("Artifact session '$artifactId' already disposed")
            engine.callGlobalJson(FN_SAMPLE, listOf(idJson, reqJson))
        }
        return parseDisplayListFrame(frameJson, validate = true)
    }

    /**
     * Releases the artifact inside the JS runtime via `__superimgNative.disposeArtifact`. Idempotent.
     */
    public suspend fun dispose() {
        val shouldDispose = mutex.withLock {
            if (disposed) false else {
                disposed = true
                true
            }
        }
        if (shouldDispose) {
            val idJson = DisplayListJson.encodeToString(artifactId)
            engine.callGlobalJson(FN_DISPOSE, listOf(idJson))
        }
    }
}

/**
 * Single-in-flight, latest-pending coalesced frame scheduler mirroring Swift `SuperImgCanvas`
 * and Rive runtime discipline:
 *
 * - At most one sample request executes at a time (`busy`).
 * - If new ticks, seeks, or state/viewport invalidations arrive while busy, only the **latest**
 *   pending request is retained; earlier queued requests are dropped immediately.
 * - Changing `generation` or `revision` invalidates in-flight results so stale frames never
 *   overwrite newer viewport sizes or host state.
 */
public class CoalescedFrameScheduler(
    private val scope: CoroutineScope,
    private val sampler: suspend (SampleRequest) -> DisplayListFrame,
    private val onFrame: (AcceptedFrame) -> Unit,
    private val onError: (Throwable) -> Unit = {},
) {
    public data class SampleRequest(
        val generation: Long,
        val revision: Long,
        val seconds: Double,
        val viewport: SuperImgViewport,
        val data: JsonElement? = null,
        val edition: String? = null,
    )

    public data class AcceptedFrame(
        val generation: Long,
        val revision: Long,
        val seconds: Double,
        val viewport: SuperImgViewport,
        val frame: DisplayListFrame,
    )

    private var generation: Long = 0L
    private var revision: Long = 0L
    private var busy: Boolean = false
    private var pending: SampleRequest? = null
    private var activeJob: Job? = null
    private var lastErrorMessage: String? = null

    public fun currentGeneration(): Long = generation
    public fun currentRevision(): Long = revision

    /** Bumps state revision (e.g. host data/edition update) and clears older pending work. */
    public fun bumpRevision(): Long {
        revision++
        pending = null
        return revision
    }

    /** Bumps geometry/mount generation (e.g. viewport resize or unmount) and clears older pending work. */
    public fun invalidateGeneration(): Long {
        generation++
        pending = null
        return generation
    }

    /** Enqueues a frame sample, coalescing any earlier unstarted request. */
    public fun enqueue(
        seconds: Double,
        viewport: SuperImgViewport,
        data: JsonElement? = null,
        edition: String? = null,
    ) {
        if (!seconds.isFinite() || seconds < 0.0) return
        if (!viewport.width.isFinite() || !viewport.height.isFinite() ||
            viewport.width <= 0.0 || viewport.height <= 0.0
        ) {
            return
        }
        pending = SampleRequest(
            generation = generation,
            revision = revision,
            seconds = seconds,
            viewport = viewport,
            data = data,
            edition = edition,
        )
        startNextIfIdle()
    }

    /** Cancels pending work and bumps generation (safe on dispose/unmount). */
    public fun reset() {
        generation++
        pending = null
        activeJob?.cancel()
        activeJob = null
        busy = false
        lastErrorMessage = null
    }

    private fun startNextIfIdle() {
        if (busy) return
        val next = pending ?: return
        pending = null
        busy = true

        activeJob = scope.launch {
            val result = try {
                Result.success(sampler(next))
            } catch (c: CancellationException) {
                throw c
            } catch (t: Throwable) {
                Result.failure(t)
            }
            complete(next, result)
        }
    }

    private fun complete(request: SampleRequest, result: Result<DisplayListFrame>) {
        busy = false
        try {
            if (request.generation == generation && request.revision == revision) {
                result.fold(
                    onSuccess = { frame ->
                        lastErrorMessage = null
                        onFrame(
                            AcceptedFrame(
                                generation = request.generation,
                                revision = request.revision,
                                seconds = request.seconds,
                                viewport = request.viewport,
                                frame = frame,
                            ),
                        )
                    },
                    onFailure = { error ->
                        val msg = error.message ?: error::class.simpleName ?: "Unknown error"
                        if (lastErrorMessage != msg) {
                            lastErrorMessage = msg
                            onError(error)
                        }
                    },
                )
            }
        } finally {
            startNextIfIdle()
        }
    }
}

/**
 * Per-frame CPU timing record matching Swift's `SuperImgFrameMetrics` for 60/120Hz profiling.
 */
public data class SuperImgFrameMetrics(
    val sampleMilliseconds: Double,
    val renderMilliseconds: Double,
) {
    public val totalMilliseconds: Double get() = sampleMilliseconds + renderMilliseconds
}

/**
 * Rolling percentile benchmark collector matching Swift's `SuperImgBenchmark`.
 */
public class SuperImgBenchmark {
    private val values = ArrayList<SuperImgFrameMetrics>()

    public fun record(sampleMilliseconds: Double, renderMilliseconds: Double) {
        if (!sampleMilliseconds.isFinite() || !renderMilliseconds.isFinite() ||
            sampleMilliseconds < 0.0 || renderMilliseconds < 0.0
        ) {
            return
        }
        values += SuperImgFrameMetrics(sampleMilliseconds, renderMilliseconds)
    }

    public val frames: List<SuperImgFrameMetrics> get() = values
    public val p50Milliseconds: Double get() = percentile(0.50)
    public val p95Milliseconds: Double get() = percentile(0.95)
    public val maxMilliseconds: Double get() = values.maxOfOrNull { it.totalMilliseconds } ?: 0.0

    public fun droppedFrameBudget(fps: Int): Int {
        if (fps <= 0) return 0
        val deadlineMs = 1000.0 / fps.toDouble()
        return values.count { it.totalMilliseconds > deadlineMs }
    }

    private fun percentile(p: Double): Double {
        if (values.isEmpty()) return 0.0
        val sorted = values.map { it.totalMilliseconds }.sorted()
        val idx = min(sorted.size - 1, ceil((sorted.size - 1) * p).toInt())
        return sorted[idx]
    }
}
