package dev.superimg

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

public const val ARTIFACT_MANIFEST_KIND: String = "@foxworth/superimg/artifact"
public const val MEDIA_IR_KIND: String = "@foxworth/superimg/media-ir"

public val ArtifactJson: Json = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
}

public class ArtifactIntegrityException(
    public val code: String,
    message: String,
) : IllegalStateException("[$code] $message")

@Serializable
public data class MediaCoordinates(
    val sourceId: String,
    val entryId: String? = null,
    val variantId: String,
    val editionId: String,
)

@Serializable
public data class ArtifactFileEntry(
    val path: String,
    val sha256: String,
    val bytes: Long,
)

@Serializable
public data class ArtifactRuntimeDeclaration(
    val requiresNetwork: Boolean,
    val medium: String,
    val animated: Boolean,
)

@Serializable
public data class ArtifactManifest(
    val kind: String,
    val schemaVersion: Int,
    val artifactHash: String,
    val files: List<ArtifactFileEntry>,
    val runtime: ArtifactRuntimeDeclaration,
    val identity: MediaCoordinates,
)

@Serializable
public data class MediaIrCanvas(
    val width: Double,
    val height: Double,
)

@Serializable
public data class MediaIrClock(
    val fps: Double,
    val durationSeconds: Double,
    val totalFrames: Int,
)

@Serializable
public data class MediaIrCapabilities(
    val temporal: String,
    val motion: String,
    val visual: String,
    val portability: String,
    val determinism: String,
)

@Serializable
public data class MediaIrHashes(
    val intentHash: String,
    val markupHash: String,
    val programHash: String,
)

@Serializable
public data class MediaIrAsset(
    val id: String,
    val kind: String,
    val src: String,
    val remote: Boolean,
    val contentHash: String? = null,
)

@Serializable
public data class MediaIrDocument(
    val kind: String,
    val schemaVersion: Int,
    val identity: MediaCoordinates,
    val medium: String,
    val animated: Boolean,
    val canvas: MediaIrCanvas,
    val clock: MediaIrClock,
    val capabilities: MediaIrCapabilities,
    val hashes: MediaIrHashes,
    val assets: List<MediaIrAsset> = emptyList(),
)

@Serializable
public data class ResolvedArtifactAsset(
    val key: String,
    val type: String,
    val src: String,
)

@Serializable
public data class MediaJob(
    val schemaVersion: Int,
    val coordinates: MediaCoordinates,
    val data: JsonObject,
    val width: Double,
    val height: Double,
    val fps: Double,
    val durationSeconds: Double,
    val totalFrames: Int,
    val medium: String,
    val animated: Boolean,
    val fonts: List<String> = emptyList(),
    val inlineCss: List<String> = emptyList(),
    val stylesheets: List<String> = emptyList(),
    val tailwind: JsonElement? = null,
    val background: JsonElement? = null,
    val watermark: JsonElement? = null,
    val readiness: JsonElement? = null,
    val audio: JsonElement? = null,
    val assetMap: Map<String, String> = emptyMap(),
    val resolvedAssets: List<ResolvedArtifactAsset> = emptyList(),
    val mode: String = "frame",
    val preset: String? = null,
)

/**
 * Fully verified `.superimg/` artifact bundle ready to load into [SuperImgArtifactSession].
 */
public data class LoadedSuperImgArtifact(
    val rootPath: String?,
    val manifest: ArtifactManifest,
    val media: MediaIrDocument,
    val job: MediaJob,
    val mediaJson: String,
    val jobJson: String,
    val programCode: String,
    val assets: Map<String, ByteArray>,
    val fonts: Map<String, ByteArray>,
    val rawFiles: Map<String, ByteArray>,
) {
    /** Looks up verified asset bytes by logical asset key, alias, or relative artifact path. */
    public fun assetBytes(nameOrPath: String): ByteArray? =
        assets[nameOrPath] ?: rawFiles[nameOrPath]

    /** Looks up verified font bytes by font file name, relative path, or `font:<index>` alias. */
    public fun fontBytes(nameOrPath: String): ByteArray? =
        fonts[nameOrPath] ?: assets[nameOrPath] ?: rawFiles[nameOrPath]
}

