import Flutter
import GoogleMaps
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    let bundledKey = Bundle.main.object(
      forInfoDictionaryKey: "GoogleMapsAPIKey"
    ) as? String
    let mapsKey: String
    if let bundledKey,
      !bundledKey.isEmpty,
      bundledKey != "$(GOOGLE_MAPS_API_KEY)" {
      mapsKey = bundledKey
    } else {
      // Fallback when MapsSecrets.xcconfig is missing from the local/CI build.
      mapsKey = "AIzaSyCLJKxLWvRyPakKliBRNjShZ0xD31tTs4E"
    }
    GMSServices.provideAPIKey(mapsKey)
    GeneratedPluginRegistrant.register(with: self)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
