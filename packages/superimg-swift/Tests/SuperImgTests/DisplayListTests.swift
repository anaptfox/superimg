import CoreGraphics
import Foundation
import XCTest
@testable import SuperImg

final class DisplayListTests: XCTestCase {
    private func pixelRGBA(in image: CGImage, x: Int, y: Int) -> (UInt8, UInt8, UInt8, UInt8) {
        var pixel = [UInt8](repeating: 0, count: 4)
        let cs = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
        let ctx = CGContext(
            data: &pixel,
            width: 1,
            height: 1,
            bitsPerComponent: 8,
            bytesPerRow: 4,
            space: cs,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        )!
        ctx.draw(image, in: CGRect(x: -x, y: -(image.height - 1 - y), width: image.width, height: image.height))
        return (pixel[0], pixel[1], pixel[2], pixel[3])
    }

    func testRenderSolidMultiplyGradientClipPathImageAndText() throws {
        let cs = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
        let spriteCtx = CGContext(
            data: nil,
            width: 2,
            height: 2,
            bitsPerComponent: 8,
            bytesPerRow: 8,
            space: cs,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        )!
        spriteCtx.setFillColor(CGColor(colorSpace: cs, components: [0, 1, 0, 1])!)
        spriteCtx.fill(CGRect(x: 0, y: 0, width: 2, height: 2))
        let spriteImage = try XCTUnwrap(spriteCtx.makeImage())

        let json = """
        {
          "kind": "@foxworth/superimg/display-list",
          "schemaVersion": 1,
          "width": 64,
          "height": 48,
          "ops": [
            {
              "id": "base",
              "kind": "rect",
              "bounds": { "x": 0, "y": 0, "width": 64, "height": 48 },
              "opacity": 1,
              "fill": { "kind": "solid", "color": "#ffffff" }
            },
            {
              "id": "red",
              "kind": "rect",
              "bounds": { "x": 4, "y": 4, "width": 16, "height": 16 },
              "opacity": 1,
              "fill": { "kind": "solid", "color": "#ff0000" }
            },
            {
              "id": "blue-multiply",
              "kind": "rect",
              "bounds": { "x": 12, "y": 4, "width": 16, "height": 16 },
              "opacity": 1,
              "blendMode": "multiply",
              "fill": { "kind": "solid", "color": "#0000ff" }
            },
            {
              "id": "clipped-grad",
              "kind": "rect",
              "bounds": { "x": 32, "y": 4, "width": 24, "height": 16 },
              "opacity": 1,
              "clips": [{ "x": 32, "y": 4, "width": 12, "height": 16 }],
              "fill": {
                "kind": "linearGradient",
                "x1": 0, "y1": 0, "x2": 1, "y2": 0,
                "stops": [
                  { "color": "#000000", "offset": 0 },
                  { "color": "#ffffff", "offset": 1 }
                ]
              }
            },
            {
              "id": "sprite",
              "kind": "image",
              "bounds": { "x": 4, "y": 26, "width": 12, "height": 12 },
              "opacity": 1,
              "asset": "green-tile",
              "fit": "fill",
              "pixelArt": true
            },
            {
              "id": "tri",
              "kind": "path",
              "bounds": { "x": 20, "y": 26, "width": 12, "height": 12 },
              "opacity": 1,
              "d": "M 20 26 L 32 26 L 26 38 Z",
              "fill": { "kind": "solid", "color": "#224488" }
            },
            {
              "id": "label",
              "kind": "text",
              "bounds": { "x": 36, "y": 24, "width": 26, "height": 16 },
              "opacity": 1,
              "lines": [{ "text": "Hi", "x": 36, "y": 24, "baselineY": 36, "width": 20 }],
              "fontFamily": "Helvetica, sans-serif",
              "fontSize": 14,
              "fontWeight": 700,
              "fontStyle": "normal",
              "lineHeight": 1.2,
              "align": "left",
              "color": "#111111",
              "metricsExact": false
            }
          ],
          "anchors": [{ "entity": "hero", "name": "top", "x": 32, "y": 8 }],
          "issues": []
        }
        """

        let frame = try JSONDecoder().decode(DisplayListFrame.self, from: Data(json.utf8))
        let img = try SuperImgGraphicsRenderer.render(
            frame,
            assets: ["green-tile": .init(image: spriteImage, pixelArt: true)]
        )
        XCTAssertEqual(img.width, 64)
        XCTAssertEqual(img.height, 48)

        // Pure red region
        let redPx = pixelRGBA(in: img, x: 8, y: 10)
        XCTAssertEqual(redPx.0, 255)
        XCTAssertEqual(redPx.1, 0)
        XCTAssertEqual(redPx.2, 0)

        // Multiply overlap of #ff0000 and #0000ff -> #000000
        let overlapPx = pixelRGBA(in: img, x: 16, y: 10)
        XCTAssertEqual(overlapPx.0, 0)
        XCTAssertEqual(overlapPx.1, 0)
        XCTAssertEqual(overlapPx.2, 0)

        // Pure blue region (over white)
        let bluePx = pixelRGBA(in: img, x: 24, y: 10)
        XCTAssertEqual(bluePx.0, 0)
        XCTAssertEqual(bluePx.1, 0)
        XCTAssertEqual(bluePx.2, 255)

        // Outside clip remains white
        let outsideClipPx = pixelRGBA(in: img, x: 50, y: 10)
        XCTAssertEqual(outsideClipPx.0, 255)
        XCTAssertEqual(outsideClipPx.1, 255)
        XCTAssertEqual(outsideClipPx.2, 255)

        // Sprite pixel is green
        let spritePx = pixelRGBA(in: img, x: 10, y: 32)
        XCTAssertEqual(spritePx.0, 0)
        XCTAssertEqual(spritePx.1, 255)
        XCTAssertEqual(spritePx.2, 0)

        // PNG output is valid PNG header
        let png = try SuperImgGraphicsRenderer.renderPNG(
            frame,
            assets: ["green-tile": .init(image: spriteImage, pixelArt: true)]
        )
        XCTAssertTrue(png.starts(with: [0x89, 0x50, 0x4E, 0x47]))
    }

