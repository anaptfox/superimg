import Foundation

public struct SuperImgFrameMetrics: Equatable, Sendable {
    public let sampleMilliseconds: Double
    public let renderMilliseconds: Double
    public init(sampleMilliseconds: Double, renderMilliseconds: Double) { self.sampleMilliseconds=sampleMilliseconds; self.renderMilliseconds=renderMilliseconds }
    public var totalMilliseconds: Double { sampleMilliseconds + renderMilliseconds }
}

public struct SuperImgBenchmark: Sendable {
    private var values:[SuperImgFrameMetrics]=[]
    public init() {}
    public mutating func record(sampleMilliseconds:Double,renderMilliseconds:Double) { guard sampleMilliseconds.isFinite,renderMilliseconds.isFinite,sampleMilliseconds>=0,renderMilliseconds>=0 else{return}; values.append(.init(sampleMilliseconds:sampleMilliseconds,renderMilliseconds:renderMilliseconds)) }
    public var frames:[SuperImgFrameMetrics] { values }
    public var p50Milliseconds:Double { percentile(0.50) }
    public var p95Milliseconds:Double { percentile(0.95) }
    public var maxMilliseconds:Double { values.map(\.totalMilliseconds).max() ?? 0 }
    public func droppedFrameBudget(at fps:Int) -> Int { guard fps>0 else{return 0}; let deadline=1000/Double(fps); return values.filter{$0.totalMilliseconds>deadline}.count }
    private func percentile(_ p:Double)->Double { let sorted=values.map(\.totalMilliseconds).sorted(); guard !sorted.isEmpty else{return 0}; return sorted[min(sorted.count-1,Int((Double(sorted.count-1)*p).rounded(.up)))] }
}
