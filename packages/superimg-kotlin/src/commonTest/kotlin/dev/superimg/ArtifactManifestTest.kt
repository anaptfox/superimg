package dev.superimg

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull

class ArtifactManifestTest {
    private fun buildValidArtifactFiles(
        schemaVersion: Int = 0,
        tamperProgram: Boolean = false,
    ): Map<String, ByteArray> {
        val programCode = "export default { render() {} };"
        val programBytes = programCode.encodeToByteArray()
        val programHash = platformSha256Hex(programBytes)
        val stubHash = "a".repeat(64)

        val mediaJson = """
            {
              "kind": "@foxworth/superimg/media-ir",
              "schemaVersion": 0,
              "identity": { "sourceId": "meadow", "variantId": "default", "editionId": "default" },
              "medium": "html",
              "animated": true,
              "canvas": { "width": 1080, "height": 1920 },
              "clock": { "fps": 60, "durationSeconds": 4.0, "totalFrames": 240 },
              "capabilities": {
                "temporal": "canonical",
                "motion": "declarative",
                "visual": "tree",
                "portability": "self-contained",
                "determinism": "verified"
              },
              "hashes": {
                "intentHash": "$stubHash",
                "markupHash": "$stubHash",
                "programHash": "$programHash"
              },
              "assets": []
            }
        """.trimIndent()

        val spriteBytes = byteArrayOf(1, 2, 3, 4)
        val spritePath = "assets/${platformSha256Hex(spriteBytes).take(16)}-nell.png"
        val fontBytes = byteArrayOf(0x00, 0x01, 0x00, 0x00)
        val fontPath = "fonts/${platformSha256Hex(fontBytes).take(16)}-Inter.ttf"

        val jobJson = """
            {
              "schemaVersion": 0,
              "coordinates": { "sourceId": "meadow", "variantId": "default", "editionId": "default" },
              "data": { "title": "Hello" },
              "width": 1080,
              "height": 1920,
              "fps": 60,
              "durationSeconds": 4.0,
              "totalFrames": 240,
              "medium": "html",
              "animated": true,
              "fonts": ["Inter:400"],
              "inlineCss": [],
              "stylesheets": [],
              "tailwind": false,
              "background": null,
              "watermark": null,
              "readiness": null,
              "audio": null,
              "assetMap": { "nell": "$spritePath", "font:0": "$fontPath" },
              "resolvedAssets": [{ "key": "nell", "type": "image", "src": "$spritePath" }],
              "mode": "frame"
            }
        """.trimIndent()

        val fileMap = linkedMapOf(
            "media.json" to mediaJson.encodeToByteArray(),
            "program.mjs" to if (tamperProgram) "tampered".encodeToByteArray() else programBytes,
            "job.json" to jobJson.encodeToByteArray(),
            spritePath to spriteBytes,
            fontPath to fontBytes,
        )

        val entries = listOf("media.json", "program.mjs", "job.json", spritePath, fontPath)
            .sorted()
            .map { path ->
                val bytes = if (path == "program.mjs" && tamperProgram) programBytes else fileMap.getValue(path)
                ArtifactFileEntry(
                    path = path,
                    sha256 = platformSha256Hex(bytes),
                    bytes = bytes.size.toLong(),
                )
            }

        val artifactHash = platformSha256Hex(
            entries.sortedBy { it.path }.joinToString("\n") { "${it.path}:${it.sha256}" }.encodeToByteArray(),
        )

        val manifestJson = """
            {
              "kind": "@foxworth/superimg/artifact",
              "schemaVersion": $schemaVersion,
              "artifactHash": "$artifactHash",
              "files": [
                ${entries.joinToString(",") { """{"path":"${it.path}","sha256":"${it.sha256}","bytes":${it.bytes}}""" }}
              ],
              "runtime": { "requiresNetwork": false, "medium": "html", "animated": true },
              "identity": { "sourceId": "meadow", "variantId": "default", "editionId": "default" }
            }
        """.trimIndent()

        fileMap["artifact.json"] = manifestJson.encodeToByteArray()
        return fileMap
    }

    @Test
    fun verifiesValidArtifactBundleAndResolvesAssetsAndFonts() {
        val loaded = ArtifactLoader.verifyAndParse(buildValidArtifactFiles())
        assertEquals("meadow", loaded.manifest.identity.sourceId)
        assertEquals(240, loaded.media.clock.totalFrames)
        assertNotNull(loaded.assetBytes("nell"))
        assertNotNull(loaded.fontBytes("Inter.ttf"))
        assertNotNull(loaded.fontBytes("font:0"))
    }

    @Test
    fun rejectsTamperedFileBytes() {
        val files = buildValidArtifactFiles(tamperProgram = true)
        val ex = assertFailsWith<ArtifactIntegrityException> {
            ArtifactLoader.verifyAndParse(files)
        }
        assertEquals("artifact_integrity", ex.code)
    }

    @Test
    fun rejectsPathTraversalAttempts() {
        for (bad in listOf("../secret.txt", "/etc/passwd", "assets\\foo.png", "assets/a?b=1", "assets//foo.png")) {
            val ex = assertFailsWith<ArtifactIntegrityException> {
                ArtifactLoader.sanitizeRelativeArtifactPath(bad)
            }
            assertEquals("path_traversal", ex.code)
        }
    }
}
