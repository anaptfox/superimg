#if canImport(AppKit) && !targetEnvironment(macCatalyst)
import AppKit
import QuartzCore

@MainActor
public final class SuperImgMacCanvas: NSView {
    public enum Playback: Equatable, Sendable {
        case onDemand
        case automatic(framesPerSecond: Int = 60)
    }

    public var playback: Playback = .onDemand {
        didSet {
            guard playback != oldValue else { return }
            updateTimer()
            invalidateFrame()
        }
    }

    /// Called in the same Core Animation transaction as the accepted layer changes.
    public var onFrameApplied: ((SuperImgAppliedFrame) -> Void)?
    public var onError: ((Error) -> Void)?
    public var onMetrics: ((SuperImgFrameMetrics) -> Void)?
    public private(set) var benchmark = SuperImgBenchmark()

    public var seconds: Double {
        switch playback {
        case .onDemand:
            if timelineIsPlaying() {
                return CACurrentMediaTime() - clockOrigin
            }
            return requestedTime
        case .automatic:
            return CACurrentMediaTime() - clockOrigin
        }
    }

    private typealias Sample = @Sendable (Double, SuperImgViewport) async throws -> (DisplayListFrame, [String: SuperImgImageAsset])

    private struct Mount {
        let identity: ObjectIdentifier
        let revision: () -> UInt64
        let sampler: () -> Sample
        let isPlaying: () -> Bool
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
    private var mounted: Mount?
    private weak var timelinePlayer: SuperImgTimelinePlayer?
    private var sceneRevision: UInt64 = 0
    private var generation: UInt64 = 0
    private var requestedTime: Double = 0
    private var clockOrigin = CACurrentMediaTime()
    private var pending: Request?
    private var busy = false
    private var timer: Timer?
    private var lastError: String?
    private var observedViewport: SuperImgViewport?
    private var observedBounds: CGRect?

    public override var isFlipped: Bool { true }

    public override init(frame: CGRect) {
        super.init(frame: frame)
        configure()
    }

    public required init?(coder: NSCoder) {
        super.init(coder: coder)
        configure()
    }

    private func configure() {
        wantsLayer = true
        if layer == nil {
            let root = CALayer()
            root.masksToBounds = true
            layer = root
        } else {
            layer?.masksToBounds = true
        }
        art.anchorPoint = .zero
        art.masksToBounds = true
        layer?.addSublayer(art)
    }

    public func mount(_ player: SuperImgTimelinePlayer) {
        unmount()
        timelinePlayer = player
        player.addObserver(self)
        requestedTime = player.currentSeconds
        clockOrigin = CACurrentMediaTime() - player.currentSeconds
        let assets = player.artifact.assets
        mounted = Mount(
            identity: ObjectIdentifier(player),
            revision: { player.revision },
            sampler: {
                { seconds, viewport in
                    let frame = try await player.sampleFrame(at: seconds, viewport: viewport)
                    return (frame, assets)
                }
            },
            isPlaying: { player.isPlaying },
            unbind: { [weak self] in
                guard let self else { return }
                player.removeObserver(self)
            }
        )
        updateTimer()
        invalidateFrame()
    }

    public func mount<State: Encodable & Sendable>(
        _ scene: SuperImgScene<State>,
        state: State,
        assets: [String: SuperImgImageAsset] = [:]
    ) {
        let isSameScene = mounted?.identity == ObjectIdentifier(scene)
        if !isSameScene {
            unmount()
            clockOrigin = CACurrentMediaTime()
            requestedTime = 0
        } else {
            generation += 1
            pending = nil
        }
        sceneRevision &+= 1
        let inputID = UUID()
        mounted = Mount(
            identity: ObjectIdentifier(scene),
            revision: { [weak self] in self?.sceneRevision ?? 0 },
            sampler: {
                { seconds, viewport in
                    let displayFrame = try await scene.sampleDisplayList(at: seconds, viewport: viewport, state: state, inputID: inputID)
                    return (displayFrame, assets)
                }
            },
            isPlaying: { false },
            unbind: {}
        )
        if !isSameScene {
            updateTimer()
        }
        invalidateFrame()
    }

