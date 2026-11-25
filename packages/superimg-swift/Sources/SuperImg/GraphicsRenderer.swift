import CoreGraphics
import CoreText
import Foundation
import ImageIO
import UniformTypeIdentifiers

public struct SuperImgImageAsset: Sendable {
    public let image: CGImage
    public let pixelArt: Bool

    public init(image: CGImage, pixelArt: Bool = false) {
        self.image = image
        self.pixelArt = pixelArt
    }
}

public struct SuperImgGraphicsRenderer: Sendable {
    private static let sRGBColorSpace = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()

    public static func render(
        _ frame: DisplayListFrame,
        assets: [String: SuperImgImageAsset] = [:],
        scale: CGFloat = 1
    ) throws -> CGImage {
        try frame.validate()
        let pixelWidth = Int(ceil(frame.width * Double(scale)))
        let pixelHeight = Int(ceil(frame.height * Double(scale)))
        guard pixelWidth > 0, pixelHeight > 0,
              let context = CGContext(
                  data: nil,
                  width: pixelWidth,
                  height: pixelHeight,
                  bitsPerComponent: 8,
                  bytesPerRow: pixelWidth * 4,
                  space: sRGBColorSpace,
                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
              ) else {
            throw SuperImgError.invalidFrame("Unable to create bitmap context")
        }
        context.scaleBy(x: scale, y: scale)
        try draw(frame, in: context, assets: assets, flipY: true)
        guard let image = context.makeImage() else {
            throw SuperImgError.invalidFrame("Unable to create image from context")
        }
        return image
    }

