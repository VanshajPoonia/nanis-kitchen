// Decodes QR images with Apple's CoreImage detector, an encoder-independent check. macOS only.
// Usage: swift evals/qr-decode.swift <image>... prints one JSON string per line, or null.
import CoreImage
import Foundation

let detector = CIDetector(ofType: CIDetectorTypeQRCode, context: nil, options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])!
for path in CommandLine.arguments.dropFirst() {
    guard let image = CIImage(contentsOf: URL(fileURLWithPath: path)) else {
        print("null")
        continue
    }
    let text = detector.features(in: image).compactMap { ($0 as? CIQRCodeFeature)?.messageString }.first
    let json = try! JSONSerialization.data(withJSONObject: [text as Any? ?? NSNull()])
    print(String(data: json, encoding: .utf8)!.dropFirst().dropLast())
}
