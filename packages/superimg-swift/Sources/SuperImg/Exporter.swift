import AVFoundation
import CoreVideo
import CoreGraphics
import Foundation

public struct SuperImgExportOptions: Sendable {
    public var width:Int; public var height:Int; public var fps:Int; public var codec:AVVideoCodecType; public var scale:CGFloat; public var averageBitRate:Int?
    public init(width:Int,height:Int,fps:Int,codec:AVVideoCodecType = .h264,scale:CGFloat = 1,averageBitRate:Int? = nil) { self.width=width; self.height=height; self.fps=fps; self.codec=codec; self.scale=scale; self.averageBitRate=averageBitRate }
}
public enum SuperImgExporter {
    public static func exportMP4(to outputURL:URL,frameCount:Int,options:SuperImgExportOptions,assets:[String:SuperImgImageAsset]=[:],frameProvider:@Sendable (Int,Double) async throws -> DisplayListFrame) async throws -> URL {
        try? FileManager.default.removeItem(at:outputURL)
        let writer=try AVAssetWriter(outputURL:outputURL,fileType:.mp4)
        var settings:[String:Any]=[AVVideoCodecKey:options.codec,AVVideoWidthKey:options.width,AVVideoHeightKey:options.height]
        if let rate=options.averageBitRate { settings[AVVideoCompressionPropertiesKey]=[AVVideoAverageBitRateKey:rate] }
        let input=AVAssetWriterInput(mediaType:.video,outputSettings:settings); input.expectsMediaDataInRealTime=false
        let adaptor=AVAssetWriterInputPixelBufferAdaptor(assetWriterInput:input,sourcePixelBufferAttributes:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32BGRA,kCVPixelBufferWidthKey as String:options.width,kCVPixelBufferHeightKey as String:options.height,kCVPixelBufferCGImageCompatibilityKey as String:true,kCVPixelBufferCGBitmapContextCompatibilityKey as String:true])
        guard writer.canAdd(input) else { throw SuperImgError.invalidFrame("Cannot add video input") }; writer.add(input); guard writer.startWriting() else { throw writer.error ?? SuperImgError.invalidFrame("Could not start MP4 writer") }; writer.startSession(atSourceTime:.zero)
        for i in 0..<frameCount {
            while !input.isReadyForMoreMediaData { try await Task.sleep(for:.milliseconds(2)) }
            guard let pool=adaptor.pixelBufferPool else { throw SuperImgError.invalidFrame("Missing pixel buffer pool") }
            var buffer:CVPixelBuffer?; guard CVPixelBufferPoolCreatePixelBuffer(nil,pool,&buffer)==kCVReturnSuccess, let pixel=buffer else { throw SuperImgError.invalidFrame("Could not allocate pixel buffer") }
            CVPixelBufferLockBaseAddress(pixel,[]); defer { CVPixelBufferUnlockBaseAddress(pixel,[]) }
            guard let ctx=CGContext(data:CVPixelBufferGetBaseAddress(pixel),width:options.width,height:options.height,bitsPerComponent:8,bytesPerRow:CVPixelBufferGetBytesPerRow(pixel),space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGBitmapInfo.byteOrder32Little.rawValue|CGImageAlphaInfo.premultipliedFirst.rawValue) else { throw SuperImgError.invalidFrame("Could not create video context") }
            let frame=try await frameProvider(i,Double(i)/Double(options.fps)); ctx.scaleBy(x:options.scale,y:options.scale); try SuperImgGraphicsRenderer.draw(frame,in:ctx,assets:assets,flipY:true)
            guard adaptor.append(pixel,withPresentationTime:CMTime(value:CMTimeValue(i),timescale:CMTimeScale(options.fps))) else { throw writer.error ?? SuperImgError.invalidFrame("Could not append video frame") }
        }
        input.markAsFinished(); await writer.finishWriting(); guard writer.status == .completed else { throw writer.error ?? SuperImgError.invalidFrame("MP4 export failed") }; return outputURL
    }
    public static func exportMP4(artifact:SuperImgArtifact,to outputURL:URL,dataPatchJSON:String?=nil,edition:String?=nil,scale:CGFloat=1) async throws -> URL {
        let info=artifact.info
        let options=SuperImgExportOptions(width:Int(info.width),height:Int(info.height),fps:Int(info.fps),scale:scale)
        return try await exportMP4(to:outputURL,frameCount:info.totalFrames,options:options,assets:artifact.assets) { index, seconds in
            try await artifact.sample(.init(seconds:seconds,frame:index,edition:edition),dataPatchJSON:dataPatchJSON)
        }
    }
}
