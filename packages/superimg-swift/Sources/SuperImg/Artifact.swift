import CoreGraphics
import CoreText
import CryptoKit
import Foundation
import ImageIO
import JavaScriptCore

public struct SuperImgArtifactInfo: Equatable, Sendable {
    public let id: String
    public let width: Double
    public let height: Double
    public let fps: Double
    public let durationSeconds: Double
    public let totalFrames: Int
    public let animated: Bool
    public let editions: [String]

    public init(
        id: String,
        width: Double,
        height: Double,
        fps: Double,
        durationSeconds: Double,
        totalFrames: Int,
        animated: Bool,
        editions: [String]
    ) {
        self.id = id
        self.width = width
        self.height = height
        self.fps = fps
        self.durationSeconds = durationSeconds
        self.totalFrames = totalFrames
        self.animated = animated
        self.editions = editions
    }
}

public struct SuperImgSampleRequest: Encodable, Equatable, Sendable {
    public var seconds: Double?
    public var frame: Int?
    public var width: Double?
    public var height: Double?
    public var scale: Double?
    public var safeArea: SuperImgViewport.Insets?
    public var reduceMotion: Bool?
    public var edition: String?
    public var strict: Bool?

    public init(
        seconds: Double? = nil,
        frame: Int? = nil,
        width: Double? = nil,
        height: Double? = nil,
        scale: Double? = nil,
        safeArea: SuperImgViewport.Insets? = nil,
        reduceMotion: Bool? = nil,
        edition: String? = nil,
        strict: Bool? = nil
    ) {
        self.seconds = seconds
        self.frame = frame
        self.width = width
        self.height = height
        self.scale = scale
        self.safeArea = safeArea
        self.reduceMotion = reduceMotion
        self.edition = edition
        self.strict = strict
    }
}

