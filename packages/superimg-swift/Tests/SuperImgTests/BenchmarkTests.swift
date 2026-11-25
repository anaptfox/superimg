import CoreGraphics
import Foundation
import XCTest
@testable import SuperImg

final class BenchmarkTests: XCTestCase {
    func testBenchmarkPercentilesAndDroppedFrameBudget() {
        var benchmark = SuperImgBenchmark()
        let samples: [(Double, Double)] = [
            (1.0, 2.0),   // 3.0 ms
            (1.5, 3.5),   // 5.0 ms
            (2.0, 5.0),   // 7.0 ms
            (3.0, 6.0),   // 9.0 ms  -> exceeds 120fps (8.33ms)
            (4.0, 14.0),  // 18.0 ms -> exceeds 60fps (16.67ms) & 120fps
        ]
        for (sample, render) in samples {
            benchmark.record(sampleMilliseconds: sample, renderMilliseconds: render)
        }
        // Negative / non-finite readings are ignored
        benchmark.record(sampleMilliseconds: -1, renderMilliseconds: 2)
        benchmark.record(sampleMilliseconds: .nan, renderMilliseconds: 2)

        XCTAssertEqual(benchmark.frames.count, 5)
        XCTAssertEqual(benchmark.p50Milliseconds, 7.0, accuracy: 0.001)
        XCTAssertEqual(benchmark.p95Milliseconds, 18.0, accuracy: 0.001)
        XCTAssertEqual(benchmark.maxMilliseconds, 18.0, accuracy: 0.001)
        XCTAssertEqual(benchmark.droppedFrameBudget(at: 60), 1)
        XCTAssertEqual(benchmark.droppedFrameBudget(at: 120), 2)
    }

    func testThirtyFrameRenderBenchmarkThroughGraphicsRenderer() throws {
        var benchmark = SuperImgBenchmark()
        let frameCount = 30

        for i in 0..<frameCount {
            let t = Double(i) / Double(frameCount)
            let frame = DisplayListFrame(
                kind: "@foxworth/superimg/display-list",
                schemaVersion: 1,
                width: 320,
                height: 180,
                ops: [
                    DisplayOp(
                        id: "backdrop",
                        kind: .rect,
                        bounds: .init(x: 0, y: 0, width: 320, height: 180),
                        matrix: nil,
                        opacity: 1,
                        blendMode: nil,
                        clips: nil,
                        fill: .linearGradient(
                            x1: 0, y1: 0, x2: 1, y2: 1,
                            stops: [
                                .init(color: "#0f172a", offset: 0),
                                .init(color: "#1e293b", offset: 1),
                            ]
                        ),
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
                        id: "orb",
                        kind: .ellipse,
                        bounds: .init(x: 20 + t * 220, y: 50, width: 60, height: 60),
                        matrix: nil,
                        opacity: 0.9,
                        blendMode: .screen,
                        clips: nil,
                        fill: .radialGradient(
                            cx: 0.5, cy: 0.5, r: 0.5,
                            stops: [
                                .init(color: "#38bdf8ff", offset: 0),
                                .init(color: "#38bdf800", offset: 1),
                            ]
                        ),
                        stroke: .init(color: "#e0f2fe", width: 2, lineCap: "round", lineJoin: "round", dashArray: nil, dashOffset: nil),
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
                        id: "label",
                        kind: .text,
                        bounds: .init(x: 20, y: 120, width: 280, height: 32),
                        matrix: nil,
                        opacity: 1,
                        blendMode: nil,
                        clips: nil,
                        fill: nil,
                        stroke: nil,
                        radius: nil,
                        d: nil,
                        fillRule: nil,
                        asset: nil,
                        fit: nil,
                        pixelArt: nil,
                        lines: [.init(text: "Frame \(i)", x: 20, y: 120, baselineY: 140, width: 100)],
                        fontFamily: "Helvetica, sans-serif",
                        fontSize: 18,
                        fontWeight: 600,
                        fontStyle: "normal",
                        letterSpacing: 0.5,
                        lineHeight: 1.2,
                        align: "left",
                        color: "#f8fafc",
                        metricsExact: false
                    ),
                ],
                anchors: [],
                issues: []
            )

            let start = ContinuousClock.now
            let image = try SuperImgGraphicsRenderer.render(frame, scale: 2)
            let elapsed = start.duration(to: .now).components
            let renderMs = Double(elapsed.seconds) * 1000.0 + Double(elapsed.attoseconds) / 1e15

            XCTAssertEqual(image.width, 640)
            XCTAssertEqual(image.height, 360)
            benchmark.record(sampleMilliseconds: 0.25, renderMilliseconds: renderMs)
        }

        XCTAssertEqual(benchmark.frames.count, frameCount)
        XCTAssertGreaterThan(benchmark.p50Milliseconds, 0)
        XCTAssertGreaterThanOrEqual(benchmark.p95Milliseconds, benchmark.p50Milliseconds)
        XCTAssertGreaterThanOrEqual(benchmark.maxMilliseconds, benchmark.p95Milliseconds)
        XCTAssertGreaterThanOrEqual(benchmark.droppedFrameBudget(at: 60), 0)
        XCTAssertGreaterThanOrEqual(benchmark.droppedFrameBudget(at: 120), benchmark.droppedFrameBudget(at: 60))
    }
}
