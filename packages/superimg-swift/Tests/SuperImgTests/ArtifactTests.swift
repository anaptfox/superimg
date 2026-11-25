import CoreGraphics
import CryptoKit
import Foundation
import ImageIO
import UniformTypeIdentifiers
import XCTest
@testable import SuperImg

final class ArtifactTests: XCTestCase {
    private func make2x2PNGData() throws -> Data {
        let cs = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
        guard let ctx = CGContext(
            data: nil,
            width: 2,
            height: 2,
            bitsPerComponent: 8,
            bytesPerRow: 8,
            space: cs,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            throw SuperImgError.invalidFrame("Could not create 2x2 bitmap context")
        }
        ctx.setFillColor(CGColor(colorSpace: cs, components: [0.1, 0.8, 0.2, 1.0])!)
        ctx.fill(CGRect(x: 0, y: 0, width: 2, height: 2))
        let image = try XCTUnwrap(ctx.makeImage())
        let data = NSMutableData()
        let dest = try XCTUnwrap(CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil))
        CGImageDestinationAddImage(dest, image, nil)
        XCTAssertTrue(CGImageDestinationFinalize(dest))
        return data as Data
    }

    private func sha256Hex(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    private func writeArtifactFixture(
        to dir: URL,
        tamperAssetHash: Bool = false,
        injectTraversalPath: Bool = false
    ) throws {
        let fm = FileManager.default
        try fm.createDirectory(at: dir.appendingPathComponent("assets"), withIntermediateDirectories: true)

        let pngData = try make2x2PNGData()
        let assetRelPath = "assets/logo.png"
        try pngData.write(to: dir.appendingPathComponent(assetRelPath))

        let mediaObj: [String: Any] = [
            "kind": "@foxworth/superimg/media-ir",
            "schemaVersion": 0,
            "identity": [
                "sourceId": "test-card",
                "variantId": "default",
                "editionId": "default",
            ],
            "medium": "html",
            "animated": true,
            "canvas": [
                "width": 120,
                "height": 80,
            ],
            "clock": [
                "fps": 24,
                "durationSeconds": 2.0,
                "totalFrames": 48,
            ],
            "editions": [
                "square": ["size": ["width": 80, "height": 80]],
            ],
        ]
        let mediaData = try JSONSerialization.data(withJSONObject: mediaObj, options: [.sortedKeys])
        try mediaData.write(to: dir.appendingPathComponent("media.json"))

        let jobObj: [String: Any] = [
            "schemaVersion": 0,
            "coordinates": [
                "sourceId": "test-card",
                "variantId": "default",
                "editionId": "default",
            ],
            "data": ["title": "Default Title"],
            "width": 120,
            "height": 80,
            "fps": 24,
            "durationSeconds": 2.0,
            "totalFrames": 48,
            "medium": "html",
            "animated": true,
            "fonts": [],
            "inlineCss": [],
            "stylesheets": [],
            "tailwind": false,
            "background": "#0f172a",
            "watermark": NSNull(),
            "readiness": NSNull(),
            "audio": NSNull(),
            "assetMap": [
                "logo.png": assetRelPath,
            ],
            "resolvedAssets": [
                [
                    "key": "logo",
                    "type": "image",
                    "src": assetRelPath,
                ],
            ],
            "mode": "animation",
        ]
        let jobData = try JSONSerialization.data(withJSONObject: jobObj, options: [.sortedKeys])
        try jobData.write(to: dir.appendingPathComponent("job.json"))

        let programSource = "// bundled test program\nvar __template = { default: { kind: 'media' } };\n"
        let programData = Data(programSource.utf8)
        try programData.write(to: dir.appendingPathComponent("program.mjs"))

        var fileEntries: [[String: Any]] = [
            [
                "path": "media.json",
                "sha256": sha256Hex(mediaData),
                "bytes": mediaData.count,
            ],
            [
                "path": "program.mjs",
                "sha256": sha256Hex(programData),
                "bytes": programData.count,
            ],
            [
                "path": "job.json",
                "sha256": sha256Hex(jobData),
                "bytes": jobData.count,
            ],
            [
                "path": assetRelPath,
                "sha256": tamperAssetHash ? String(repeating: "0", count: 64) : sha256Hex(pngData),
                "bytes": pngData.count,
            ],
        ]
        if injectTraversalPath {
            fileEntries.append([
                "path": "../escape.txt",
                "sha256": sha256Hex(Data("nope".utf8)),
                "bytes": 4,
            ])
        }

        let manifest: [String: Any] = [
            "kind": "@foxworth/superimg/artifact",
            "schemaVersion": 0,
            "artifactHash": sha256Hex(Data("test".utf8)),
            "files": fileEntries,
            "runtime": [
                "requiresNetwork": false,
                "medium": "html",
                "animated": true,
            ],
            "identity": [
                "sourceId": "test-card",
                "variantId": "default",
                "editionId": "default",
            ],
        ]
        let manifestData = try JSONSerialization.data(withJSONObject: manifest, options: [.sortedKeys])
        try manifestData.write(to: dir.appendingPathComponent("artifact.json"))
    }

    private static let mockRuntimeJS = """
    globalThis.__superimgNative = (function() {
      const sessions = new Map();
      let nextId = 0;
      return {
        loadArtifact(payload) {
          if (!payload || typeof payload.programCode !== 'string') {
            throw new Error('Missing programCode');
          }
          const id = 'art-' + (++nextId);
          sessions.set(id, payload);
          // Deliberately omit width/height/fps/durationSeconds/totalFrames to test media.json fallback,
          // and return editions as an object map matching real jsc-runtime.ts.
          return {
            id,
            animated: true,
            editions: { square: { size: { width: 80, height: 80 } } }
          };
        },
        sampleArtifact(id, req) {
          const session = sessions.get(id);
          if (!session) throw new Error('Unknown artifact: ' + id);
          const isSquare = req && req.edition === 'square';
          const w = (req && req.width) || (isSquare ? 80 : Number(session.job.width));
          const h = (req && req.height) || (isSquare ? 80 : Number(session.job.height));
          const title = (req && req.data && req.data.title) || session.job.data.title || 'Untitled';
          const sec = (req && typeof req.seconds === 'number') ? req.seconds : 0;
          const x = Math.round(sec * 10);
          return {
            kind: '@foxworth/superimg/display-list',
            schemaVersion: 1,
            width: w,
            height: h,
            ops: [
              {
                id: 'bg',
                kind: 'rect',
                bounds: { x: 0, y: 0, width: w, height: h },
                opacity: 1,
                fill: { kind: 'solid', color: '#0f172a' }
              },
              {
                id: 'logo',
                kind: 'image',
                bounds: { x: 8 + x, y: 8, width: 16, height: 16 },
                opacity: 1,
                asset: 'logo.png',
                fit: 'contain',
                pixelArt: true
              },
              {
                id: 'headline',
                kind: 'text',
                bounds: { x: 8, y: 32, width: w - 16, height: 24 },
                opacity: 1,
                lines: [{ text: title, x: 8, y: 32, baselineY: 46, width: 80 }],
                fontFamily: 'Helvetica, sans-serif',
                fontSize: 14,
                fontWeight: 700,
                fontStyle: 'normal',
                align: 'left',
                color: '#ffffff',
                metricsExact: false
              }
            ],
            anchors: [
              { entity: 'logo', name: 'origin', x: 8 + x, y: 8 }
            ],
            issues: []
          };
        },
        disposeArtifact(id) {
          sessions.delete(id);
        }
      };
    })();
    """

    func testLoadSampleDataPatchAssetAliasesAndTimelinePlayer() async throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("superimg-artifact-\(UUID().uuidString).superimg")
        try writeArtifactFixture(to: dir)
        defer { try? FileManager.default.removeItem(at: dir) }

        let artifact = try await SuperImgArtifact.load(directory: dir, runtimeSource: Self.mockRuntimeJS)

        // Verify metadata and media.json canvas/clock fallbacks
        XCTAssertEqual(artifact.info.id, "art-1")
        XCTAssertEqual(artifact.info.width, 120)
        XCTAssertEqual(artifact.info.height, 80)
        XCTAssertEqual(artifact.info.fps, 24)
        XCTAssertEqual(artifact.info.durationSeconds, 2.0)
        XCTAssertEqual(artifact.info.totalFrames, 48)
        XCTAssertTrue(artifact.info.animated)
        XCTAssertEqual(artifact.info.editions, ["square"])

        // Verify asset keyed under relative path, assetMap alias, and resolvedAssets key
        XCTAssertNotNil(artifact.assets["assets/logo.png"])
        XCTAssertNotNil(artifact.assets["logo.png"])
        XCTAssertNotNil(artifact.assets["logo"])

        // Verify sampling and dataPatchJSON ("data" key)
        let defaultFrame = try await artifact.sample(.init(seconds: 0.5, frame: 12))
        XCTAssertEqual(defaultFrame.ops.last?.lines?.first?.text, "Default Title")
        XCTAssertEqual(defaultFrame.anchors.first?.x, 13)

        let patchedFrame = try await artifact.sample(
            .init(seconds: 1.0, frame: 24, edition: "square"),
            dataPatchJSON: #"{"title":"Patched's \"Quote\"\nLine"}"#
        )
        XCTAssertEqual(patchedFrame.width, 80)
        XCTAssertEqual(patchedFrame.height, 80)
        XCTAssertEqual(patchedFrame.ops.last?.lines?.first?.text, "Patched's \"Quote\"\nLine")
        XCTAssertEqual(patchedFrame.anchors.first?.x, 18)

        let png = try await artifact.renderPNG(.init(seconds: 0.0, frame: 0))
        XCTAssertTrue(png.starts(with: [0x89, 0x50, 0x4E, 0x47]))

        // Verify SuperImgTimelinePlayer on MainActor
        await MainActor.run {
            let player = SuperImgTimelinePlayer(artifact: artifact)
            XCTAssertEqual(player.revision, 0)
            XCTAssertEqual(player.currentSeconds, 0)
            XCTAssertFalse(player.isPlaying)

            player.play()
            XCTAssertTrue(player.isPlaying)
            player.pause()
            XCTAssertFalse(player.isPlaying)

            player.seek(toSeconds: 1.0)
            XCTAssertEqual(player.currentSeconds, 1.0)
            XCTAssertEqual(player.revision, 1)

            player.seek(toFrame: 12)
            XCTAssertEqual(player.currentSeconds, 0.5, accuracy: 0.0001)
            XCTAssertEqual(player.revision, 2)

            player.setDataPatch(#"{"title":"Player Title"}"#)
            XCTAssertEqual(player.dataPatchJSON, #"{"title":"Player Title"}"#)
            XCTAssertEqual(player.revision, 3)

            player.setEdition("square")
            XCTAssertEqual(player.edition, "square")
            XCTAssertEqual(player.revision, 4)
        }

        let player = await MainActor.run {
            let p = SuperImgTimelinePlayer(artifact: artifact, edition: "square", dataPatchJSON: #"{"title":"Timeline"}"#)
            p.seek(toSeconds: 1.0)
            return p
        }
        let sampled = try await player.sampleCurrentFrame(viewport: SuperImgViewport(width: 80, height: 80, scale: 2))
        XCTAssertEqual(sampled.width, 80)
        XCTAssertEqual(sampled.ops.last?.lines?.first?.text, "Timeline")
        XCTAssertEqual(sampled.anchors.first?.x, 18)

        await artifact.dispose()
    }

    func testTamperedSHA256FailsWithInvalidFrame() async throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("superimg-tamper-\(UUID().uuidString).superimg")
        try writeArtifactFixture(to: dir, tamperAssetHash: true)
        defer { try? FileManager.default.removeItem(at: dir) }

        do {
            _ = try await SuperImgArtifact.load(directory: dir, runtimeSource: Self.mockRuntimeJS)
            XCTFail("Expected SuperImgError.invalidFrame for tampered SHA-256")
        } catch SuperImgError.invalidFrame {
            // Expected
        }
    }

    func testPathTraversalFailsWithInvalidFrame() async throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("superimg-traversal-\(UUID().uuidString).superimg")
        try writeArtifactFixture(to: dir, injectTraversalPath: true)
        defer { try? FileManager.default.removeItem(at: dir) }

        do {
            _ = try await SuperImgArtifact.load(directory: dir, runtimeSource: Self.mockRuntimeJS)
            XCTFail("Expected SuperImgError.invalidFrame for .. path traversal")
        } catch SuperImgError.invalidFrame {
            // Expected
        }
    }

    #if canImport(AppKit) && !targetEnvironment(macCatalyst)
    @MainActor
    func testMacCanvasMountsTimelinePlayerAndRendersFrame() async throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("superimg-maccanvas-\(UUID().uuidString).superimg")
        try writeArtifactFixture(to: dir)
        defer { try? FileManager.default.removeItem(at: dir) }

        let artifact = try await SuperImgArtifact.load(directory: dir, runtimeSource: Self.mockRuntimeJS)
        let player = SuperImgTimelinePlayer(artifact: artifact)
        let canvas = SuperImgMacCanvas(frame: CGRect(x: 0, y: 0, width: 240, height: 160))
        defer { canvas.unmount() }

        let applied = XCTestExpectation(description: "MacCanvas renders DisplayListFrame")
        canvas.onError = { error in XCTFail("Unexpected canvas error: \(error)") }
        canvas.onFrameApplied = { frame in
            XCTAssertEqual(frame.seconds, 1.0, accuracy: 0.001)
            XCTAssertEqual(frame.revision, 1)
            XCTAssertEqual(frame.viewport.size, CGSize(width: 240, height: 160))
            XCTAssertNotNil(canvas.layer?.sublayers?.first?.contents)
            XCTAssertEqual(canvas.benchmark.frames.count, 1)
            applied.fulfill()
        }

        player.seek(toSeconds: 1.0)
        canvas.mount(player)

        let result = await XCTWaiter.fulfillment(of: [applied], timeout: 5)
        XCTAssertEqual(result, .completed)

        // Also test automatic playback ticks and anchor projection
        let tickApplied = XCTestExpectation(description: "MacCanvas automatic playback ticks")
        tickApplied.assertForOverFulfill = false
        canvas.onFrameApplied = { _ in tickApplied.fulfill() }
        canvas.playback = .automatic(framesPerSecond: 30)
        let tickResult = await XCTWaiter.fulfillment(of: [tickApplied], timeout: 5)
        XCTAssertEqual(tickResult, .completed)
        canvas.playback = .onDemand

        // Also test mounting SuperImgScene<LaneState> on SuperImgMacCanvas
        let scene = try await SuperImgScene<LaneState>.load("test-scene", in: .module)
        let sceneApplied = XCTestExpectation(description: "MacCanvas mounts SuperImgScene")
        canvas.onFrameApplied = { frame in
            XCTAssertEqual(frame.seconds, 2.0, accuracy: 0.001)
            XCTAssertNotNil(frame.anchor(entity: "nell", named: "talk"))
            sceneApplied.fulfill()
        }
        let spriteData = try make2x2PNGData()
        let spriteSrc = try XCTUnwrap(CGImageSourceCreateWithData(spriteData as CFData, nil))
        let spriteImage = try XCTUnwrap(CGImageSourceCreateImageAtIndex(spriteSrc, 0, nil))
        canvas.mount(scene, state: LaneState(x: 20), assets: ["nell": SuperImgImageAsset(image: spriteImage, pixelArt: true)])
        canvas.requestFrame(at: 2.0)
        let sceneResult = await XCTWaiter.fulfillment(of: [sceneApplied], timeout: 5)
        XCTAssertEqual(sceneResult, .completed)

        #if canImport(SwiftUI)
        _ = SuperImgMacSurface(player: player, playback: .onDemand)
        #endif

        await artifact.dispose()
    }
    #endif
}
