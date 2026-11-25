// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "SuperImg",
    platforms: [.iOS(.v18), .macOS(.v13)],
    products: [.library(name: "SuperImg", targets: ["SuperImg"])],
    targets: [
        .target(name: "SuperImg", resources: [.process("Resources")]),
        .testTarget(
            name: "SuperImgTests",
            dependencies: ["SuperImg"],
            resources: [.process("Fixtures"), .copy("ArtifactFixtures")]
        ),
    ]
)
