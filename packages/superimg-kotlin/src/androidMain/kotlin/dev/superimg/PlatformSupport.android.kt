package dev.superimg

import java.io.File
import java.security.MessageDigest

internal actual fun platformSha256Hex(bytes: ByteArray): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
    val hex = StringBuilder(digest.size * 2)
    for (byte in digest) {
        val v = byte.toInt() and 0xFF
        hex.append("0123456789abcdef"[v ushr 4])
        hex.append("0123456789abcdef"[v and 0x0F])
    }
    return hex.toString()
}

internal actual fun platformReadArtifactDirectory(directoryPath: String): Map<String, ByteArray> {
    val root = File(directoryPath).canonicalFile
    if (!root.exists() || !root.isDirectory) {
        throw ArtifactIntegrityException("artifact_integrity", "Not an artifact directory: $directoryPath")
    }
    val files = LinkedHashMap<String, ByteArray>()
    root.walkTopDown().forEach { file ->
        if (file.isFile) {
            val canonical = file.canonicalFile
            val rel = root.toPath().relativize(canonical.toPath()).toString().replace('\\', '/')
            if (rel.startsWith("..")) {
                throw ArtifactIntegrityException("path_traversal", "Path escapes artifact root: $rel")
            }
            files[rel] = canonical.readBytes()
        }
    }
    return files
}