public actor SuperImgArtifact {
    nonisolated public let info: SuperImgArtifactInfo
    nonisolated public let assets: [String: SuperImgImageAsset]
    private let context: JSContext
    private let root: JSValue
    private let parse: JSValue
    private let stringify: JSValue
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private init(
        info: SuperImgArtifactInfo,
        assets: [String: SuperImgImageAsset],
        context: JSContext,
        root: JSValue,
        parse: JSValue,
        stringify: JSValue
    ) {
        self.info = info
        self.assets = assets
        self.context = context
        self.root = root
        self.parse = parse
        self.stringify = stringify
    }

    public static func load(
        directory: URL,
        runtimeScriptURL: URL? = nil,
        runtimeSource: String? = nil
    ) async throws -> SuperImgArtifact {
        let dir = directory.resolvingSymlinksInPath().standardizedFileURL

        func read(_ name: String) throws -> Data {
            guard !name.isEmpty,
                  !name.hasPrefix("/"),
                  !name.contains(".."),
                  !name.contains("\\") else {
                throw SuperImgError.invalidFrame("Invalid artifact path: \(name)")
            }
            let candidate = dir.appendingPathComponent(name).standardizedFileURL
            guard candidate.path.hasPrefix(dir.path + "/") else {
                throw SuperImgError.invalidFrame("Invalid artifact path: \(name)")
            }
            guard FileManager.default.fileExists(atPath: candidate.path) else {
                throw SuperImgError.invalidFrame("Missing artifact file: \(name)")
            }
            let resolved = candidate.resolvingSymlinksInPath().standardizedFileURL
            guard resolved.path.hasPrefix(dir.path + "/") else {
                throw SuperImgError.invalidFrame("Artifact path escapes directory: \(name)")
            }
            return try Data(contentsOf: resolved)
        }

        let manifestData = try read("artifact.json")
        guard let manifest = try JSONSerialization.jsonObject(with: manifestData) as? [String: Any],
              manifest["kind"] as? String == "@foxworth/superimg/artifact",
              let schema = manifest["schemaVersion"] as? Int,
              schema == 0 || schema == 1 else {
            throw SuperImgError.invalidFrame("Invalid artifact manifest")
        }

        guard let filesArray = manifest["files"] as? [[String: Any]] else {
            throw SuperImgError.invalidFrame("artifact.json.files must be an array")
        }

        var seenPaths = Set<String>()
        var filePaths: [String] = []
        for entry in filesArray {
            guard let path = entry["path"] as? String, !path.isEmpty,
                  let expectedSha = entry["sha256"] as? String,
                  !(entry["bytes"] is Bool),
                  let expectedBytes = entry["bytes"] as? Int,
                  expectedBytes >= 0 else {
                throw SuperImgError.invalidFrame("Invalid artifact file entry")
            }
            guard seenPaths.insert(path).inserted else {
                throw SuperImgError.invalidFrame("Duplicate artifact path: \(path)")
            }
            let bytes = try read(path)
            guard bytes.count == expectedBytes else {
                throw SuperImgError.invalidFrame("Byte count mismatch: \(path)")
            }
            let actualSha = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
            guard actualSha == expectedSha.lowercased() else {
                throw SuperImgError.invalidFrame("Integrity mismatch: \(path)")
            }
            filePaths.append(path)
        }

        for required in ["media.json", "program.mjs", "job.json"] {
            guard seenPaths.contains(required) else {
                throw SuperImgError.invalidFrame("Missing artifact file \(required)")
            }
        }

        let mediaData = try read("media.json")
        let jobData = try read("job.json")
        let programData = try read("program.mjs")
        guard let program = String(data: programData, encoding: .utf8) else {
            throw SuperImgError.invalidFrame("Invalid program encoding")
        }

        let media = (try JSONSerialization.jsonObject(with: mediaData)) as? [String: Any] ?? [:]
        let job = (try JSONSerialization.jsonObject(with: jobData)) as? [String: Any] ?? [:]

        var pathAssets: [String: SuperImgImageAsset] = [:]
        var assets: [String: SuperImgImageAsset] = [:]
        for path in filePaths where ["png", "jpg", "jpeg", "webp", "gif"].contains(
            URL(fileURLWithPath: path).pathExtension.lowercased()
        ) {
            let fileURL = dir.appendingPathComponent(path).standardizedFileURL
            if let src = CGImageSourceCreateWithURL(fileURL as CFURL, nil),
               let image = CGImageSourceCreateImageAtIndex(src, 0, nil) {
                let asset = SuperImgImageAsset(image: image)
                pathAssets[path] = asset
                assets[path] = asset
            }
        }

        if let assetMap = job["assetMap"] as? [String: String] {
            for (alias, relPath) in assetMap {
                if let asset = pathAssets[relPath] {
                    assets[alias] = asset
                }
            }
        }
        if let resolvedAssets = job["resolvedAssets"] as? [[String: Any]] {
            for entry in resolvedAssets {
                guard let key = entry["key"] as? String,
                      let src = entry["src"] as? String else { continue }
                if let asset = pathAssets[src] ?? assets[src] {
                    assets[key] = asset
                    assets[src] = asset
                }
            }
        }

        var fonts: [[String: Any]] = []
        for path in filePaths where ["ttf", "otf"].contains(
            URL(fileURLWithPath: path).pathExtension.lowercased()
        ) {
            let fileURL = dir.appendingPathComponent(path).standardizedFileURL
            guard let data = try? Data(contentsOf: fileURL),
                  let provider = CGDataProvider(data: data as CFData),
                  let cgFont = CGFont(provider) else { continue }
            CTFontManagerRegisterFontsForURL(fileURL as CFURL, .process, nil)
            let ctFont = CTFontCreateWithGraphicsFont(cgFont, 12, nil, nil)
            let family = CTFontCopyFamilyName(ctFont) as String
            let weight = cssWeight(from: ctFont)
            let style = CTFontGetSymbolicTraits(ctFont).contains(.traitItalic) ? "italic" : "normal"
            fonts.append([
                "family": family,
                "weight": weight,
                "style": style,
                "base64": data.base64EncodedString(),
            ])
        }

        let src: String?
        if let runtimeSource {
            src = runtimeSource
        } else if let runtimeScriptURL {
            src = try String(contentsOf: runtimeScriptURL, encoding: .utf8)
        } else {
            #if SWIFT_PACKAGE
            let moduleURL = Bundle.module.url(forResource: "superimg-jsc-runtime", withExtension: "js")
            #else
            let moduleURL: URL? = nil
            #endif
            if let url = moduleURL ?? Bundle.main.url(forResource: "superimg-jsc-runtime", withExtension: "js") {
                src = try String(contentsOf: url, encoding: .utf8)
            } else {
                src = nil
            }
        }

        guard let src, let ctx = JSContext() else {
            throw SuperImgError.missingProgram("superimg-jsc-runtime.js")
        }

        ctx.exception = nil
        guard let parse = ctx.evaluateScript("JSON.parse"), !parse.isUndefined, ctx.exception == nil,
              let stringify = ctx.evaluateScript("JSON.stringify"), !stringify.isUndefined, ctx.exception == nil else {
            throw SuperImgError.evaluation(ctx.exception?.toString() ?? "Could not initialize JavaScriptCore JSON helpers")
        }

        ctx.exception = nil
        if let runtimeScriptURL {
            ctx.evaluateScript(src, withSourceURL: runtimeScriptURL)
        } else {
            ctx.evaluateScript(src)
        }
        if let exception = ctx.exception {
            throw SuperImgError.evaluation(exception.toString() ?? "Failed to evaluate native runtime")
        }

        ctx.exception = nil
        guard let api = ctx.evaluateScript("globalThis.__superimgNative"),
              !api.isUndefined, !api.isNull, ctx.exception == nil else {
            throw SuperImgError.evaluation(ctx.exception?.toString() ?? "Missing native runtime")
        }

        let payload: [String: Any] = [
            "programCode": program,
            "media": media,
            "job": job,
            "fonts": fonts,
        ]
        let payloadData = try JSONSerialization.data(withJSONObject: payload)
        let payloadJSON = String(decoding: payloadData, as: UTF8.self)

        ctx.exception = nil
        guard let payloadValue = parse.call(withArguments: [payloadJSON]), ctx.exception == nil else {
            throw SuperImgError.evaluation(ctx.exception?.toString() ?? "Failed to parse loadArtifact payload")
        }

        ctx.exception = nil
        guard let loadResult = api.invokeMethod("loadArtifact", withArguments: [payloadValue]),
              ctx.exception == nil else {
            throw SuperImgError.evaluation(ctx.exception?.toString() ?? "loadArtifact failed")
        }

        var loadedDict: [String: Any] = [:]
        var loadedStringId: String?
        if !loadResult.isUndefined && !loadResult.isNull {
            ctx.exception = nil
            guard let serialized = stringify.call(withArguments: [loadResult]),
                  ctx.exception == nil else {
                throw SuperImgError.evaluation(ctx.exception?.toString() ?? "Failed to serialize loadArtifact result")
            }
            if let str = serialized.toString(), let data = str.data(using: .utf8),
               let parsed = try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]) {
                if let dict = parsed as? [String: Any] {
                    loadedDict = dict
                } else if let strId = parsed as? String {
                    loadedStringId = strId
                }
            }
        }

        let info = buildInfo(loaded: loadedDict, loadedStringId: loadedStringId, media: media, job: job)
        return SuperImgArtifact(
            info: info,
            assets: assets,
            context: ctx,
            root: api,
            parse: parse,
            stringify: stringify
        )
    }

    public func sample(
        _ request: SuperImgSampleRequest = .init(),
        dataPatchJSON: String? = nil
    ) throws -> DisplayListFrame {
        let encoded = try encoder.encode(request)
        var obj = (try JSONSerialization.jsonObject(with: encoded)) as? [String: Any] ?? [:]
        if let dataPatchJSON {
            obj["data"] = try JSONSerialization.jsonObject(with: Data(dataPatchJSON.utf8))
        }
        let reqData = try JSONSerialization.data(withJSONObject: obj)
        let reqJSON = String(decoding: reqData, as: UTF8.self)

        context.exception = nil
        guard let reqValue = parse.call(withArguments: [reqJSON]), context.exception == nil else {
            throw SuperImgError.evaluation(context.exception?.toString() ?? "Failed to serialize sample request")
        }

        context.exception = nil
        guard let result = root.invokeMethod("sampleArtifact", withArguments: [info.id, reqValue]),
              context.exception == nil,
              !result.isUndefined, !result.isNull else {
            throw SuperImgError.evaluation(context.exception?.toString() ?? "Artifact sampling failed")
        }

        context.exception = nil
        guard let jsonValue = stringify.call(withArguments: [result]),
              context.exception == nil,
              jsonValue.isString,
              let jsonString = jsonValue.toString() else {
            throw SuperImgError.evaluation(context.exception?.toString() ?? "Failed to stringify sampled frame")
        }

        let frame = try decoder.decode(DisplayListFrame.self, from: Data(jsonString.utf8))
        try frame.validate()
        return frame
    }

    public func renderPNG(
        _ request: SuperImgSampleRequest = .init(),
        dataPatchJSON: String? = nil,
        scale: CGFloat = 1
    ) throws -> Data {
        try SuperImgGraphicsRenderer.renderPNG(
            sample(request, dataPatchJSON: dataPatchJSON),
            assets: assets,
            scale: scale
        )
    }

    public func dispose() {
        context.exception = nil
        _ = root.invokeMethod("disposeArtifact", withArguments: [info.id])
        context.exception = nil
    }

    private static func buildInfo(
        loaded: [String: Any],
        loadedStringId: String?,
        media: [String: Any],
        job: [String: Any]
    ) -> SuperImgArtifactInfo {
        let canvas = media["canvas"] as? [String: Any] ?? [:]
        let clock = media["clock"] as? [String: Any] ?? [:]
        let identity = media["identity"] as? [String: Any] ?? [:]

        func number(_ value: Any?) -> Double? {
            if value is Bool { return nil }
            return (value as? NSNumber)?.doubleValue
        }
        func integer(_ value: Any?) -> Int? {
            if value is Bool { return nil }
            return (value as? NSNumber)?.intValue
        }

        let id = (loaded["id"] as? String)
            ?? loadedStringId
            ?? (media["id"] as? String)
            ?? (identity["sourceId"] as? String)
            ?? "artifact"

        let width = number(loaded["width"])
            ?? number(canvas["width"])
            ?? number(job["width"])
            ?? number(media["width"])
            ?? 1920

        let height = number(loaded["height"])
            ?? number(canvas["height"])
            ?? number(job["height"])
            ?? number(media["height"])
            ?? 1080

        let fps = number(loaded["fps"])
            ?? number(clock["fps"])
            ?? number(job["fps"])
            ?? number(media["fps"])
            ?? 30

        let durationSeconds = number(loaded["durationSeconds"])
            ?? number(clock["durationSeconds"])
            ?? number(job["durationSeconds"])
            ?? number(media["durationSeconds"])
            ?? 0

        let totalFrames = integer(loaded["totalFrames"])
            ?? integer(clock["totalFrames"])
            ?? integer(job["totalFrames"])
            ?? integer(media["totalFrames"])
            ?? 1

        let animated = (loaded["animated"] as? Bool)
            ?? (job["animated"] as? Bool)
            ?? (media["animated"] as? Bool)
            ?? false

        let editions: [String]
        if let list = loaded["editions"] as? [String] {
            editions = list
        } else if let dict = loaded["editions"] as? [String: Any] {
            editions = dict.keys.sorted()
        } else if let list = media["editions"] as? [String] {
            editions = list
        } else if let dict = media["editions"] as? [String: Any] {
            editions = dict.keys.sorted()
        } else {
            editions = []
        }

        return SuperImgArtifactInfo(
            id: id,
            width: width,
            height: height,
            fps: fps,
            durationSeconds: durationSeconds,
            totalFrames: totalFrames,
            animated: animated,
            editions: editions
        )
    }

    private static func cssWeight(from ctFont: CTFont) -> Int {
        let traits = CTFontCopyTraits(ctFont) as NSDictionary
        if let w = traits[kCTFontWeightTrait as String] as? Double {
            if w <= -0.5 { return 200 }
            if w <= -0.3 { return 300 }
            if w < 0.15 { return 400 }
            if w < 0.27 { return 500 }
            if w < 0.35 { return 600 }
            if w < 0.48 { return 700 }
            if w < 0.6 { return 800 }
            return 900
        }
        return CTFontGetSymbolicTraits(ctFont).contains(.traitBold) ? 700 : 400
    }
}

