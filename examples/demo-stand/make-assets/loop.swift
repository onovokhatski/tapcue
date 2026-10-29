// Makes a seamless H.264 loop from a still: a soft light circles once per loop, so the last
// frame leads straight back into the first. Usage: swift loop.swift <in.png> <out.mp4>
import AVFoundation
import AppKit

let a = CommandLine.arguments
let still = NSImage(contentsOfFile: a[1])!.cgImage(forProposedRect: nil, context: nil, hints: nil)!
let w = 1920, h = 1440, fps: Int32 = 30, frames = 180   // 6 s
let out = URL(fileURLWithPath: a[2]); try? FileManager.default.removeItem(at: out)
let writer = try AVAssetWriter(outputURL: out, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true   // "faststart": index at the front of the file
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: w, AVVideoHeightKey: h,
  AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 3_000_000, AVVideoMaxKeyFrameIntervalKey: 30,
                                    AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel]])
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
  kCVPixelBufferWidthKey as String: w, kCVPixelBufferHeightKey as String: h])
writer.add(input); writer.startWriting(); writer.startSession(atSourceTime: .zero)
let space = CGColorSpaceCreateDeviceRGB()
let glow = CGGradient(colorsSpace: space, colors: [CGColor(red: 0.55, green: 0.9, blue: 0.85, alpha: 0.22),
                                                    CGColor(red: 0.55, green: 0.9, blue: 0.85, alpha: 0)] as CFArray,
                      locations: [0, 1])!
for n in 0..<frames {
  while !input.isReadyForMoreMediaData { usleep(1000) }
  var pb: CVPixelBuffer?; CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
  CVPixelBufferLockBaseAddress(pb!, [])
  let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pb!), width: w, height: h, bitsPerComponent: 8,
                      bytesPerRow: CVPixelBufferGetBytesPerRow(pb!), space: space,
                      bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
  ctx.draw(still, in: CGRect(x: 0, y: 0, width: w, height: h))
  let t = Double(n) / Double(frames) * 2 * Double.pi          // one full circle per loop
  let c = CGPoint(x: Double(w) * (0.5 + 0.28 * cos(t)), y: Double(h) * (0.5 + 0.22 * sin(t)))
  ctx.setBlendMode(.screen)
  ctx.drawRadialGradient(glow, startCenter: c, startRadius: 0, endCenter: c, endRadius: 700, options: [])
  CVPixelBufferUnlockBaseAddress(pb!, [])
  adaptor.append(pb!, withPresentationTime: CMTime(value: CMTimeValue(n), timescale: fps))
}
input.markAsFinished()
let done = DispatchSemaphore(value: 0); writer.finishWriting { done.signal() }; done.wait()
print(writer.status == .completed ? "wrote \(a[2])" : "failed \(String(describing: writer.error))")