    public static func renderPNG(
        _ frame: DisplayListFrame,
        assets: [String: SuperImgImageAsset] = [:],
        scale: CGFloat = 1
    ) throws -> Data {
        let image = try render(frame, assets: assets, scale: scale)
        let data = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil) else {
            throw SuperImgError.invalidFrame("Unable to encode PNG")
        }
        CGImageDestinationAddImage(dest, image, nil)
        guard CGImageDestinationFinalize(dest) else {
            throw SuperImgError.invalidFrame("Unable to finalize PNG")
        }
        return data as Data
    }

    public static func draw(
        _ frame: DisplayListFrame,
        in context: CGContext,
        assets: [String: SuperImgImageAsset] = [:],
        flipY: Bool = true
    ) throws {
        try frame.validate()
        context.saveGState()
        defer { context.restoreGState() }

        if flipY {
            context.translateBy(x: 0, y: CGFloat(frame.height))
            context.scaleBy(x: 1, y: -1)
        }

        for op in frame.ops {
            let opacity = op.opacity ?? 1
            if opacity <= 0 { continue }

            context.saveGState()
            defer { context.restoreGState() }

            for clip in op.clips ?? [] {
                let rect = clip.rect
                if let radius = clip.radius, radius > 0 {
                    let r = min(CGFloat(radius), min(rect.width, rect.height) / 2)
                    context.addPath(CGPath(roundedRect: rect, cornerWidth: r, cornerHeight: r, transform: nil))
                } else {
                    context.addRect(rect)
                }
                context.clip()
            }

            if let matrix = op.matrix {
                context.concatenate(matrix.affine)
            }

            context.setAlpha(CGFloat(opacity))
            switch op.blendMode ?? .normal {
            case .normal: context.setBlendMode(.normal)
            case .multiply: context.setBlendMode(.multiply)
            case .screen: context.setBlendMode(.screen)
            case .overlay: context.setBlendMode(.overlay)
            }

            let bounds = op.bounds.cgRect
            switch op.kind {
            case .rect, .ellipse, .path:
                let path: CGPath
                if op.kind == .ellipse {
                    path = CGPath(ellipseIn: bounds, transform: nil)
                } else if op.kind == .path, let d = op.d {
                    path = try SVGPathParser.parse(d)
                } else if let radius = op.radius, radius > 0 {
                    let r = min(CGFloat(radius), min(bounds.width, bounds.height) / 2)
                    path = CGPath(roundedRect: bounds, cornerWidth: r, cornerHeight: r, transform: nil)
                } else {
                    path = CGPath(rect: bounds, transform: nil)
                }

                if let fill = op.fill {
                    fillPaint(fill, in: context, bounds: bounds, path: path, fillRule: op.fillRule)
                }
                if let stroke = op.stroke {
                    strokePath(path, stroke: stroke, in: context)
                }

            case .image:
                guard let name = op.asset, let asset = assets[name] else {
                    throw SuperImgError.missingAsset(op.asset ?? op.id)
                }
                let image = asset.image
                context.saveGState()
                if let radius = op.radius, radius > 0 {
                    let r = min(CGFloat(radius), min(bounds.width, bounds.height) / 2)
                    context.addPath(CGPath(roundedRect: bounds, cornerWidth: r, cornerHeight: r, transform: nil))
                    context.clip()
                } else {
                    context.clip(to: bounds)
                }
                context.interpolationQuality = (asset.pixelArt || op.pixelArt == true) ? .none : .high

                let fit = op.fit ?? "fill"
                let iw = CGFloat(image.width)
                let ih = CGFloat(image.height)
                var dest = bounds
                if fit != "fill", iw > 0, ih > 0 {
                    let sx = bounds.width / iw
                    let sy = bounds.height / ih
                    let s = fit == "cover" ? max(sx, sy) : min(sx, sy)
                    dest = CGRect(
                        x: bounds.midX - (iw * s) / 2,
                        y: bounds.midY - (ih * s) / 2,
                        width: iw * s,
                        height: ih * s
                    )
                }
                context.translateBy(x: 0, y: dest.minY + dest.maxY)
                context.scaleBy(x: 1, y: -1)
                context.draw(image, in: dest)
                context.restoreGState()

            case .text:
                let font = fontFor(op)
                let attrs: [CFString: Any] = [
                    kCTFontAttributeName: font,
                    kCTForegroundColorAttributeName: cgColor(op.color ?? "#000000"),
                    kCTKernAttributeName: CGFloat(op.letterSpacing ?? 0),
                ]
                context.textMatrix = CGAffineTransform(scaleX: 1, y: -1)
                for line in op.lines ?? [] {
                    let attrStr = CFAttributedStringCreate(nil, line.text as CFString, attrs as CFDictionary)!
                    let ctLine = CTLineCreateWithAttributedString(attrStr)
                    context.textPosition = CGPoint(x: line.x, y: line.baselineY)
                    CTLineDraw(ctLine, context)
                }
            }
        }
    }

    private static func cgColor(_ hex: String) -> CGColor {
        let value = SuperImgFrame.rgba(hex) ?? 0
        return CGColor(
            colorSpace: sRGBColorSpace,
            components: [
                CGFloat((value >> 24) & 255) / 255,
                CGFloat((value >> 16) & 255) / 255,
                CGFloat((value >> 8) & 255) / 255,
                CGFloat(value & 255) / 255,
            ]
        )!
    }

    private static func fillPaint(
        _ paint: DisplayPaint,
        in context: CGContext,
        bounds: CGRect,
        path: CGPath,
        fillRule: String?
    ) {
        let rule: CGPathFillRule = fillRule == "evenodd" ? .evenOdd : .winding
        context.saveGState()
        defer { context.restoreGState() }
        switch paint {
        case .solid(let hex):
            context.setFillColor(cgColor(hex))
            context.addPath(path)
            context.fillPath(using: rule)
        case .linearGradient(let x1, let y1, let x2, let y2, let stops):
            context.addPath(path)
            context.clip(using: rule)
            let start = CGPoint(x: bounds.minX + bounds.width * x1, y: bounds.minY + bounds.height * y1)
            let end = CGPoint(x: bounds.minX + bounds.width * x2, y: bounds.minY + bounds.height * y2)
            drawGradient(stops: stops, in: context, start: start, end: end, radius: 0)
        case .radialGradient(let cx, let cy, let r, let stops):
            context.addPath(path)
            context.clip(using: rule)
            let center = CGPoint(x: bounds.minX + bounds.width * cx, y: bounds.minY + bounds.height * cy)
            drawGradient(stops: stops, in: context, start: center, end: center, radius: CGFloat(r) * max(bounds.width, bounds.height))
        }
    }

    private static func drawGradient(
        stops: [DisplayGradientStop],
        in context: CGContext,
        start: CGPoint,
        end: CGPoint,
        radius: CGFloat
    ) {
        let colors = stops.map { cgColor($0.color) } as CFArray
        let locations = stops.map { CGFloat($0.offset) }
        guard let gradient = CGGradient(
            colorsSpace: sRGBColorSpace,
            colors: colors,
            locations: locations
        ) else { return }
        if radius > 0 {
            context.drawRadialGradient(
                gradient,
                startCenter: start,
                startRadius: 0,
                endCenter: end,
                endRadius: radius,
                options: [.drawsBeforeStartLocation, .drawsAfterEndLocation]
            )
        } else {
            context.drawLinearGradient(
                gradient,
                start: start,
                end: end,
                options: [.drawsBeforeStartLocation, .drawsAfterEndLocation]
            )
        }
    }

    private static func strokePath(_ path: CGPath, stroke: DisplayStroke, in context: CGContext) {
        context.addPath(path)
        context.setStrokeColor(cgColor(stroke.color))
        context.setLineWidth(CGFloat(stroke.width))
        context.setLineCap(stroke.lineCap == "round" ? .round : stroke.lineCap == "square" ? .square : .butt)
        context.setLineJoin(stroke.lineJoin == "round" ? .round : stroke.lineJoin == "bevel" ? .bevel : .miter)
        if let dashes = stroke.dashArray, !dashes.isEmpty {
            context.setLineDash(phase: CGFloat(stroke.dashOffset ?? 0), lengths: dashes.map { CGFloat($0) })
        }
        context.strokePath()
    }

    private static func fontFor(_ op: DisplayOp) -> CTFont {
        let size = CGFloat(op.fontSize ?? 16)
        let weightValue = op.fontWeight ?? 400
        let isItalic = op.fontStyle == "italic"
        let names = (op.fontFamily ?? "")
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "\"'")) }
            .filter { !$0.isEmpty }

        for name in names {
            if ["system-ui", "sans-serif", "ui-sans-serif"].contains(name.lowercased()) {
                return systemFont(size: size, weight: weightValue, italic: isItalic, monospace: false)
            }
            if ["ui-monospace", "monospace"].contains(name.lowercased()) {
                return systemFont(size: size, weight: weightValue, italic: isItalic, monospace: true)
            }
            let traits: [CFString: Any] = [
                kCTFontWeightTrait: ctFontWeight(from: weightValue),
            ]
            let desc = CTFontDescriptorCreateWithAttributes([
                kCTFontFamilyNameAttribute: name as CFString,
                kCTFontTraitsAttribute: traits as CFDictionary,
            ] as CFDictionary)
            let candidate = CTFontCreateWithFontDescriptor(desc, size, nil)
            let resolvedFamily = (CTFontCopyFamilyName(candidate) as String).lowercased()
            if resolvedFamily == name.lowercased() {
                if isItalic, let italic = CTFontCreateCopyWithSymbolicTraits(candidate, size, nil, .traitItalic, .traitItalic) {
                    return italic
                }
                return candidate
            }
        }
        return systemFont(size: size, weight: weightValue, italic: isItalic, monospace: false)
    }

    private static func systemFont(size: CGFloat, weight: Double, italic: Bool, monospace: Bool) -> CTFont {
        let base: CTFont
        if monospace {
            base = CTFontCreateWithName("Menlo" as CFString, size, nil)
        } else {
            let uiFont = CTFontCreateUIFontForLanguage(.system, size, nil)
                ?? CTFontCreateWithName("Helvetica" as CFString, size, nil)
            let traits: [CFString: Any] = [kCTFontWeightTrait: ctFontWeight(from: weight)]
            let desc = CTFontDescriptorCreateCopyWithAttributes(
                CTFontCopyFontDescriptor(uiFont),
                [kCTFontTraitsAttribute: traits as CFDictionary] as CFDictionary
            )
            base = CTFontCreateWithFontDescriptor(desc, size, nil)
        }
        if italic, let italicFont = CTFontCreateCopyWithSymbolicTraits(base, size, nil, .traitItalic, .traitItalic) {
            return italicFont
        }
        return base
    }

    private static func ctFontWeight(from cssWeight: Double) -> CGFloat {
        switch cssWeight {
        case ..<250: return -0.6
        case ..<350: return -0.4
        case ..<450: return 0.0
        case ..<550: return 0.23
        case ..<650: return 0.3
        case ..<750: return 0.4
        case ..<850: return 0.56
        default: return 0.62
        }
    }
}