@MainActor
internal protocol SuperImgTimelineObserver: AnyObject {
    func timelinePlayerDidUpdate(didSeek: Bool, playbackChanged: Bool)
}

@MainActor
public final class SuperImgTimelinePlayer {
    public let artifact: SuperImgArtifact
    public var info: SuperImgArtifactInfo { artifact.info }
    public private(set) var currentSeconds: Double = 0
    public private(set) var isPlaying: Bool = false
    public private(set) var edition: String?
    public private(set) var dataPatchJSON: String?
    public private(set) var revision: UInt64 = 0

    private final class WeakObserver {
        weak var value: AnyObject?
        init(_ value: AnyObject) { self.value = value }
    }
    private var observers: [WeakObserver] = []

    public init(
        artifact: SuperImgArtifact,
        edition: String? = nil,
        dataPatchJSON: String? = nil
    ) {
        self.artifact = artifact
        self.edition = edition
        self.dataPatchJSON = dataPatchJSON
    }

    internal func addObserver(_ observer: SuperImgTimelineObserver) {
        observers.removeAll { $0.value == nil || $0.value === observer }
        observers.append(WeakObserver(observer))
    }

    internal func removeObserver(_ observer: SuperImgTimelineObserver) {
        observers.removeAll { $0.value == nil || $0.value === observer }
    }

