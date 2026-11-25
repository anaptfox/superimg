#if canImport(UIKit)
import UIKit

@MainActor
public final class SuperImgPlayer<State: Encodable & Sendable> {
    private let scene: SuperImgScene<State>
    private var state: State
    private var inputID = UUID()
    fileprivate var revision: UInt64 = 0
    fileprivate weak var canvas: SuperImgCanvas?

    public init(scene: SuperImgScene<State>, state: State) {
        self.scene = scene
        self.state = state
    }

    public func update(_ state: State) {
        self.state = state
        inputID = UUID()
        revision += 1
        canvas?.invalidateFrame()
    }

    fileprivate func sampler() -> SuperImgCanvas.Sample {
        let scene = scene, state = state, inputID = inputID
        return { seconds, viewport in
            try await scene.sample(at: seconds, viewport: viewport, state: state, inputID: inputID)
        }
    }
}

public struct SuperImgAppliedFrame {
    public let seconds: Double
    public let revision: UInt64
    public let viewport: CGRect
    fileprivate let anchors: [SuperImgFrame.Anchor]
    fileprivate let transform: CGAffineTransform
    fileprivate let artworkBounds: CGRect

    /// Coordinates are local to the canvas. Off-canvas anchors are omitted.
    public func anchor(entity: String, named name: String) -> CGPoint? {
        guard let anchor = anchors.first(where: { $0.entity == entity && $0.name == name }) else { return nil }
        let local = CGPoint(x: anchor.x, y: anchor.y)
        guard artworkBounds.contains(local) else { return nil }
        let point = local.applying(transform)
        return viewport.contains(point) ? point : nil
    }
}

@MainActor
public final class SuperImgCanvas: UIView {
    public enum Playback: Equatable {
        case onDemand
        case automatic(framesPerSecond: Int = 60)
    }

    public struct Sprite {
        let image: CGImage
        let pixelArt: Bool

        public init(image: CGImage, pixelArt: Bool = false) {
            self.image = image
            self.pixelArt = pixelArt
        }
    }

    public var playback: Playback = .onDemand {
        didSet {
            guard playback != oldValue else { return }
            updateDisplayLink()
            invalidateFrame()
        }
    }

    /// Called in the same Core Animation transaction as the accepted layer changes.
    public var onFrameApplied: ((SuperImgAppliedFrame) -> Void)?
    public var onError: ((Error) -> Void)?

    public var seconds: Double {
        switch playback {
        case .onDemand: requestedTime
        case .automatic: CACurrentMediaTime() - clockOrigin
        }
    }

    fileprivate typealias Sample = @Sendable (Double, SuperImgViewport) async throws -> SuperImgFrame

    private struct Mount {
        let identity: ObjectIdentifier
        let revision: () -> UInt64
        let sampler: () -> Sample
        let unbind: () -> Void
    }

    private struct Request {
        let generation: UInt64
        let revision: UInt64
        let seconds: Double
        let viewport: SuperImgViewport
        let bounds: CGRect
        let sample: Sample
    }

    private let art = CALayer()
    private struct AppliedLayer {
        let layer: CAShapeLayer
        let draw: SuperImgFrame.Draw
        let index: Int
    }
    private var nodes: [String: AppliedLayer] = [:]
    private var sprites: [String: Sprite] = [:]
    private var mounted: Mount?
    private var generation: UInt64 = 0
    private var requestedTime: Double = 0
    private var clockOrigin = CACurrentMediaTime()
    private var pending: Request?
    private var busy = false
    private var displayLink: CADisplayLink?
    private var lastError: String?
    private var observedViewport: SuperImgViewport?
    private var observedBounds: CGRect?

    public override init(frame: CGRect) {
        super.init(frame: frame)
        configure()
    }

    public required init?(coder: NSCoder) {
        super.init(coder: coder)
        configure()
    }

    private func configure() {
        clipsToBounds = true
        isUserInteractionEnabled = false
        art.anchorPoint = .zero
        art.masksToBounds = true
        layer.addSublayer(art)
        NotificationCenter.default.addObserver(
            self, selector: #selector(accessibilityMotionChanged),
            name: UIAccessibility.reduceMotionStatusDidChangeNotification, object: nil
        )
    }