    public func unmount() {
        generation += 1
        pending = nil
        mounted?.unbind()
        mounted = nil
        timelinePlayer = nil
        updateTimer()
        art.contents = nil
        lastError = nil
        observedViewport = nil
        observedBounds = nil
    }

    public func contains(_ player: SuperImgTimelinePlayer) -> Bool {
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
            updateTimer()
        }
    }

    public override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        invalidateGeometry()
        updateTimer()
    }

    public override func layout() {
        super.layout()
        if currentViewport != observedViewport || bounds != observedBounds {
            invalidateGeometry()
        }
    }

    public override func viewDidChangeBackingProperties() {
        super.viewDidChangeBackingProperties()
        invalidateGeometry()
    }

    private func invalidateFrame() {
        enqueue(seconds)
    }

    private func timelineIsPlaying() -> Bool {
        mounted?.isPlaying() ?? false
    }

    private func invalidateGeometry() {
        generation += 1
        pending = nil
        observedViewport = currentViewport
        observedBounds = bounds
        invalidateFrame()
    }

    private var currentViewport: SuperImgViewport {
        let backingScale = window?.backingScaleFactor
            ?? NSScreen.main?.backingScaleFactor
            ?? 1.0
        return SuperImgViewport(
            width: bounds.width,
            height: bounds.height,
            scale: backingScale > 0 ? backingScale : 1.0,
            safeArea: .init(),
            reduceMotion: NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
        )
    }

    private func updateTimer() {
        timer?.invalidate()
        timer = nil
        let targetFPS: Int?
        switch playback {
        case .automatic(let fps):
            targetFPS = fps
        case .onDemand:
            if timelineIsPlaying(), let player = timelinePlayer {
                targetFPS = max(1, Int(player.info.fps.rounded()))
            } else {
                targetFPS = nil
            }
        }
        guard let fps = targetFPS, !isHidden, mounted != nil else { return }
        let interval = 1.0 / Double(max(1, fps))
        let newTimer = Timer(timeInterval: interval, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.tick()
            }
        }
        RunLoop.main.add(newTimer, forMode: .common)
        timer = newTimer
    }

    private func tick() {
        guard mounted != nil, !isHidden else {
            updateTimer()
            return
        }
        let elapsed = max(0, CACurrentMediaTime() - clockOrigin)
        let sampleTime: Double
        if let player = timelinePlayer, player.info.animated, player.info.durationSeconds > 0 {
            sampleTime = elapsed.truncatingRemainder(dividingBy: player.info.durationSeconds)
            player.updatePlaybackClock(sampleTime)
        } else {
            sampleTime = elapsed
        }
        enqueue(sampleTime)
    }

    private func enqueue(_ seconds: Double) {
        guard let mounted, !isHidden, bounds.width > 0, bounds.height > 0 else { return }
        pending = Request(
            generation: generation,
            revision: mounted.revision(),
            seconds: seconds,
            viewport: currentViewport,
            bounds: bounds,
            sample: mounted.sampler()
        )
        startPending()
    }

    private func startPending() {
        guard !busy, let request = pending else { return }
        pending = nil
        busy = true

        Task { [weak self] in
            let sampleStart = ContinuousClock.now
            let result: Result<(DisplayListFrame, [String: SuperImgImageAsset], Double), Error>
            do {
                let (frame, assets) = try await request.sample(request.seconds, request.viewport)
                let sampleMs = Self.elapsedMilliseconds(since: sampleStart)
                result = .success((frame, assets, sampleMs))
            } catch {
                result = .failure(error)
            }
            self?.complete(result, for: request)
        }
    }

    private func complete(
        _ result: Result<(DisplayListFrame, [String: SuperImgImageAsset], Double), Error>,
        for request: Request
    ) {
        defer { busy = false; startPending() }
        guard request.generation == generation,
              request.revision == mounted?.revision(),
              request.viewport == currentViewport,
              request.bounds == bounds else { return }

        do {
            let (frame, assets, sampleMs) = try result.get()
            let renderStart = ContinuousClock.now
            let cgImage = try SuperImgGraphicsRenderer.render(
                frame,
                assets: assets,
                scale: CGFloat(request.viewport.scale)
            )
            let renderMs = Self.elapsedMilliseconds(since: renderStart)

            let metrics = SuperImgFrameMetrics(
                sampleMilliseconds: sampleMs,
                renderMilliseconds: renderMs
            )
            benchmark.record(sampleMilliseconds: sampleMs, renderMilliseconds: renderMs)
            onMetrics?(metrics)

            let scale = min(request.bounds.width / frame.width, request.bounds.height / frame.height)
            let x = request.bounds.minX + (request.bounds.width - frame.width * scale) / 2
            let y = request.bounds.minY + (request.bounds.height - frame.height * scale) / 2
            let transform = CGAffineTransform(a: scale, b: 0, c: 0, d: scale, tx: x, ty: y)

            CATransaction.begin()
            CATransaction.setDisableActions(true)
            art.bounds = CGRect(x: 0, y: 0, width: frame.width, height: frame.height)
            art.position = CGPoint(x: x, y: y)
            art.setAffineTransform(CGAffineTransform(scaleX: scale, y: scale))
            art.contentsScale = CGFloat(request.viewport.scale)
            art.contents = cgImage

            onFrameApplied?(SuperImgAppliedFrame(
                seconds: request.seconds,
                revision: request.revision,
                viewport: request.bounds,
                displayAnchors: frame.anchors,
                transform: transform,
                artworkBounds: art.bounds
            ))
            CATransaction.commit()
            lastError = nil
        } catch {
            let message = String(describing: error)
            if lastError != message {
                lastError = message
                onError?(error)
            }
        }
    }

    private static func elapsedMilliseconds(since start: ContinuousClock.Instant) -> Double {
        let elapsed = start.duration(to: .now)
        let components = elapsed.components
        return Double(components.seconds) * 1000.0 + Double(components.attoseconds) / 1e15
    }
}

