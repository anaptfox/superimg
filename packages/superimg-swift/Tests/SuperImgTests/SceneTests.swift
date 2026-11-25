import XCTest
@testable import SuperImg

struct LaneState: Encodable, Sendable {
    let x: Double
    var asset = "nell"
}

final class SceneTests: XCTestCase {
    func testBundleSampleSeekAndRecoverFromError() async throws {
        let scene = try await SuperImgScene<LaneState>.load("test-scene", in: .module)
        let viewport = SuperImgViewport(width: 200, height: 100, reduceMotion: true)
        let state = LaneState(x: 20)
        let first = try await scene.sample(at: 5, viewport: viewport, state: state)
        XCTAssertEqual(first.draw.map(\.id), ["ground", "nell"])
        XCTAssertEqual(first.draw[1].asset, "nell")
        XCTAssertEqual(first.anchors.first?.x, 33)
        XCTAssertEqual(first.anchors.first?.y, 30)

        let earlier = try await scene.sample(at: 1, viewport: viewport, state: LaneState(x: 40))
        XCTAssertEqual(earlier.anchors.first?.x, 49)

        do {
            _ = try await scene.sample(at: 1, viewport: viewport, state: LaneState(x: -1))
            XCTFail("Expected evaluation error")
        } catch SuperImgError.evaluation(let message) {
            XCTAssertTrue(message.contains("invalid position"))
        }

        let replay = try await scene.sample(at: 5, viewport: viewport, state: state)
        XCTAssertEqual(replay.anchors.first?.x, first.anchors.first?.x)
    }

    func testInputsWithSameSceneKeepSnapshotIdentity() async throws {
        let scene = try await SuperImgScene<LaneState>.load("test-scene", in: .module)
        let viewport = SuperImgViewport(width: 100, height: 100)
        let firstID = UUID()
        let first = try await scene.sample(at: 0, viewport: viewport, state: LaneState(x: 10), inputID: firstID)
        let second = try await scene.sample(at: 0, viewport: viewport, state: LaneState(x: 40), inputID: UUID())
        let replay = try await scene.sample(at: 0, viewport: viewport, state: LaneState(x: 10), inputID: firstID)
        XCTAssertEqual(first.anchors.first?.x, 18)
        XCTAssertEqual(second.anchors.first?.x, 48)
        XCTAssertEqual(replay.anchors.first?.x, 18)
    }
}