    public func mount<State>(_ player: SuperImgPlayer<State>, sprites: [String: Sprite] = [:]) {
        if player.canvas !== self { player.canvas?.unmount() }
        unmount()
        player.canvas = self
        self.sprites = sprites
        clockOrigin = CACurrentMediaTime()
        requestedTime = 0
        mounted = Mount(
            identity: ObjectIdentifier(player),
            revision: { player.revision },
            sampler: { player.sampler() },
            unbind: { [weak self] in
                if player.canvas === self { player.canvas = nil }
            }
        )
        updateDisplayLink()
        invalidateFrame()
    }

    public func unmount() {
        generation += 1
        pending = nil
        mounted?.unbind()
        mounted = nil
        updateDisplayLink()
        nodes.values.forEach { $0.layer.removeFromSuperlayer() }
        nodes.removeAll()
        sprites.removeAll()
        lastError = nil
        observedViewport = nil
        observedBounds = nil
    }

    func contains<State>(_ player: SuperImgPlayer<State>) -> Bool {
        mounted?.identity == ObjectIdentifier(player)
    }

    /// In on-demand mode this also sets the time used on later state and size changes.
    public func requestFrame(at seconds: Double) {
        guard seconds.isFinite, seconds >= 0 else { return }
        if playback == .onDemand { generation += 1 }
        requestedTime = seconds
        enqueue(seconds)
    }

    public override var isHidden: Bool {
        didSet {
            guard oldValue != isHidden else { return }
            invalidateGeometry()
            updateDisplayLink()
        }
    }

    public override func didMoveToWindow() {
        super.didMoveToWindow()
        invalidateGeometry()
        updateDisplayLink()
    }

    public override func layoutSubviews() {
        super.layoutSubviews()
        if currentViewport != observedViewport || bounds != observedBounds { invalidateGeometry() }
    }

    public override func safeAreaInsetsDidChange() {
        super.safeAreaInsetsDidChange()
        invalidateGeometry()
    }

    fileprivate func invalidateFrame() { enqueue(seconds) }

    @objc private func accessibilityMotionChanged() { invalidateGeometry() }

    private func invalidateGeometry() {
        generation += 1
        pending = nil
        observedViewport = currentViewport
        observedBounds = bounds
        invalidateFrame()
    }

    private var currentViewport: SuperImgViewport {
        .init(
            width: bounds.width, height: bounds.height,
            scale: traitCollection.displayScale > 0 ? traitCollection.displayScale : 1,
            safeArea: .init(
                top: safeAreaInsets.top, left: safeAreaInsets.left,
                bottom: safeAreaInsets.bottom, right: safeAreaInsets.right
            ), reduceMotion: UIAccessibility.isReduceMotionEnabled
        )
    }

