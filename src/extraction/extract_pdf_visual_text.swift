import AppKit
import Foundation
import PDFKit
import Vision

struct Page: Encodable {
    let page: Int
    let lines: [String]
    let blocks: [OCRBlock]
}

struct OCRBlock: Encodable {
    let text: String
    let confidence: Float
    let x: Float
    let y: Float
    let width: Float
    let height: Float
}

struct Result: Encodable {
    let config: String
    let pages: [Page]
}

guard CommandLine.arguments.count >= 2,
      let document = PDFDocument(url: URL(fileURLWithPath: CommandLine.arguments[1])) else {
    FileHandle.standardError.write(Data("invalid_pdf\n".utf8))
    exit(2)
}

let config = CommandLine.arguments.count >= 3 ? CommandLine.arguments[2] : "VISION_V0_CURRENT"
let selectedPages: Set<Int>? = CommandLine.arguments.count >= 4
    ? Set(CommandLine.arguments[3].split(separator: ",").compactMap { Int($0) })
    : nil

let genericCareerWords = [
    "AI", "Product Manager", "Product Designer", "Career Evidence", "Work Experience",
    "Portfolio", "JavaScript", "TypeScript", "Python", "React", "Figma", "Rhino",
    "Grasshopper", "AnyLogic", "Unreal Engine", "MVP", "OCR", "RCA"
]

func textBlocks(for page: PDFPage) throws -> [OCRBlock] {
    let image = page.thumbnail(of: NSSize(width: 1800, height: 2400), for: .mediaBox)
    guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        return []
    }
    var observations: [VNRecognizedTextObservation] = []
    let request = VNRecognizeTextRequest { request, error in
        guard error == nil else { return }
        observations = request.results as? [VNRecognizedTextObservation] ?? []
    }
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    switch config {
    case "VISION_V1_AUTO":
        request.automaticallyDetectsLanguage = true
    case "VISION_V3_CUSTOM":
        request.recognitionLanguages = ["zh-Hans", "en-US"]
        request.customWords = genericCareerWords
    case "VISION_V4_SMALL_TEXT":
        request.recognitionLanguages = ["zh-Hans", "en-US"]
        request.customWords = genericCareerWords
        request.minimumTextHeight = 0.005
    default:
        // V0 is the exact production configuration. V2 is the explicit-
        // language ablation and intentionally matches V0 so the benchmark can
        // prove whether the current setting is already optimal.
        request.recognitionLanguages = ["zh-Hans", "en-US"]
    }
    try VNImageRequestHandler(cgImage: cgImage).perform([request])
    return observations.compactMap { observation -> OCRBlock? in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        let text = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return nil }
        let box = observation.boundingBox
        return OCRBlock(text: text, confidence: candidate.confidence, x: Float(box.minX), y: Float(box.minY), width: Float(box.width), height: Float(box.height))
    }.sorted {
        let vertical = abs(($0.y + $0.height / 2) - ($1.y + $1.height / 2))
        return vertical > 0.025 ? $0.y > $1.y : $0.x < $1.x
    }
}

do {
    let pageIndices = (0..<document.pageCount).filter { selectedPages == nil || selectedPages!.contains($0 + 1) }
    let pages = try pageIndices.map { index in
        let blocks = try textBlocks(for: document.page(at: index)!)
        return Page(page: index + 1, lines: blocks.map(\.text), blocks: blocks)
    }
    FileHandle.standardOutput.write(try JSONEncoder().encode(Result(config: config, pages: pages)))
} catch {
    FileHandle.standardError.write(Data("pdf_visual_ocr_failed\n".utf8))
    exit(1)
}
