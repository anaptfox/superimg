#if canImport(UIKit)
import UIKit
import XCTest
@testable import SuperImg

final class CanvasTests: XCTestCase {
    @MainActor
    func testRevisionResizeSpriteFailureAndRetainedLayer() async throws {
        let scene = try await SuperImgScene<LaneState>.load("test-scene", in: .module)
        let player = SuperImgPlayer(scene: scene, state: LaneState(x: 10))
        let canvas = SuperImgCanvas(frame: CGRect(x: 0, y: 0, width: 100, height: 100))
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 320, height: 260))
        window.addSubview(canvas)
        defer { canvas.unmount(); canvas.removeFromSuperview() }
        let sprite = UIGraphicsImageRenderer(size: CGSize(width: 2, height: 2)).image { renderer in
            renderer.cgContext.setFillColor(UIColor.orange.cgColor)
            renderer.cgContext.fill(CGRect(x: 0, y: 0, width: 2, height: 2))
        }

        let presented = XCTestExpectation(description: "Latest state and size applied")
        var layer: CALayer?
        canvas.onFrameApplied = { frame in
            XCTAssertEqual(frame.revision, 2)
            XCTAssertEqual(frame.seconds, 2)
            XCTAssertEqual(frame.viewport.size, CGSize(width: 200, height: 100))
            XCTAssertEqual(frame.anchor(entity: "nell", named: "talk")?.x, 90)
            layer = canvas.layer.sublayers?.first?.sublayers?.last
            XCTAssertEqual(layer?.magnificationFilter, .nearest)
            XCTAssertNotNil(layer?.contents)
            presented.fulfill()
        }
        canvas.mount(player, sprites: ["nell": .init(image: try XCTUnwrap(sprite.cgImage), pixelArt: true)])
        player.update(LaneState(x: 20))
        player.update(LaneState(x: 30))
        canvas.frame.size.width = 200
        canvas.layoutIfNeeded()
        canvas.requestFrame(at: 2)
        let firstResult = await XCTWaiter.fulfillment(of: [presented], timeout: 5)
        XCTAssertEqual(firstResult, .completed)

        let failed = XCTestExpectation(description: "Unknown sprite refused before mutating layers")
        canvas.onFrameApplied = { _ in XCTFail("Missing sprite must leave last accepted frame") }
        canvas.onError = { error in
            guard case SuperImgError.missingAsset("missing") = error else {
                XCTFail("Unexpected error \(error)")
                failed.fulfill()
                return
            }
            XCTAssertTrue(canvas.layer.sublayers?.first?.sublayers?.last === layer)
            failed.fulfill()
        }
        player.update(LaneState(x: 40, asset: "missing"))
        let failedResult = await XCTWaiter.fulfillment(of: [failed], timeout: 5)
        XCTAssertEqual(failedResult, .completed)

        let recovered = XCTestExpectation(description: "Reuses sprite layer for subsequent state")
        canvas.onFrameApplied = { frame in
            XCTAssertEqual(frame.revision, 4)
            XCTAssertEqual(frame.anchor(entity: "nell", named: "talk")?.x, 110)
            XCTAssertTrue(canvas.layer.sublayers?.first?.sublayers?.last === layer)
            recovered.fulfill()
        }
        player.update(LaneState(x: 50))
        let recoveredResult = await XCTWaiter.fulfillment(of: [recovered], timeout: 5)
        XCTAssertEqual(recoveredResult, .completed)
    }
}
#endif