/**
 * Platform SHA-256 hex digest helper (lowercase 64-char hex).
 */
internal expect fun platformSha256Hex(bytes: ByteArray): String

/**
 * Platform directory loader for `.superimg/` artifact folders.
 */
internal expect fun platformReadArtifactDirectory(directoryPath: String): Map<String, ByteArray>

public object ArtifactLoader {
    private val sha256Regex = Regex("^[0-9a-f]{64}$", RegexOption.IGNORE_CASE)

    /**
     * Loads and cryptographically verifies a compiled `.superimg/` directory from disk.
     */
    public fun loadDirectory(directoryPath: String): LoadedSuperImgArtifact {
        val files = platformReadArtifactDirectory(directoryPath)
        return verifyAndParse(files = files, rootPath = directoryPath)
    }

    /**
     * Pure in-memory verifier & parser for `.superimg/` artifact file maps.
     * Validates path safety, SHA-256 digests, `artifactHash`, manifest schema,
     * `media.json` + `job.json` consistency, and vendored asset/font bindings.
     */
    public fun verifyAndParse(
        files: Map<String, ByteArray>,
        rootPath: String? = null,
    ): LoadedSuperImgArtifact {
        val normalizedFiles = LinkedHashMap<String, ByteArray>(files.size)
        for ((rawPath, bytes) in files) {
            val clean = sanitizeRelativeArtifactPath(rawPath)
            if (normalizedFiles.put(clean, bytes) != null) {
                throw ArtifactIntegrityException("artifact_integrity", "Duplicate normalized path: $clean")
            }
        }

        val manifestBytes = normalizedFiles["artifact.json"]
            ?: throw ArtifactIntegrityException("artifact_integrity", "Missing artifact.json")
        val manifest = try {
            ArtifactJson.decodeFromString<ArtifactManifest>(manifestBytes.decodeToString())
        } catch (e: Exception) {
            throw ArtifactIntegrityException("invalid_schema", "Invalid artifact.json: ${e.message}")
        }

        validateManifest(manifest)

        val manifestPaths = HashSet<String>(manifest.files.size)
        for (entry in manifest.files) {
            val cleanPath = sanitizeRelativeArtifactPath(entry.path)
            manifestPaths.add(cleanPath)
            val content = normalizedFiles[cleanPath]
                ?: throw ArtifactIntegrityException("artifact_integrity", "Missing file: ${entry.path}")
            if (content.size.toLong() != entry.bytes) {
                throw ArtifactIntegrityException(
                    "artifact_integrity",
                    "Length mismatch for ${entry.path}: expected ${entry.bytes}, got ${content.size}",
                )
            }
            val actualHash = platformSha256Hex(content)
            if (!actualHash.equals(entry.sha256, ignoreCase = true)) {
                throw ArtifactIntegrityException(
                    "artifact_integrity",
                    "Hash mismatch for ${entry.path}: expected ${entry.sha256}, got $actualHash",
                )
            }
        }

        val expectedArtifactHashInput = manifest.files
            .sortedBy { it.path }
            .joinToString("\n") { "${it.path}:${it.sha256}" }
            .encodeToByteArray()
        val expectedArtifactHash = platformSha256Hex(expectedArtifactHashInput)
        if (!expectedArtifactHash.equals(manifest.artifactHash, ignoreCase = true)) {
            throw ArtifactIntegrityException(
                "artifact_integrity",
                "artifactHash mismatch: expected ${manifest.artifactHash}, got $expectedArtifactHash",
            )
        }

        val mediaJson = normalizedFiles["media.json"]?.decodeToString()
            ?: throw ArtifactIntegrityException("artifact_integrity", "Missing media.json")
        val jobJson = normalizedFiles["job.json"]?.decodeToString()
            ?: throw ArtifactIntegrityException("artifact_integrity", "Missing job.json")
        val programCode = normalizedFiles["program.mjs"]?.decodeToString()
            ?: throw ArtifactIntegrityException("artifact_integrity", "Missing program.mjs")

        val media = try {
            ArtifactJson.decodeFromString<MediaIrDocument>(mediaJson)
        } catch (e: Exception) {
            throw ArtifactIntegrityException("invalid_schema", "Invalid media.json: ${e.message}")
        }
        validateMediaIr(media)

        val job = try {
            ArtifactJson.decodeFromString<MediaJob>(jobJson)
        } catch (e: Exception) {
            throw ArtifactIntegrityException("artifact_integrity", "Invalid job.json: ${e.message}")
        }
        validateJob(job, manifestPaths)

        verifyConsistency(manifest, media, job, manifestPaths)

        val resolvedAssetsMap = LinkedHashMap<String, ByteArray>()
        for ((alias, relPath) in job.assetMap) {
            val clean = sanitizeRelativeArtifactPath(relPath)
            val bytes = normalizedFiles[clean]
                ?: throw ArtifactIntegrityException("artifact_integrity", "Missing mapped asset '$clean'")
            resolvedAssetsMap[alias] = bytes
            resolvedAssetsMap[clean] = bytes
        }
        for (asset in job.resolvedAssets) {
            if (!isRemoteOrDataUrl(asset.src)) {
                val clean = sanitizeRelativeArtifactPath(asset.src)
                val bytes = normalizedFiles[clean]
                    ?: throw ArtifactIntegrityException("artifact_integrity", "Missing resolved asset '$clean'")
                resolvedAssetsMap[asset.key] = bytes
                resolvedAssetsMap[clean] = bytes
            }
        }

        val fontsMap = LinkedHashMap<String, ByteArray>()
        for (entry in manifest.files) {
            val clean = sanitizeRelativeArtifactPath(entry.path)
            if (clean.startsWith("fonts/")) {
                val bytes = normalizedFiles.getValue(clean)
                fontsMap[clean] = bytes
                val fileName = clean.substringAfterLast('/')
                if (fileName.isNotEmpty()) {
                    fontsMap[fileName] = bytes
                    // Also index without the 16-char hash prefix (`<hash16>-<name>`) if present.
                    val dashIdx = fileName.indexOf('-')
                    if (dashIdx == 16 && dashIdx + 1 < fileName.length) {
                        fontsMap[fileName.substring(dashIdx + 1)] = bytes
                    }
                }
            }
        }
        for ((alias, relPath) in job.assetMap) {
            if (alias.startsWith("font:")) {
                val clean = sanitizeRelativeArtifactPath(relPath)
                normalizedFiles[clean]?.let { fontsMap[alias] = it }
            }
        }

        return LoadedSuperImgArtifact(
            rootPath = rootPath,
            manifest = manifest,
            media = media,
            job = job,
            mediaJson = mediaJson,
            jobJson = jobJson,
            programCode = programCode,
            assets = resolvedAssetsMap,
            fonts = fontsMap,
            rawFiles = normalizedFiles,
        )
    }

