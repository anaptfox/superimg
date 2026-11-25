import AVFoundation
import CoreGraphics
import Foundation
import XCTest
@testable import SuperImg

final class CrossOSEndToEndTests: XCTestCase {
    private struct V8Snapshots: Decodable {
        let enter: DisplayListFrame
        let hold: DisplayListFrame
        let exit: DisplayListFrame
    }

    func testRealHelloWorldArtifactMatchesNodeV8AndExportsPNGAndMP4() async throws {
        let fixtureRoot = try XCTUnwrap(
            Bundle.module.url(forResource: "ArtifactFixtures", withExtension: nil),
            "Missing ArtifactFixtures test resource bundle"
        )
        let envArtifact = ProcessInfo.processInfo.environment["SUPERIMG_CONFORMANCE_ARTIFACT"]
        let artifactURL = envArtifact.map { URL(fileURLWithPath: $0) }
            ?? fixtureRoot.appendingPathComponent("hello-world.superimg", isDirectory: true)
        let expectedURL = fixtureRoot.appendingPathComponent("hello-world-v8.json")
        let expected = try JSONDecoder().decode(V8Snapshots.self, from: Data(contentsOf: expectedURL))

        // Load real compiled .superimg/ using the embedded Bundle.module superimg-jsc-runtime.js!
        let artifact = try await SuperImgArtifact.load(directory: artifactURL)
        defer { Task { await artifact.dispose() } }

        XCTAssertEqual(artifact.info.width, 1920)
        XCTAssertEqual(artifact.info.height, 1080)
        XCTAssertEqual(artifact.info.fps, 30)
        XCTAssertEqual(artifact.info.totalFrames, 165)
        XCTAssertTrue(artifact.info.animated)

        let patch = #"{"title":"Cross-OS Parity"}"#
        let enter = try await artifact.sample(.init(seconds: 0.4), dataPatchJSON: patch)
        let hold = try await artifact.sample(.init(seconds: 2.5), dataPatchJSON: patch)
        let exit = try await artifact.sample(.init(seconds: 5.2), dataPatchJSON: patch)

        // Exact cross-OS parity: JavaScriptCore == Node V8!
        XCTAssertEqual(enter, expected.enter, "JavaScriptCore enter frame must match Node V8")
        XCTAssertEqual(hold, expected.hold, "JavaScriptCore hold frame must match Node V8")
        XCTAssertEqual(exit, expected.exit, "JavaScriptCore exit frame must match Node V8")

        // Verify live data override & multiply blend mode
        let titleOp = try XCTUnwrap(hold.ops.first(where: { $0.id == "title" }))
        XCTAssertEqual(titleOp.lines?.map(\.text).joined(separator: " "), "Cross-OS Parity")
        let coolBar = try XCTUnwrap(hold.ops.first(where: { $0.id == "ink-cool" }))
        XCTAssertEqual(coolBar.blendMode, .multiply)

        // Render real 1920x1080 PNG on Apple CoreGraphics + CoreText
        let t0 = CFAbsoluteTimeGetCurrent()
        let img = try SuperImgGraphicsRenderer.render(hold, assets: artifact.assets, scale: 1)
        let renderMs = (CFAbsoluteTimeGetCurrent() - t0) * 1000
        XCTAssertEqual(img.width, 1920)
        XCTAssertEqual(img.height, 1080)

        // Check top-left riso paper pixel (#F1EBE1 -> 241, 235, 225)
        var px = [UInt8](repeating: 0, count: 4)
        let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
        let probeCtx = CGContext(
            data: &px, width: 1, height: 1, bitsPerComponent: 8, bytesPerRow: 4,
            space: srgb, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        )!
        probeCtx.draw(img, in: CGRect(x: -4, y: -(img.height - 1 - 4), width: img.width, height: img.height))
        XCTAssertEqual(px[0], 0xF1)
        XCTAssertEqual(px[1], 0xEB)
        XCTAssertEqual(px[2], 0xE1)

        // Benchmark 10 frames of real sampling + scaled rendering
        var benchmark = SuperImgBenchmark()
        for i in 0..<10 {
            let s0 = CFAbsoluteTimeGetCurrent()
            let frame = try await artifact.sample(.init(frame: i * 15, width: 960, height: 540), dataPatchJSON: patch)
            let sMs = (CFAbsoluteTimeGetCurrent() - s0) * 1000
            let r0 = CFAbsoluteTimeGetCurrent()
            _ = try SuperImgGraphicsRenderer.render(frame, assets: artifact.assets, scale: 1)
            let rMs = (CFAbsoluteTimeGetCurrent() - r0) * 1000
            benchmark.record(sampleMilliseconds: sMs, renderMilliseconds: rMs)
        }
        XCTAssertEqual(benchmark.frames.count, 10)
        XCTAssertLessThan(renderMs, 5000)

        // Export real H.264 MP4 directly from hello-world.superimg via AVAssetWriter
        let mp4URL = FileManager.default.temporaryDirectory
            .appendingPathComponent("superimg-cross-os-\(UUID().uuidString).mp4")
        defer { try? FileManager.default.removeItem(at: mp4URL) }

        let exported = try await SuperImgExporter.exportMP4(
            to: mp4URL,
            frameCount: 10,
            options: .init(width: 480, height: 270, fps: 30, codec: .h264),
            assets: artifact.assets
        ) { index, seconds in
            try await artifact.sample(
                .init(seconds: seconds, frame: index * 10, width: 480, height: 270),
                dataPatchJSON: patch
            )
        }
        XCTAssertTrue(FileManager.default.fileExists(atPath: exported.path))
        let avAsset = AVURLAsset(url: exported)
        let tracks = try await avAsset.loadTracks(withMediaType: .video)
        XCTAssertEqual(tracks.count, 1)
        let size = try await tracks[0].load(.naturalSize)
        XCTAssertEqual(size, CGSize(width: 480, height: 270))
        let duration = try await avAsset.load(.duration)
        XCTAssertGreaterThan(CMTimeGetSeconds(duration), 0.25)
    }
}
