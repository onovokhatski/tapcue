// Renders an SVG to a PNG of an exact pixel size with AppKit's SVG support.
// Usage: swift svg2png.swift <in.svg> <out.png> <width> <height>
import AppKit
let a = CommandLine.arguments
guard let image = NSImage(contentsOfFile: a[1]) else { print("cannot load \(a[1])"); exit(1) }
let w = Int(a[3])!, h = Int(a[4])!
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8,
  samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
rep.size = NSSize(width: w, height: h)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
image.draw(in: NSRect(x: 0, y: 0, width: w, height: h))
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[2]))
print("wrote \(a[2]) \(w)x\(h)")