    /**
     * Guards against directory traversal (`..`, `.`, leading `/`, backslashes, URL tokens, control chars).
     */
    public fun sanitizeRelativeArtifactPath(rawPath: String): String {
        if (rawPath.isEmpty()) {
            throw ArtifactIntegrityException("path_traversal", "Artifact path must not be empty")
        }
        if (rawPath.startsWith('/') || rawPath.startsWith('\\') || rawPath.contains('\\')) {
            throw ArtifactIntegrityException("path_traversal", "Illegal artifact path: $rawPath")
        }
        // Reject Windows drive letters like C:...
        if (rawPath.length >= 2 && rawPath[1] == ':') {
            throw ArtifactIntegrityException("path_traversal", "Illegal drive path: $rawPath")
        }
        for (ch in rawPath) {
            if (ch.code < 0x20 || ch == '?' || ch == '#' || ch == '%') {
                throw ArtifactIntegrityException("path_traversal", "Illegal character in path: $rawPath")
            }
        }
        val segments = rawPath.split('/')
        for (segment in segments) {
            if (segment.isEmpty() || segment == "." || segment == "..") {
                throw ArtifactIntegrityException("path_traversal", "Illegal path segment in: $rawPath")
            }
        }
        return rawPath
    }

    private fun validateManifest(manifest: ArtifactManifest) {
        if (manifest.kind != ARTIFACT_MANIFEST_KIND ||
            (manifest.schemaVersion != 0 && manifest.schemaVersion != 1)
        ) {
            throw ArtifactIntegrityException("invalid_schema", "Invalid artifact manifest kind or schemaVersion")
        }
        if (!sha256Regex.matches(manifest.artifactHash)) {
            throw ArtifactIntegrityException("artifact_integrity", "artifactHash must be 64-char SHA-256 hex")
        }
        if (manifest.files.size < 3) {
            throw ArtifactIntegrityException(
                "artifact_integrity",
                "artifact.json.files must contain media.json, program.mjs, and job.json",
            )
        }
        if (manifest.runtime.medium != "html" && manifest.runtime.medium != "svg") {
            throw ArtifactIntegrityException("artifact_integrity", "Invalid runtime medium: ${manifest.runtime.medium}")
        }
        val seenPaths = HashSet<String>(manifest.files.size)
        for (entry in manifest.files) {
            val clean = sanitizeRelativeArtifactPath(entry.path)
            if (!seenPaths.add(clean)) {
                throw ArtifactIntegrityException("artifact_integrity", "Duplicate manifest file entry: $clean")
            }
            if (!sha256Regex.matches(entry.sha256) || entry.bytes < 0L) {
                throw ArtifactIntegrityException("artifact_integrity", "Invalid manifest file entry: $clean")
            }
        }
        for (required in listOf("media.json", "program.mjs", "job.json")) {
            if (required !in seenPaths) {
                throw ArtifactIntegrityException("artifact_integrity", "artifact.json.files is missing $required")
            }
        }
        if (manifest.schemaVersion == 1 && "native-modules.json" !in seenPaths) {
            throw ArtifactIntegrityException("artifact_integrity", "Schema-1 artifact is missing native-modules.json")
        }
        if (manifest.schemaVersion == 0 && "native-modules.json" in seenPaths) {
            throw ArtifactIntegrityException("invalid_schema", "Schema-0 artifact cannot declare native-modules.json")
        }
        validateCoordinates(manifest.identity, "artifact.json.identity")
    }

