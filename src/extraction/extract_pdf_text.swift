import Foundation
import PDFKit

guard CommandLine.arguments.count == 2 else {
    FileHandle.standardError.write(Data("usage: extract_pdf_text.swift <pdf>\n".utf8))
    exit(2)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
guard let document = PDFDocument(url: inputURL) else {
    FileHandle.standardError.write(Data("pdf_open_failed\n".utf8))
    exit(3)
}

var pages: [[String: Any]] = []
for index in 0..<document.pageCount {
    guard let page = document.page(at: index) else { continue }
    let mediaBounds = page.bounds(for: .mediaBox)
    var blocks: [[String: Any]] = []
    if let pageSelection = page.selection(for: mediaBounds) {
        for lineSelection in pageSelection.selectionsByLine() {
            let text = (lineSelection.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { continue }
            let bounds = lineSelection.bounds(for: page)
            blocks.append([
                "text": text,
                "confidence": 1.0,
                "x": max(0.0, min(1.0, bounds.minX / mediaBounds.width)),
                "y": max(0.0, min(1.0, bounds.minY / mediaBounds.height)),
                "width": max(0.0, min(1.0, bounds.width / mediaBounds.width)),
                "height": max(0.0, min(1.0, bounds.height / mediaBounds.height)),
            ])
        }
    }
    let lines = blocks.isEmpty
        ? (page.string ?? "")
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        : blocks.compactMap { $0["text"] as? String }
    pages.append([
        "page": index + 1,
        "lines": lines,
        "blocks": blocks,
        "source_method": "native_pdf",
    ])
}

let payload: [String: Any] = [
    "page_count": document.pageCount,
    "pages": pages,
]
let output = try JSONSerialization.data(withJSONObject: payload, options: [])
FileHandle.standardOutput.write(output)
