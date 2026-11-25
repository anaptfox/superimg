import CoreGraphics
import Foundation

public struct DisplayMatrix: Decodable, Equatable, Sendable { public let a,b,c,d,e,f: Double; public var affine: CGAffineTransform { .init(a:a,b:b,c:c,d:d,tx:e,ty:f) } }
public struct DisplayRect: Decodable, Equatable, Sendable { public let x,y,width,height: Double; public var cgRect: CGRect { CGRect(x:x,y:y,width:width,height:height) } }
public struct DisplayGradientStop: Decodable, Equatable, Sendable { public let color: String; public let offset: Double }
public enum DisplayPaint: Decodable, Equatable, Sendable {
    case solid(color:String), linearGradient(x1:Double,y1:Double,x2:Double,y2:Double,stops:[DisplayGradientStop]), radialGradient(cx:Double,cy:Double,r:Double,stops:[DisplayGradientStop])
    private enum K:String,CodingKey { case kind,color,x1,y1,x2,y2,stops,cx,cy,r }
    public init(from decoder: Decoder) throws { let c=try decoder.container(keyedBy:K.self); switch try c.decode(String.self,forKey:.kind) { case "solid": self = .solid(color:try c.decode(String.self,forKey:.color)); case "linearGradient": self = .linearGradient(x1:try c.decode(Double.self,forKey:.x1),y1:try c.decode(Double.self,forKey:.y1),x2:try c.decode(Double.self,forKey:.x2),y2:try c.decode(Double.self,forKey:.y2),stops:try c.decode([DisplayGradientStop].self,forKey:.stops)); case "radialGradient": self = .radialGradient(cx:try c.decode(Double.self,forKey:.cx),cy:try c.decode(Double.self,forKey:.cy),r:try c.decode(Double.self,forKey:.r),stops:try c.decode([DisplayGradientStop].self,forKey:.stops)); default: throw DecodingError.dataCorruptedError(forKey:.kind,in:c,debugDescription:"Unknown paint") } }
}
public struct DisplayStroke: Decodable, Equatable, Sendable { public let color:String; public let width:Double; public let lineCap:String?; public let lineJoin:String?; public let dashArray:[Double]?; public let dashOffset:Double? }
public enum DisplayBlendMode:String,Decodable,Equatable,Sendable { case normal,multiply,screen,overlay }
public struct DisplayClip:Decodable,Equatable,Sendable { public let x,y,width,height:Double; public let radius:Double?; var rect:CGRect { .init(x:x,y:y,width:width,height:height) } }
public struct DisplayTextLine:Decodable,Equatable,Sendable { public let text:String; public let x,y,baselineY,width:Double }
public struct DisplayOp:Decodable,Equatable,Sendable {
 public enum Kind:String,Decodable,Sendable { case rect,ellipse,path,image,text }
 public let id:String; public let kind:Kind; public let bounds:DisplayRect; public let matrix:DisplayMatrix?; public let opacity:Double?; public let blendMode:DisplayBlendMode?; public let clips:[DisplayClip]?
 public let fill:DisplayPaint?; public let stroke:DisplayStroke?; public let radius:Double?; public let d:String?; public let fillRule:String?; public let asset:String?; public let fit:String?; public let pixelArt:Bool?; public let lines:[DisplayTextLine]?; public let fontFamily:String?; public let fontSize:Double?; public let fontWeight:Double?; public let fontStyle:String?; public let letterSpacing:Double?; public let lineHeight:Double?; public let align:String?; public let color:String?; public let metricsExact:Bool?
}
public struct DisplayAnchor:Decodable,Equatable,Sendable { public let entity,name:String; public let x,y:Double }
public struct DisplayListIssue:Decodable,Equatable,Sendable { public let nodeId:String?; public let code,message:String }
public struct DisplayListFrame:Decodable,Equatable,Sendable {
 public let kind:String; public let schemaVersion:Int; public let width,height:Double; public let ops:[DisplayOp]; public let anchors:[DisplayAnchor]; public let issues:[DisplayListIssue]
 public func validate() throws {
     guard kind == "@foxworth/superimg/display-list", schemaVersion == 1, width.isFinite, height.isFinite, width > 0, height > 0 else {
         throw SuperImgError.invalidFrame("Invalid DisplayList header")
     }
     var ids = Set<String>()
     for op in ops {
         let b = op.bounds
         guard !op.id.isEmpty, ids.insert(op.id).inserted,
               [b.x, b.y, b.width, b.height, op.opacity ?? 1].allSatisfy(\.isFinite),
               b.width >= 0, b.height >= 0, (0...1).contains(op.opacity ?? 1) else {
             throw SuperImgError.invalidFrame("Invalid operation \(op.id)")
         }
         if let m = op.matrix, ![m.a, m.b, m.c, m.d, m.e, m.f].allSatisfy(\.isFinite) {
             throw SuperImgError.invalidFrame("Invalid matrix for \(op.id)")
         }
         for clip in op.clips ?? [] {
             guard [clip.x, clip.y, clip.width, clip.height, clip.radius ?? 0].allSatisfy(\.isFinite),
                   clip.width >= 0, clip.height >= 0, (clip.radius ?? 0) >= 0 else {
                 throw SuperImgError.invalidFrame("Invalid clip for \(op.id)")
             }
         }
         if let fill = op.fill {
             switch fill {
             case .solid(let hex):
                 guard SuperImgFrame.rgba(hex) != nil else { throw SuperImgError.invalidFrame("Invalid fill color for \(op.id)") }
             case .linearGradient(let x1, let y1, let x2, let y2, let stops):
                 guard [x1, y1, x2, y2].allSatisfy(\.isFinite), !stops.isEmpty,
                       stops.allSatisfy({ $0.offset.isFinite && (0...1).contains($0.offset) && SuperImgFrame.rgba($0.color) != nil }) else {
                     throw SuperImgError.invalidFrame("Invalid linearGradient for \(op.id)")
                 }
             case .radialGradient(let cx, let cy, let r, let stops):
                 guard [cx, cy, r].allSatisfy(\.isFinite), r >= 0, !stops.isEmpty,
                       stops.allSatisfy({ $0.offset.isFinite && (0...1).contains($0.offset) && SuperImgFrame.rgba($0.color) != nil }) else {
                     throw SuperImgError.invalidFrame("Invalid radialGradient for \(op.id)")
                 }
             }
         }
         if let c = op.color, SuperImgFrame.rgba(c) == nil { throw SuperImgError.invalidFrame("Invalid color for \(op.id)") }
         if let s = op.stroke, SuperImgFrame.rgba(s.color) == nil || !s.width.isFinite || s.width < 0 {
             throw SuperImgError.invalidFrame("Invalid stroke for \(op.id)")
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
}

public extension SuperImgFrame {
 func asDisplayListFrame() throws -> DisplayListFrame { let ops=draw.map { d in DisplayOp(id:d.id,kind:d.kind == .ellipse ? .ellipse : (d.kind == .sprite ? .image : .rect),bounds:.init(x:d.x,y:d.y,width:d.width,height:d.height),matrix:d.matrix.map{.init(a:$0.a,b:$0.b,c:$0.c,d:$0.d,e:$0.e,f:$0.f)},opacity:d.opacity,blendMode:nil,clips:nil,fill:d.color.map{.solid(color:$0)},stroke:nil,radius:nil,d:nil,fillRule:nil,asset:d.asset,fit:"fill",pixelArt:nil,lines:nil,fontFamily:nil,fontSize:nil,fontWeight:nil,fontStyle:nil,letterSpacing:nil,lineHeight:nil,align:nil,color:nil,metricsExact:nil) }; let f=DisplayListFrame(kind:"@foxworth/superimg/display-list",schemaVersion:1,width:width,height:height,ops:ops,anchors:anchors.map{.init(entity:$0.entity,name:$0.name,x:$0.x,y:$0.y)},issues:[]); try f.validate(); return f }
}
