#if canImport(UIKit) && canImport(SwiftUI)
import SwiftUI

/// A SwiftUI wrapper around the same retained canvas used by UIKit.
public struct SuperImgSurface<State: Encodable & Sendable>: UIViewRepresentable {
    private let player: SuperImgPlayer<State>
    private let sprites: [String: SuperImgCanvas.Sprite]
    private let playback: SuperImgCanvas.Playback
    private let onFrameApplied: ((SuperImgAppliedFrame) -> Void)?
    private let onError: ((Error) -> Void)?

    /// Sprite resources are mounted with the player. Supply a new player to replace them.
    public init(
        player: SuperImgPlayer<State>,
        sprites: [String: SuperImgCanvas.Sprite] = [:],
        playback: SuperImgCanvas.Playback = .onDemand,
        onFrameApplied: ((SuperImgAppliedFrame) -> Void)? = nil,
        onError: ((Error) -> Void)? = nil
    ) {
        self.player = player
        self.sprites = sprites
        self.playback = playback
        self.onFrameApplied = onFrameApplied
        self.onError = onError
    }

    public func makeUIView(context: Context) -> SuperImgCanvas {
        SuperImgCanvas(frame: .zero)
    }

    public func updateUIView(_ canvas: SuperImgCanvas, context: Context) {
        canvas.onFrameApplied = onFrameApplied
        canvas.onError = onError
        canvas.playback = playback
        if !canvas.contains(player) { canvas.mount(player, sprites: sprites) }
    }

    public static func dismantleUIView(_ canvas: SuperImgCanvas, coordinator: ()) {
        canvas.unmount()
    }
}
#endif
