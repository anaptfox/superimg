import Foundation
import JavaScriptCore

/// A trusted JavaScript file shipped as a resource of the app or a Swift package.
/// The bundle must assign a function to globalThis.superimgSample.
public actor SuperImgScene<State: Encodable & Sendable> {
    private let context: JSContext
    private let sampler: JSValue
    private let parse: JSValue
    private let stringify: JSValue
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private var inputs: (id: UUID, value: JSValue)?
    private var cachedViewport: (SuperImgViewport, JSValue)?

    private init(source: String, url: URL) throws {
        guard let context = JSContext(),
              let parse = context.evaluateScript("JSON.parse"),
              let stringify = context.evaluateScript("JSON.stringify") else {
            throw SuperImgError.evaluation("Could not initialize JavaScriptCore")
        }
        context.evaluateScript(source, withSourceURL: url)
        if let exception = context.exception {
            throw SuperImgError.evaluation(exception.toString() ?? "Failed to load scene")
        }
        guard let sampler = context.evaluateScript(
            "typeof globalThis.superimgSample === 'function' ? globalThis.superimgSample : undefined"
        ), !sampler.isUndefined else {
            throw SuperImgError.evaluation("Expected globalThis.superimgSample")
        }
        self.context = context
        self.sampler = sampler
        self.parse = parse
        self.stringify = stringify
    }

    public static func load(_ name: String, in bundle: Bundle = .main) async throws -> SuperImgScene {
        guard let url = bundle.url(forResource: name, withExtension: "js") else {
            throw SuperImgError.missingProgram(name)
        }
        let scene = try await Task.detached {
            try SuperImgScene(source: String(contentsOf: url, encoding: .utf8), url: url)
        }.value
        try Task.checkCancellation()
        return scene
    }

    public func sample(at seconds: Double, viewport: SuperImgViewport, state: State) throws -> SuperImgFrame {
        try sample(at: seconds, viewport: viewport, state: state, inputID: nil)
    }

    /// Samples a scene returning either DisplayList v1 (`installSuperImgDisplayListSampler`)
    /// or legacy `SuperImgFrame` (`installSuperImgSampler`), normalized to `DisplayListFrame`.
    public func sampleDisplayList(at seconds: Double, viewport: SuperImgViewport, state: State) throws -> DisplayListFrame {
        try sampleDisplayList(at: seconds, viewport: viewport, state: state, inputID: nil)
    }

    func sample(at seconds: Double, viewport: SuperImgViewport, state: State, inputID: UUID?) throws -> SuperImgFrame {
        let data = try evaluateSampleJSON(at: seconds, viewport: viewport, state: state, inputID: inputID)
        let frame = try decoder.decode(SuperImgFrame.self, from: data)
        try frame.validate()
        try Task.checkCancellation()
        return frame
    }

    func sampleDisplayList(at seconds: Double, viewport: SuperImgViewport, state: State, inputID: UUID?) throws -> DisplayListFrame {
        let data = try evaluateSampleJSON(at: seconds, viewport: viewport, state: state, inputID: inputID)
        if let displayFrame = try? decoder.decode(DisplayListFrame.self, from: data) {
            try displayFrame.validate()
            try Task.checkCancellation()
            return displayFrame
        }
        let legacy = try decoder.decode(SuperImgFrame.self, from: data)
        try legacy.validate()
        let converted = try legacy.asDisplayListFrame()
        try Task.checkCancellation()
        return converted
    }

    private func evaluateSampleJSON(at seconds: Double, viewport: SuperImgViewport, state: State, inputID: UUID?) throws -> Data {
        try Task.checkCancellation()
        guard seconds.isFinite, seconds >= 0, viewport.width.isFinite, viewport.height.isFinite,
              viewport.width > 0, viewport.height > 0, viewport.scale.isFinite, viewport.scale > 0 else {
            throw SuperImgError.invalidFrame("Invalid sample time or viewport")
        }
        context.exception = nil
        let input: JSValue
        if let inputID, let inputs, inputs.id == inputID {
            input = inputs.value
        } else {
            input = try jsValue(state)
            if let inputID { inputs = (inputID, input) }
        }
        let size: JSValue
        if let (previous, value) = cachedViewport, previous == viewport {
            size = value
        } else {
            size = try jsValue(viewport)
            cachedViewport = (viewport, size)
        }
        guard let result = sampler.call(withArguments: [seconds, size, input]) else {
            throw failure()
        }
        if context.exception != nil { throw failure() }
        guard let json = stringify.call(withArguments: [result]), json.isString,
              let string = json.toString() else { throw failure() }
        if context.exception != nil { throw failure() }
        return Data(string.utf8)
    }

    private func jsValue<Value: Encodable>(_ value: Value) throws -> JSValue {
        let json = String(decoding: try encoder.encode(value), as: UTF8.self)
        guard let result = parse.call(withArguments: [json]), context.exception == nil else { throw failure() }
        return result
    }

    private func failure() -> SuperImgError {
        .evaluation(context.exception?.toString() ?? "Scene must return a JSON frame")
    }
}