    private func notifyObservers(didSeek: Bool = false, playbackChanged: Bool = false) {
        observers.removeAll { $0.value == nil }
        for entry in observers {
            (entry.value as? SuperImgTimelineObserver)?.timelinePlayerDidUpdate(
                didSeek: didSeek,
                playbackChanged: playbackChanged
            )
        }
    }

    internal func updatePlaybackClock(_ seconds: Double) {
        currentSeconds = clampSeconds(seconds)
    }

    public func play() {
        guard !isPlaying else { return }
        isPlaying = true
        notifyObservers(didSeek: false, playbackChanged: true)
    }

    public func pause() {
        guard isPlaying else { return }
        isPlaying = false
        notifyObservers(didSeek: false, playbackChanged: true)
    }

    public func seek(toSeconds seconds: Double) {
        guard seconds.isFinite else { return }
        currentSeconds = clampSeconds(seconds)
        revision &+= 1
        notifyObservers(didSeek: true, playbackChanged: false)
    }

    public func seek(toFrame frame: Int) {
        let maxFrame = max(0, info.totalFrames - 1)
        let clampedFrame = max(0, min(frame, maxFrame))
        let seconds = info.fps > 0 ? Double(clampedFrame) / info.fps : 0
        currentSeconds = clampSeconds(seconds)
        revision &+= 1
        notifyObservers(didSeek: true, playbackChanged: false)
    }