    private func updateDisplayLink() {
        displayLink?.invalidate()
        displayLink = nil
        guard case let .automatic(fps) = playback, window != nil, !isHidden, mounted != nil else { return }
        let target = SuperImgDisplayTarget { [weak self] link in
            guard let self else { link.invalidate(); return }
            self.enqueue(max(0, link.targetTimestamp - self.clockOrigin))
        }
        let link = CADisplayLink(target: target, selector: #selector(SuperImgDisplayTarget.tick(_:)))
        link.preferredFramesPerSecond = max(1, fps)
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    private func enqueue(_ seconds: Double) {
        guard let mounted, window != nil, !isHidden, bounds.width > 0, bounds.height > 0 else { return }
        pending = Request(
            generation: generation, revision: mounted.revision(), seconds: seconds,
            viewport: currentViewport, bounds: bounds, sample: mounted.sampler()
        )
        startPending()
    }

    private func startPending() {
        guard !busy, let request = pending else { return }
        pending = nil
        busy = true

        Task { [weak self] in
            let result: Result<SuperImgFrame, Error>
            do { result = .success(try await request.sample(request.seconds, request.viewport)) }
            catch { result = .failure(error) }
            self?.complete(result, for: request)
        }
    }

    private func complete(_ result: Result<SuperImgFrame, Error>, for request: Request) {
        defer { busy = false; startPending() }
        guard request.generation == generation, request.revision == mounted?.revision(),
              request.viewport == currentViewport, request.bounds == bounds else { return }
        do {
            try apply(result.get(), for: request)
            lastError = nil
        } catch {
            let message = String(describing: error)
            if lastError != message {
                lastError = message
                onError?(error)
            }
        }
    }

    private func apply(_ frame: SuperImgFrame, for request: Request) throws {
        for draw in frame.draw where draw.kind == .sprite {
            guard let asset = draw.asset, sprites[asset] != nil else {
                throw SuperImgError.missingAsset(draw.asset ?? draw.id)
            }
        }
        let scale = min(request.bounds.width / frame.width, request.bounds.height / frame.height)
        let x = request.bounds.minX + (request.bounds.width - frame.width * scale) / 2
        let y = request.bounds.minY + (request.bounds.height - frame.height * scale) / 2
        let transform = CGAffineTransform(a: scale, b: 0, c: 0, d: scale, tx: x, ty: y)

        CATransaction.begin()
        CATransaction.setDisableActions(true)
        art.bounds = CGRect(x: 0, y: 0, width: frame.width, height: frame.height)
        art.position = CGPoint(x: x, y: y)
        art.setAffineTransform(CGAffineTransform(scaleX: scale, y: scale))

        let live = Set(frame.draw.map(\.id))
        for id in nodes.keys where !live.contains(id) {
            nodes.removeValue(forKey: id)?.layer.removeFromSuperlayer()
        }
        for (index, draw) in frame.draw.enumerated() {
            let previous = nodes[draw.id]
            if previous?.draw == draw, previous?.index == index { continue }
            let node = previous?.layer ?? makeLayer()
            configure(node, for: draw, previous: previous?.draw, order: index)
            nodes[draw.id] = AppliedLayer(layer: node, draw: draw, index: index)
        }

        onFrameApplied?(SuperImgAppliedFrame(
            seconds: request.seconds, revision: request.revision, viewport: request.bounds,
            anchors: frame.anchors, transform: transform, artworkBounds: art.bounds
        ))
        CATransaction.commit()
    }

    private func makeLayer() -> CAShapeLayer {
        let node = CAShapeLayer()
        node.anchorPoint = .zero
        art.addSublayer(node)
        return node
    }

    private func configure(_ node: CAShapeLayer, for draw: SuperImgFrame.Draw, previous: SuperImgFrame.Draw?, order: Int) {
        let matrix = draw.matrix?.affine ?? .identity
        let box = CGRect(x: 0, y: 0, width: draw.width, height: draw.height)
        let resized = node.bounds != box
        node.bounds = box
        node.position = CGPoint(x: draw.x, y: draw.y).applying(matrix)
        node.setAffineTransform(.init(a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, tx: 0, ty: 0))
        node.zPosition = CGFloat(order)
        node.opacity = Float(draw.opacity ?? 1)
        node.isHidden = node.opacity == 0
        if let asset = draw.asset, draw.kind == .sprite, let sprite = sprites[asset] {
            if previous?.kind == .sprite, previous?.asset == asset { return }
            node.backgroundColor = nil
            node.path = nil
            node.contents = sprite.image
            node.magnificationFilter = sprite.pixelArt ? .nearest : .linear
            node.minificationFilter = sprite.pixelArt ? .nearest : .linear
        } else if let value = draw.color.flatMap(SuperImgFrame.rgba) {
            if !resized, previous?.kind == draw.kind, previous?.color == draw.color { return }
            node.contents = nil
            let ink = CGColor(
                red: CGFloat((value >> 24) & 255) / 255,
                green: CGFloat((value >> 16) & 255) / 255,
                blue: CGFloat((value >> 8) & 255) / 255,
                alpha: CGFloat(value & 255) / 255
            )
            if draw.kind == .ellipse {
                node.backgroundColor = nil
                node.fillColor = ink
                if resized || node.path == nil { node.path = CGPath(ellipseIn: box, transform: nil) }
            } else {
                node.path = nil
                node.backgroundColor = ink
            }
        }
    }
}

@MainActor
private final class SuperImgDisplayTarget: NSObject {
    let callback: (CADisplayLink) -> Void
    init(_ callback: @escaping (CADisplayLink) -> Void) { self.callback = callback }
    @objc func tick(_ link: CADisplayLink) { callback(link) }
}
#endif
