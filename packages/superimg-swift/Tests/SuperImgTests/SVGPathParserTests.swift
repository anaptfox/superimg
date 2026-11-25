import XCTest
import CoreGraphics
@testable import SuperImg

final class SVGPathParserTests:XCTestCase {
    func testCommandsAndBounds() throws {
        for d in ["M1 2L11 2H15V12Z","M1 1c2 0 2 4 4 4s2-4 4-4","M0 0Q5 10 10 0T20 0","M0 0A10 10 0 011 20Z"] {
            let p=try SVGPathParser.parse(d);XCTAssertFalse(p.isEmpty);let b=p.boundingBoxOfPath;XCTAssertTrue(b.width>0);XCTAssertTrue(b.height>0)
        }
    }
    func testScientificAndSignSeparated() throws {let p=try SVGPathParser.parse("M1e1-2L20 5");XCTAssertEqual(p.boundingBoxOfPath.minX,10,accuracy:0.01);XCTAssertEqual(p.boundingBoxOfPath.minY,-2,accuracy:0.01)}
}