    public func setDataPatch(_ json: String?) {
        dataPatchJSON = json
        revision &+= 1
        notifyObservers(didSeek: false, playbackChanged: false)
    }

    public func setEdition(_ edition: String?) {
        self.edition = edition
        revision &+= 1
        notifyObservers(didSeek: false, playbackChanged: false)
    }

    public func sampleCurrentFrame(viewport: SuperImgViewport) async throws -> DisplayListFrame {
        try await sampleFrame(at: currentSeconds, viewport: viewport)
    }

    internal func sampleFrame(at seconds: Double, viewport: SuperImgViewport) async throws -> DisplayListFrame {
        let clamped = clampSeconds(seconds)
        let frameIndex: Int
        if info.fps > 0, info.totalFrames > 0 {
            frameIndex = max(0, min(info.totalFrames - 1, Int((clamped * info.fps).rounded())))
        } else {
            frameIndex = 0
        }
        let request = SuperImgSampleRequest(
            seconds: clamped,
            frame: frameIndex,
            width: viewport.width,
            height: viewport.height,
            scale: viewport.scale,
            safeArea: viewport.safeArea,
            reduceMotion: viewport.reduceMotion,
            edition: edition
        )
        return try await artifact.sample(request, dataPatchJSON: dataPatchJSON)
    }

    private func clampSeconds(_ seconds: Double) -> Double {
        let nonNegative = max(0, seconds)
        if info.durationSeconds > 0 {
            return min(nonNegative, info.durationSeconds)
        }
        return nonNegative
    }
}
