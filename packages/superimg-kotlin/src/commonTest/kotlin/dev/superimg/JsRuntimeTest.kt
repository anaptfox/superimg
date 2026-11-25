package dev.superimg

import kotlinx.coroutines.delay
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class JsRuntimeTest {
    private class FakeSuperImgJsEngine : SuperImgJsEngine {
        val calls = ArrayList<String>()
        var disposedId: String? = null

        override suspend fun evaluate(script: String, sourceName: String) {
            calls += "eval:$sourceName"
        }

        override suspend fun callGlobalJson(functionPath: String, argsJson: List<String>): String {
            calls += functionPath
            return when (functionPath) {
                "__superimgNative.loadArtifact" -> "\"artifact-42\""
                "__superimgNative.sampleArtifact" -> """
                    {
                      "kind": "@foxworth/superimg/display-list",
                      "schemaVersion": 1,
                      "width": 100.0,
                      "height": 100.0,
                      "ops": [
                        {
                          "id": "card",
                          "kind": "rect",
                          "bounds": { "x": 0.0, "y": 0.0, "width": 100.0, "height": 100.0 },
                          "opacity": 1.0,
                          "fill": { "kind": "solid", "color": "#112233" }
                        }
                      ],
                      "anchors": [],
                      "issues": []
                    }
                """.trimIndent()
                "__superimgNative.disposeArtifact" -> {
                    disposedId = argsJson.firstOrNull()
                    "null"
                }
                else -> error("Unexpected bridge call: $functionPath")
            }
        }

        override fun close() {}
    }

    @Test
    fun sessionDrivesCanonicalBridgeLifecycle() = runTest {
        val program = "export default {};"
        val programHash = platformSha256Hex(program.encodeToByteArray())
        val stubHash = "b".repeat(64)
        val mediaJson = """
            {"kind":"@foxworth/superimg/media-ir","schemaVersion":0,"identity":{"sourceId":"s","variantId":"default","editionId":"default"},"medium":"html","animated":true,"canvas":{"width":100,"height":100},"clock":{"fps":30,"durationSeconds":2,"totalFrames":60},"capabilities":{"temporal":"canonical","motion":"declarative","visual":"tree","portability":"self-contained","determinism":"verified"},"hashes":{"intentHash":"$stubHash","markupHash":"$stubHash","programHash":"$programHash"},"assets":[]}
        """.trimIndent()
        val jobJson = """
            {"schemaVersion":0,"coordinates":{"sourceId":"s","variantId":"default","editionId":"default"},"data":{},"width":100,"height":100,"fps":30,"durationSeconds":2,"totalFrames":60,"medium":"html","animated":true,"fonts":[],"inlineCss":[],"stylesheets":[],"assetMap":{},"resolvedAssets":[],"mode":"frame"}
        """.trimIndent()
        val files = listOf("media.json" to mediaJson, "program.mjs" to program, "job.json" to jobJson)
            .associate { (p, content) -> p to content.encodeToByteArray() }
            .toMutableMap()
        val entries = files.entries.sortedBy { it.key }.map { (p, bytes) ->
            ArtifactFileEntry(p, platformSha256Hex(bytes), bytes.size.toLong())
        }
        val artifactHash = platformSha256Hex(
            entries.joinToString("\n") { "${it.path}:${it.sha256}" }.encodeToByteArray(),
        )
        files["artifact.json"] = """
            {"kind":"@foxworth/superimg/artifact","schemaVersion":0,"artifactHash":"$artifactHash","files":[${entries.joinToString(",") { """{"path":"${it.path}","sha256":"${it.sha256}","bytes":${it.bytes}}""" }}],"runtime":{"requiresNetwork":false,"medium":"html","animated":true},"identity":{"sourceId":"s","variantId":"default","editionId":"default"}}
        """.trimIndent().encodeToByteArray()

        val loaded = ArtifactLoader.verifyAndParse(files)
        val engine = FakeSuperImgJsEngine()
        val session = SuperImgArtifactSession.load(engine, loaded)
        val frame = session.sample(seconds = 0.5, viewport = SuperImgViewport(100.0, 100.0))
        assertEquals("card", frame.ops.single().id)

        session.dispose()
        session.dispose() // idempotent
        assertEquals("\"artifact-42\"", engine.disposedId)
        assertEquals(
            listOf(
                "__superimgNative.loadArtifact",
                "__superimgNative.sampleArtifact",
                "__superimgNative.disposeArtifact",
            ),
            engine.calls,
        )
    }

    @Test
    fun coalescedSchedulerDropsIntermediatePendingRequestsWhileBusy() = runTest {
        val sampledTimes = ArrayList<Double>()
        val appliedTimes = ArrayList<Double>()

        val scheduler = CoalescedFrameScheduler(
            scope = this,
            sampler = { req ->
                sampledTimes += req.seconds
                delay(20)
                DisplayListFrame(width = 100.0, height = 100.0, ops = emptyList())
            },
            onFrame = { accepted ->
                appliedTimes += accepted.seconds
            },
        )

        val vp = SuperImgViewport(100.0, 100.0)
        scheduler.enqueue(0.1, vp)
        scheduler.enqueue(0.2, vp)
        scheduler.enqueue(0.3, vp)
        scheduler.enqueue(0.4, vp)

        delay(100)

        // First request starts immediately (0.1); intermediate (0.2, 0.3) coalesce into latest (0.4).
        assertEquals(listOf(0.1, 0.4), sampledTimes)
        assertEquals(listOf(0.1, 0.4), appliedTimes)
    }

    @Test
    fun benchmarkComputesPercentilesAndDroppedFrames() {
        val bench = SuperImgBenchmark()
        bench.record(2.0, 3.0)
        bench.record(4.0, 5.0)
        bench.record(10.0, 10.0)
        assertEquals(9.0, bench.p50Milliseconds)
        assertEquals(20.0, bench.maxMilliseconds)
        assertTrue(bench.p95Milliseconds >= 9.0)
        assertEquals(1, bench.droppedFrameBudget(fps = 60))
        assertEquals(2, bench.droppedFrameBudget(fps = 120))
    }
}
