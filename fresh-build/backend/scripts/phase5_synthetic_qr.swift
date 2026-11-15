import AppKit
import CoreImage
import Vision

let payee = "upi://pay?pa=synthetic@bank&pn=Synthetic%20Browser%20Fixture"
let output = "/private/tmp/masjid-phase5-qr-browser.png"
let generator = CIFilter(name: "CIQRCodeGenerator")!
generator.setValue(Data(payee.utf8), forKey: "inputMessage")
generator.setValue("H", forKey: "inputCorrectionLevel")
let image = generator.outputImage!.transformed(by: CGAffineTransform(scaleX: 8, y: 8))
let context = CIContext()
let cgImage = context.createCGImage(image, from: image.extent)!
let representation = NSBitmapImageRep(cgImage: cgImage)
try representation.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: output))
let request = VNDetectBarcodesRequest()
request.symbologies = [.qr]
try VNImageRequestHandler(cgImage: cgImage).perform([request])
guard request.results?.first?.payloadStringValue == payee else {
  fatalError("synthetic QR did not decode to the expected payee")
}
print("Synthetic QR decoded to expected UPI payee.")