extension SuperImgMacCanvas: SuperImgTimelineObserver {
    func timelinePlayerDidUpdate(didSeek: Bool, playbackChanged: Bool) {
        if let player = timelinePlayer {
            if didSeek {
                generation += 1
                requestedTime = player.currentSeconds
                clockOrigin = CACurrentMediaTime() - player.currentSeconds
            } else if playbackChanged {
                clockOrigin = CACurrentMediaTime() - player.currentSeconds
                requestedTime = player.currentSeconds
            }
        }
        if playbackChanged {
            updateTimer()
        }
        invalidateFrame()
    }
}

#if canImport(SwiftUI)
import SwiftUI

/// A SwiftUI wrapper around the retained macOS canvas (`SuperImgMacCanvas`).
public struct SuperImgMacSurface: NSViewRepresentable {
    private let player: SuperImgTimelinePlayer
    private let playback: SuperImgMacCanvas.Playback
    private let onFrameApplied: ((SuperImgAppliedFrame) -> Void)?
    private let onError: ((Error) -> Void)?
    private let onMetrics: ((SuperImgFrameMetrics) -> Void)?

    public init(
        player: SuperImgTimelinePlayer,
        playback: SuperImgMacCanvas.Playback = .onDemand,
        onFrameApplied: ((SuperImgAppliedFrame) -> Void)? = nil,
        onError: ((Error) -> Void)? = nil,
        onMetrics: ((SuperImgFrameMetrics) -> Void)? = nil
    ) {
        self.player = player
        self.playback = playback
        self.onFrameApplied = onFrameApplied
        self.onError = onError
        self.onMetrics = onMetrics
    }

    public func makeNSView(context: Context) -> SuperImgMacCanvas {
        SuperImgMacCanvas(frame: .zero)
    }

    public func updateNSView(_ canvas: SuperImgMacCanvas, context: Context) {
        canvas.onFrameApplied = onFrameApplied
        canvas.onError = onError
        canvas.onMetrics = onMetrics
        canvas.playback = playback
        if !canvas.contains(player) {
            canvas.mount(player)
        }
    }

    public static func dismantleNSView(_ canvas: SuperImgMacCanvas, coordinator: ()) {
        canvas.unmount()
    }
}
#endif
#endif
