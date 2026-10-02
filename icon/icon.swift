// Run Local ikonu: koyu squircle, renkli uygulama karoları ve yeşil oynat düğmesi.
import AppKit

let S: CGFloat = 1024
let img = NSImage(size: NSSize(width: S, height: S))
img.lockFocus()
let ctx = NSGraphicsContext.current!.cgContext

let body = CGRect(x: 100, y: 100, width: 824, height: 824)
let path = NSBezierPath(roundedRect: body, xRadius: 185, yRadius: 185)
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -14), blur: 36, color: NSColor.black.withAlphaComponent(0.35).cgColor)
NSColor.black.setFill(); path.fill()
ctx.restoreGState()
path.addClip()
NSGradient(colors: [NSColor(calibratedRed: 0.11, green: 0.12, blue: 0.14, alpha: 1),
                    NSColor(calibratedRed: 0.04, green: 0.045, blue: 0.05, alpha: 1)])!.draw(in: body, angle: -90)

func rgb(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat) -> NSColor { NSColor(calibratedRed: r/255, green: g/255, blue: b/255, alpha: 1) }
let tiles: [(CGRect, NSColor, NSColor)] = [
  (CGRect(x: 214, y: 528, width: 270, height: 270), rgb(129, 140, 248), rgb(79, 70, 229)),
  (CGRect(x: 540, y: 528, width: 270, height: 270), rgb(251, 146, 60), rgb(234, 88, 12)),
  (CGRect(x: 214, y: 202, width: 270, height: 270), rgb(244, 114, 182), rgb(219, 39, 119)),
]
for (r, a, b) in tiles {
  let p = NSBezierPath(roundedRect: r, xRadius: 68, yRadius: 68)
  NSGradient(colors: [a, b])!.draw(in: p, angle: -60)
  NSColor(white: 1, alpha: 0.18).setStroke(); p.lineWidth = 4; p.stroke()
}
// Oynat karosu
let green = rgb(52, 211, 153)
let pr = CGRect(x: 540, y: 202, width: 270, height: 270)
let c = NSPoint(x: pr.midX, y: pr.midY)
NSGradient(colors: [green.withAlphaComponent(0.45), .clear])!.draw(fromCenter: c, radius: 0, toCenter: c, radius: 260, options: [])
let pp = NSBezierPath(roundedRect: pr, xRadius: 68, yRadius: 68)
NSGradient(colors: [rgb(110, 231, 183), rgb(16, 185, 129)])!.draw(in: pp, angle: -60)
let tri = NSBezierPath()
tri.move(to: NSPoint(x: c.x - 42, y: c.y + 66))
tri.line(to: NSPoint(x: c.x + 70, y: c.y))
tri.line(to: NSPoint(x: c.x - 42, y: c.y - 66))
tri.close()
tri.lineJoinStyle = .round; tri.lineWidth = 26
NSColor(calibratedRed: 0.03, green: 0.2, blue: 0.14, alpha: 1).set(); tri.fill(); tri.stroke()

img.unlockFocus()
let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