    private fun validateMediaIr(media: MediaIrDocument) {
        if (media.kind != MEDIA_IR_KIND || media.schemaVersion != 0) {
            throw ArtifactIntegrityException("invalid_schema", "Invalid media.json kind or schemaVersion")
        }
        validateCoordinates(media.identity, "media.json.identity")
        if (media.medium != "html" && media.medium != "svg") {
            throw ArtifactIntegrityException("artifact_integrity", "Invalid media.json medium: ${media.medium}")
        }
        if (!media.canvas.width.isFinite() || !media.canvas.height.isFinite() ||
            media.canvas.width <= 0.0 || media.canvas.height <= 0.0
        ) {
            throw ArtifactIntegrityException("artifact_integrity", "Invalid media.json canvas size")
        }
        if (!media.clock.fps.isFinite() || media.clock.fps <= 0.0 ||
            !media.clock.durationSeconds.isFinite() || media.clock.durationSeconds < 0.0 ||
            media.clock.totalFrames < 1
        ) {
            throw ArtifactIntegrityException("artifact_integrity", "Invalid media.json clock")
        }
        if (!sha256Regex.matches(media.hashes.programHash) ||
            !sha256Regex.matches(media.hashes.intentHash) ||
            !sha256Regex.matches(media.hashes.markupHash)
        ) {
            throw ArtifactIntegrityException("artifact_integrity", "Invalid media.json hashes")
        }
    }