    func testMissingAssetThrows() throws {
        let json = """
        {
          "kind": "@foxworth/superimg/display-list",
          "schemaVersion": 1,
          "width": 16,
          "height": 16,
          "ops": [
            { "id": "i", "kind": "image", "bounds": { "x": 0, "y": 0, "width": 16, "height": 16 }, "opacity": 1, "asset": "missing", "fit": "fill" }
          ],
          "anchors": [],
          "issues": []
        }
        """
        let frame = try JSONDecoder().decode(DisplayListFrame.self, from: Data(json.utf8))
        XCTAssertThrowsError(try SuperImgGraphicsRenderer.render(frame)) { error in
            guard case SuperImgError.missingAsset("missing") = error else {
                XCTFail("Expected missingAsset, got \(error)")
                return
            }
        }
    }

    func testValidationRejectsInvalidFillGradientAndDuplicateAnchor() throws {
        let badFill = """
        {"kind":"@foxworth/superimg/display-list","schemaVersion":1,"width":16,"height":16,"ops":[{"id":"a","kind":"rect","bounds":{"x":0,"y":0,"width":16,"height":16},"fill":{"kind":"solid","color":"not-a-hex"}}],"anchors":[],"issues":[]}
        """
        let f1 = try JSONDecoder().decode(DisplayListFrame.self, from: Data(badFill.utf8))
        XCTAssertThrowsError(try f1.validate())

        let dupAnchor = """
        {"kind":"@foxworth/superimg/display-list","schemaVersion":1,"width":16,"height":16,"ops":[],"anchors":[{"entity":"e","name":"a","x":1,"y":2},{"entity":"e","name":"a","x":3,"y":4}],"issues":[]}
        """
        let f2 = try JSONDecoder().decode(DisplayListFrame.self, from: Data(dupAnchor.utf8))
        XCTAssertThrowsError(try f2.validate())
    }

    #if canImport(AppKit) && !targetEnvironment(macCatalyst)
    @MainActor
    func testMacCanvasUsesTopLeftFlippedCoordinates() {
        let canvas = SuperImgMacCanvas(frame: CGRect(x: 0, y: 0, width: 100, height: 100))
        XCTAssertTrue(canvas.isFlipped)
    }
    #endif
}
