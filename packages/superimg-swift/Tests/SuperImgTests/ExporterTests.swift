import AVFoundation
import CoreGraphics
import Foundation
import XCTest
@testable import SuperImg

final class ExporterTests: XCTestCase {
    func testExportMP4ProducesValidTrackDimensionsAndDuration() async throws {
        let outputURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("superimg-export-\(UUID().uuidString).mp4")
        defer { try? FileManager.default.removeItem(at: outputURL) }

        let options = SuperImgExportOptions(
            width: 64,
            height: 48,
            fps: 24,
            codec: .h264,
            scale: 1
        )
        let frameCount = 12

        let exportedURL = try await SuperImgExporter.exportMP4(
            to: outputURL,
            frameCount: frameCount,
            options: options
        ) { index, seconds in
            let progress = Double(index) / Double(max(1, frameCount - 1))
            let boxX = 4.0 + progress * 36.0
            let frame = DisplayListFrame(
                kind: "@foxworth/superimg/display-list",
                schemaVersion: 1,
                width: 64,
                height: 48,
                ops: [
                    DisplayOp(
                        id: "bg",
                        kind: .rect,
                        bounds: .init(x: 0, y: 0, width: 64, height: 48),
                        matrix: nil,
                        opacity: 1,
                        blendMode: nil,
                        clips: nil,
                        fill: .solid(color: "#111827"),
                        stroke: nil,
                        radius: nil,
                        d: nil,
                        fillRule: nil,
                        asset: nil,
                        fit: nil,
                        pixelArt: nil,
                        lines: nil,
                        fontFamily: nil,
                        fontSize: nil,
                        fontWeight: nil,
                        fontStyle: nil,
                        letterSpacing: nil,
                        lineHeight: nil,
                        align: nil,
                        color: nil,
                        metricsExact: nil
                    ),
                    DisplayOp(
                        id: "mover",
                        kind: .rect,
                        bounds: .init(x: boxX, y: 14, width: 20, height: 20),
                        matrix: nil,
                        opacity: 1,
                        blendMode: nil,
                        clips: nil,
                        fill: .solid(color: seconds >= 0.25 ? "#22c55e" : "#38bdf8"),
                        stroke: nil,
                        radius: 4,
                        d: nil,
                        fillRule: nil,
                        asset: nil,
                        fit: nil,
                        pixelArt: nil,
                        lines: nil,
                        fontFamily: nil,
                        fontSize: nil,
                        fontWeight: nil,
                        fontStyle: nil,
                        letterSpacing: nil,
                        lineHeight: nil,
                        align: nil,
                        color: nil,
                        metricsExact: nil
                    ),
                ],
                anchors: [],
                issues: []
            )
            try frame.validate()
            return frame
        }

        XCTAssertEqual(exportedURL, outputURL)
        XCTAssertTrue(FileManager.default.fileExists(atPath: outputURL.path))

        let asset = AVURLAsset(url: outputURL)
        let videoTracks = try await asset.loadTracks(withMediaType: .video)
        XCTAssertEqual(videoTracks.count, 1)

        let track = try XCTUnwrap(videoTracks.first)
        let naturalSize = try await track.load(.naturalSize)
        XCTAssertEqual(naturalSize, CGSize(width: 64, height: 48))

        let duration = try await asset.load(.duration)
        XCTAssertEqual(CMTimeGetSeconds(duration), 0.5, accuracy: 0.1)
    }
}
