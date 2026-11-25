import CoreGraphics
import Foundation

public struct SuperImgViewport: Encodable, Equatable, Sendable {
    public let width: Double
    public let height: Double
    public let scale: Double
    public let safeArea: Insets
    public let reduceMotion: Bool

    public struct Insets: Encodable, Equatable, Sendable {
        public let top: Double
        public let left: Double
        public let bottom: Double
        public let right: Double

        public init(top: Double = 0, left: Double = 0, bottom: Double = 0, right: Double = 0) {
            self.top = top
            self.left = left
            self.bottom = bottom
            self.right = right
        }
    }

    public init(width: Double, height: Double, scale: Double = 1, safeArea: Insets = .init(), reduceMotion: Bool = false) {
        self.width = width
        self.height = height
        self.scale = scale
        self.safeArea = safeArea
        self.reduceMotion = reduceMotion
    }
}

public struct SuperImgFrame: Decodable, Sendable {
    public let width: Double
    public let height: Double
    public let draw: [Draw]
    public let anchors: [Anchor]

    public struct Draw: Decodable, Equatable, Sendable {
        public enum Kind: String, Decodable, Sendable { case rect, ellipse, sprite }

        public let id: String
        public let kind: Kind
        public let x: Double
        public let y: Double
        public let width: Double
        public let height: Double
        public let matrix: Matrix?
        public let opacity: Double?
        public let color: String?
        public let asset: String?

        public struct Matrix: Decodable, Equatable, Sendable {
            public let a: Double
            public let b: Double
            public let c: Double
            public let d: Double
            public let e: Double
            public let f: Double

            var affine: CGAffineTransform { .init(a: a, b: b, c: c, d: d, tx: e, ty: f) }
        }
    }

    public struct Anchor: Decodable, Sendable {
        public let entity: String
        public let name: String
        public let x: Double
        public let y: Double
    }

    func validate() throws {
        guard width.isFinite, height.isFinite, width > 0, height > 0 else {
            throw SuperImgError.invalidFrame("Invalid canvas size")
        }
        var ids = Set<String>()
        for op in draw {
            guard !op.id.isEmpty, ids.insert(op.id).inserted,
                  [op.x, op.y, op.width, op.height].allSatisfy(\.isFinite),
                  op.width >= 0, op.height >= 0,
                  (0...1).contains(op.opacity ?? 1) else {
                throw SuperImgError.invalidFrame("Invalid or duplicate draw operation \(op.id)")
            }
            if let m = op.matrix, ![m.a, m.b, m.c, m.d, m.e, m.f].allSatisfy(\.isFinite) {
                throw SuperImgError.invalidFrame("Invalid transform for \(op.id)")
            }
            switch op.kind {
            case .rect, .ellipse:
                guard let color = op.color, Self.rgba(color) != nil else {
                    throw SuperImgError.invalidFrame("Invalid color for \(op.id)")
                }
            case .sprite:
                guard let asset = op.asset, !asset.isEmpty else {
                    throw SuperImgError.invalidFrame("Missing sprite asset for \(op.id)")
                }
            }
        }
        var anchorKeys: [String: Set<String>] = [:]
        for anchor in anchors {
            guard !anchor.entity.isEmpty, !anchor.name.isEmpty, anchor.x.isFinite, anchor.y.isFinite,
                  anchorKeys[anchor.entity, default: []].insert(anchor.name).inserted else {
                throw SuperImgError.invalidFrame("Invalid or duplicate anchor")
            }
        }
    }

    static func rgba(_ color: String) -> UInt32? {
        guard color.first == "#" else { return nil }
        let digits = color.dropFirst()
        guard [6, 8].contains(digits.count), digits.utf8.allSatisfy({
            (48...57).contains($0) || (65...70).contains($0) || (97...102).contains($0)
        }), let value = UInt32(digits, radix: 16) else { return nil }
        return digits.count == 6 ? (value << 8) | 255 : value
    }
}

public enum SuperImgError: Error, Sendable {
    case missingProgram(String)
    case missingAsset(String)
    case evaluation(String)
    case invalidFrame(String)
}
