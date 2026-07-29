import 'dart:js_interop';

@JS('googleMapsReady')
external bool? get _googleMapsReady;

bool isGoogleMapsJsReady() => _googleMapsReady == true;