    private fun validateJob(job: MediaJob, manifestPaths: Set<String>) {
        if (job.schemaVersion != 0) {
            throw ArtifactIntegrityException("unknown_version", "Unsupported job.json schemaVersion: ${job.schemaVersion}")
        }
        validateCoordinates(job.coordinates, "job.json.coordinates")
        if (!job.width.isFinite() || job.width <= 0.0 ||
            !job.height.isFinite() || job.height <= 0.0 ||
            !job.fps.isFinite() || job.fps <= 0.0 ||
            !job.durationSeconds.isFinite() || job.durationSeconds < 0.0 ||
            job.totalFrames < 1
        ) {
            throw ArtifactIntegrityException("artifact_integrity", "Invalid job.json clock or canvas")
        }
        if (job.medium != "html" && job.medium != "svg") {
            throw ArtifactIntegrityException("artifact_integrity", "Invalid job.json medium: ${job.medium}")
        }
        if (job.mode != "frame" && job.mode != "animation") {
            throw ArtifactIntegrityException("artifact_integrity", "Invalid job.json mode: ${job.mode}")
        }
        for ((alias, rel) in job.assetMap) {
            if (alias.isEmpty()) {
                throw ArtifactIntegrityException("artifact_integrity", "Empty assetMap alias")
            }
            val clean = sanitizeRelativeArtifactPath(rel)
            if (clean !in manifestPaths) {
                throw ArtifactIntegrityException("artifact_integrity", "Invalid job asset mapping: $alias -> $rel")
            }
        }
        val keys = HashSet<String>(job.resolvedAssets.size)
        for (asset in job.resolvedAssets) {
            if (asset.key.isEmpty() || !keys.add(asset.key)) {
                throw ArtifactIntegrityException("artifact_integrity", "Duplicate or empty resolved asset key: ${asset.key}")
            }
            if (asset.type != "image" && asset.type != "video" && asset.type != "audio") {
                throw ArtifactIntegrityException("artifact_integrity", "Invalid resolved asset type: ${asset.type}")
            }
            if (!isRemoteOrDataUrl(asset.src)) {
                val clean = sanitizeRelativeArtifactPath(asset.src)
                if (clean !in manifestPaths) {
                    throw ArtifactIntegrityException(
                        "artifact_integrity",
                        "Resolved asset is not declared in manifest: ${asset.src}",
                    )
                }
            }
        }
    }

    private fun verifyConsistency(
        manifest: ArtifactManifest,
        media: MediaIrDocument,
        job: MediaJob,
        manifestPaths: Set<String>,
    ) {
        val requiresNetwork = media.capabilities.portability == "network-required"
        if (job.coordinates != media.identity ||
            manifest.identity != media.identity ||
            job.width != media.canvas.width ||
            job.height != media.canvas.height ||
            job.fps != media.clock.fps ||
            job.durationSeconds != media.clock.durationSeconds ||
            job.totalFrames != media.clock.totalFrames ||
            job.medium != media.medium ||
            job.animated != media.animated ||
            manifest.runtime.medium != media.medium ||
            manifest.runtime.animated != media.animated ||
            manifest.runtime.requiresNetwork != requiresNetwork
        ) {
            throw ArtifactIntegrityException(
                "clock_mismatch",
                "artifact manifest/job does not match media.json",
            )
        }
        val programEntry = manifest.files.firstOrNull { it.path == "program.mjs" }
        if (programEntry == null || !programEntry.sha256.equals(media.hashes.programHash, ignoreCase = true)) {
            throw ArtifactIntegrityException(
                "artifact_integrity",
                "program.mjs hash does not match media.json programHash",
            )
        }
        if ("media.json" !in manifestPaths || "job.json" !in manifestPaths) {
            throw ArtifactIntegrityException("artifact_integrity", "Missing core IR files in manifest")
        }
    }

    private fun validateCoordinates(coords: MediaCoordinates, path: String) {
        if (coords.sourceId.isEmpty() || coords.variantId.isEmpty() || coords.editionId.isEmpty()) {
            throw ArtifactIntegrityException("artifact_integrity", "$path coordinates must be non-empty")
        }
        if (coords.entryId != null && coords.entryId.isEmpty()) {
            throw ArtifactIntegrityException("artifact_integrity", "$path.entryId must be non-empty when present")
        }
    }

    private fun isRemoteOrDataUrl(src: String): Boolean =
        src.startsWith("http://", ignoreCase = true) ||
            src.startsWith("https://", ignoreCase = true) ||
            src.startsWith("data:", ignoreCase = true)
}
