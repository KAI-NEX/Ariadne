import AppKit
import Foundation
import Vision

struct OCRResult: Encodable {
    let text: String
    let line_count: Int
}

guard CommandLine.arguments.count == 2,
      let image = NSImage(contentsOfFile: CommandLine.arguments[1]),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    FileHandle.standardError.write(Data("invalid_image\n".utf8))
    exit(2)
}

var recognized: [String] = []
let request = VNRecognizeTextRequest { request, error in
    guard error == nil else { return }
    let observations = request.results as? [VNRecognizedTextObservation] ?? []
    recognized = observations.compactMap { $0.topCandidates(1).first?.string }
}
request.recognitionLevel = .accurate
request.recognitionLanguages = ["zh-Hans", "en-US"]
request.usesLanguageCorrection = true

do {
    try VNImageRequestHandler(cgImage: cgImage).perform([request])
    let data = try JSONEncoder().encode(OCRResult(text: recognized.joined(separator: "\n"), line_count: recognized.count))
    FileHandle.standardOutput.write(data)
} catch {
    FileHandle.standardError.write(Data("vision_ocr_failed\n".utf8))
    exit(1)
}
