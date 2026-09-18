// Generate the app icon from the existing VI palette and Chinese wordmark.
import AppKit
let manifestURL = URL(fileURLWithPath: CommandLine.arguments[1])
let output = URL(fileURLWithPath: CommandLine.arguments[2])
let manifest = try JSONSerialization.jsonObject(with: Data(contentsOf: manifestURL)) as! [String: Any]
let tokens = manifest["tokens"] as! [[String: Any]]
func color(_ name: String) -> NSColor {
    let hex = (tokens.first { $0["name"] as? String == name }!["value"] as! String).dropFirst()
    let expanded = hex.count == 3 ? hex.map { "\($0)\($0)" }.joined() : String(hex)
    let value = UInt32(expanded, radix: 16)!
    return NSColor(srgbRed: CGFloat((value >> 16) & 255) / 255, green: CGFloat((value >> 8) & 255) / 255, blue: CGFloat(value & 255) / 255, alpha: 1)
}
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
for base in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let size = base * scale
        let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
        let side = CGFloat(size)
        color("--vi-action").setFill()
        NSBezierPath(roundedRect: NSRect(x: side * 0.06, y: side * 0.06, width: side * 0.88, height: side * 0.88), xRadius: side * 0.20, yRadius: side * 0.20).fill()
        let mark = (manifest["brand"] as! [String: String])["zh"]! as NSString
        let attributes: [NSAttributedString.Key: Any] = [.font: NSFont(name: "PingFangSC-Semibold", size: side * 0.55) ?? NSFont.systemFont(ofSize: side * 0.55, weight: .semibold), .foregroundColor: color("--vi-surface")]
        let measured = mark.size(withAttributes: attributes)
        mark.draw(at: NSPoint(x: (side - measured.width) / 2, y: (side - measured.height) / 2), withAttributes: attributes)
        NSGraphicsContext.restoreGraphicsState()
        let suffix = scale == 2 ? "@2x" : ""
        try bitmap.representation(using: .png, properties: [:])!.write(to: output.appendingPathComponent("icon_\(base)x\(base)\(suffix).png"))
    }
}
