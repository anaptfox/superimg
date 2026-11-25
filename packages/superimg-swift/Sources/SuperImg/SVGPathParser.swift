import CoreGraphics
import Foundation

public enum SVGPathParser {
    public static func parse(_ d: String) throws -> CGPath {
        var s = Scanner(d)
        let p = CGMutablePath()
        var current = CGPoint.zero, start = CGPoint.zero
        var cubic: CGPoint?, quad: CGPoint?
        var command: Character?
        while !s.end {
            if let c = s.readCommand() { command = c }
            guard let cmd = command else { throw SuperImgError.invalidFrame("Invalid SVG path") }
            let relative = cmd.isLowercase, op = Character(cmd.uppercased())
            func point(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: CGFloat(x) + (relative ? current.x : 0), y: CGFloat(y) + (relative ? current.y : 0)) }
            switch op {
            case "M", "L", "T":
                let q = point(try s.number(), try s.number())
                if op == "M" { p.move(to:q); start=q; command = relative ? "l" : "L" } else if op == "T" { let c=quad.map { CGPoint(x:2*current.x-$0.x,y:2*current.y-$0.y) } ?? current; p.addQuadCurve(to:q, control:c); quad=c } else { p.addLine(to:q) }
                current=q; cubic=nil; if op != "T" { quad=nil }
            case "H": let x=try s.number(); current=CGPoint(x:CGFloat(x)+(relative ? current.x:0),y:current.y); p.addLine(to:current); cubic=nil; quad=nil
            case "V": let y=try s.number(); current=CGPoint(x:current.x,y:CGFloat(y)+(relative ? current.y:0)); p.addLine(to:current); cubic=nil; quad=nil
            case "C":
                let c1=point(try s.number(),try s.number()), c2=point(try s.number(),try s.number()), q=point(try s.number(),try s.number()); p.addCurve(to:q,control1:c1,control2:c2); current=q;cubic=c2;quad=nil
            case "S":
                let c1=cubic.map { CGPoint(x:2*current.x-$0.x,y:2*current.y-$0.y) } ?? current, c2=point(try s.number(),try s.number()), q=point(try s.number(),try s.number());p.addCurve(to:q,control1:c1,control2:c2);current=q;cubic=c2;quad=nil
            case "Q":
                let control=point(try s.number(),try s.number()),q=point(try s.number(),try s.number());p.addQuadCurve(to:q,control:control);current=q;quad=control;cubic=nil
            case "A":
                let rx=try s.number(), ry=try s.number(), rot=try s.number(), large=try s.flag(), sweep=try s.flag(), q=point(try s.number(),try s.number())
                arc(p, from: current, to:q, rx:rx, ry:ry, rotation:rot, large:large, sweep:sweep); current=q;cubic=nil;quad=nil
            case "Z": p.closeSubpath();current=start;cubic=nil;quad=nil;command=nil
            default: throw SuperImgError.invalidFrame("Unsupported SVG path command")
            }
        }
        return p
    }

    private static func arc(_ path: CGMutablePath, from a: CGPoint, to b: CGPoint, rx: Double, ry: Double, rotation: Double, large: Bool, sweep: Bool) {
        var rx=abs(rx), ry=abs(ry); guard rx>0,ry>0,a != b else { if a != b { path.addLine(to:b) }; return }
        let phi=rotation * .pi/180, cs=cos(phi), sn=sin(phi), dx=(a.x-b.x)/2,dy=(a.y-b.y)/2
        let xp=cs*dx+sn*dy, yp = -sn*dx+cs*dy
        let lam=xp*xp/(rx*rx)+yp*yp/(ry*ry); if lam>1 { let z=sqrt(lam);rx *= z;ry *= z }
        let sign: Double = large == sweep ? -1:1
        let numerator=max(0,rx*rx*ry*ry-rx*rx*yp*yp-ry*ry*xp*xp), denominator=rx*rx*yp*yp+ry*ry*xp*xp
        let k=sign*sqrt(denominator == 0 ? 0:numerator/denominator)
        let cxp=k*rx*yp/ry, cyp = -k*ry*xp/rx
        let cx=cs*cxp-sn*cyp+(a.x+b.x)/2, cy=sn*cxp+cs*cyp+(a.y+b.y)/2
        func angle(_ ux:Double,_ uy:Double,_ vx:Double,_ vy:Double)->Double { let dot=ux*vx+uy*vy;let det=ux*vy-uy*vx;return atan2(det,dot) }
        let ux=(xp-cxp)/rx,uy=(yp-cyp)/ry,vx=(-xp-cxp)/rx,vy=(-yp-cyp)/ry
        var theta=atan2(uy,ux), delta=angle(ux,uy,vx,vy);if !sweep && delta>0 {delta -= 2 * .pi};if sweep && delta<0 {delta += 2 * .pi}
        let n=Int(ceil(abs(delta)/(Double.pi/2))), step=delta/Double(max(1,n))
        for _ in 0..<max(1,n) {
            let t1=theta,t2=theta+step, alpha=4/3*tan((t2-t1)/4)
            func xy(_ t:Double)->CGPoint { CGPoint(x:cx+rx*cs*cos(t)-ry*sn*sin(t),y:cy+rx*sn*cos(t)+ry*cs*sin(t)) }
            func tangent(_ t:Double)->CGPoint { CGPoint(x:-rx*cs*sin(t)-ry*sn*cos(t),y:-rx*sn*sin(t)+ry*cs*cos(t)) }
            let q1=xy(t1),q2=xy(t2),u=tangent(t1),v=tangent(t2)
            path.addCurve(to:q2,control1:CGPoint(x:q1.x+alpha*u.x,y:q1.y+alpha*u.y),control2:CGPoint(x:q2.x-alpha*v.x,y:q2.y-alpha*v.y));theta=t2
        }
    }
    private struct Scanner {
        let chars:[Character]; var i=0; init(_ s:String){chars=Array(s)}
        var end:Bool { i>=chars.count || chars[i...].allSatisfy{$0.isWhitespace || $0==","} }
        mutating func readCommand()->Character? {skip();guard i<chars.count,chars[i].isLetter else{return nil};defer{i += 1};return chars[i]}
        mutating func skip(){while i<chars.count && (chars[i].isWhitespace || chars[i]==","){i += 1}}
        mutating func number() throws -> Double { skip();let start=i;if i<chars.count && (chars[i]=="+" || chars[i]=="-"){i += 1};while i<chars.count && chars[i].isNumber{i += 1};if i<chars.count && chars[i]=="." {i += 1;while i<chars.count && chars[i].isNumber{i += 1}};if i<chars.count && (chars[i]=="e" || chars[i]=="E"){i += 1;if i<chars.count && (chars[i]=="+" || chars[i]=="-"){i += 1};while i<chars.count && chars[i].isNumber{i += 1}};guard i>start,let n=Double(String(chars[start..<i])),n.isFinite else{throw SuperImgError.invalidFrame("Invalid SVG path number")};return n }
        mutating func flag() throws -> Bool { skip();guard i<chars.count,(chars[i]=="0" || chars[i]=="1") else{throw SuperImgError.invalidFrame("Invalid SVG arc flag")};let b=chars[i]=="1";i += 1;return b }
    }
}
