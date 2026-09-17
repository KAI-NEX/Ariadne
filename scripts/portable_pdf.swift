// Complete-page PDF renderer for the portable macOS distribution.
// Implements only the exact pdftoppm argument shape used by pdf_delivery.py.
import Foundation
import AppKit
import PDFKit

let args = Array(CommandLine.arguments.dropFirst())
guard args.count == 7, Array(args.prefix(5)) == ["-jpeg", "-r", "120", "-jpegopt", "quality=82"],
      let document = PDFDocument(url: URL(fileURLWithPath: args[5])),
      !document.isLocked, document.pageCount > 0 else {
    fputs("pdf_render_invalid_input\n", stderr); exit(1)
}
for index in 0..<document.pageCount {
    autoreleasepool {
        guard let page = document.page(at: index) else { exit(2) }
        let bounds = page.bounds(for: .mediaBox)
        let scale = 120.0 / 72.0
        let rotated = page.rotation % 180 != 0
        let width = Int(ceil((rotated ? bounds.height : bounds.width) * scale))
        let height = Int(ceil((rotated ? bounds.width : bounds.height) * scale))
        guard width > 0, height > 0, width * height <= 50_000_000,
              let pageRef = page.pageRef,
              let context = CGContext(data: nil, width: width, height: height,
                bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { exit(3) }
        let rect = CGRect(x: 0, y: 0, width: width, height: height)
        context.setFillColor(CGColor(gray: 1, alpha: 1))
        context.fill(rect)
        context.concatenate(pageRef.getDrawingTransform(.mediaBox, rect: rect, rotate: 0, preserveAspectRatio: true))
        context.drawPDFPage(pageRef)
        guard let image = context.makeImage() else { exit(4) }
        let bitmap = NSBitmapImageRep(cgImage: image)
        guard let data = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.82]) else { exit(4) }
        do { try data.write(to: URL(fileURLWithPath: "\(args[6])-\(index + 1).jpg")) }
        catch { exit(5) }
    }
}
