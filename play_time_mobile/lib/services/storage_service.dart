import 'dart:io' show File;
import 'dart:typed_data';
import 'package:image_picker/image_picker.dart' show XFile;
import 'package:firebase_storage/firebase_storage.dart';

class StorageService {
  static final FirebaseStorage _storage = FirebaseStorage.instance;

  /// Upload profile image to Firebase Storage
  static Future<String> uploadProfileImage(dynamic image, String userId) async {
    try {
      final ref = _storage.ref().child('users/$userId/avatar/${DateTime.now().millisecondsSinceEpoch}.jpg');
      
      final SettableMetadata metadata = SettableMetadata(
        contentType: 'image/jpeg',
        customMetadata: {
          'uploadedBy': userId,
          'uploadedAt': DateTime.now().toIso8601String(),
        },
      );

      UploadTask uploadTask;
      if (image is Uint8List) {
        uploadTask = ref.putData(image, metadata);
      } else if (image is XFile) {
        final bytes = await image.readAsBytes();
        uploadTask = ref.putData(bytes, metadata);
      } else if (image is File) {
        uploadTask = ref.putFile(image, metadata);
      } else {
        throw ArgumentError('Image must be Uint8List, XFile, or File');
      }

      final snapshot = await uploadTask;
      return await snapshot.ref.getDownloadURL();
    } catch (e) {
      print('Error uploading profile image: $e');
      rethrow;
    }
  }

  /// Upload image with progress tracking
  static Future<String> uploadImageWithProgress(
    dynamic image,
    String path, {
    Function(double progress)? onProgress,
  }) async {
    try {
      final ref = _storage.ref().child(path);
      final metadata = SettableMetadata(contentType: 'image/jpeg');
      
      UploadTask uploadTask;
      if (image is Uint8List) {
        uploadTask = ref.putData(image, metadata);
      } else if (image is XFile) {
        final bytes = await image.readAsBytes();
        uploadTask = ref.putData(bytes, metadata);
      } else if (image is File) {
        uploadTask = ref.putFile(image, metadata);
      } else {
        throw ArgumentError('Image must be Uint8List, XFile, or File');
      }

      // Listen to upload progress
      uploadTask.snapshotEvents.listen((TaskSnapshot snapshot) {
        final progress = snapshot.bytesTransferred / snapshot.totalBytes;
        if (onProgress != null) {
          onProgress(progress);
        }
      });

      final snapshot = await uploadTask;
      return await snapshot.ref.getDownloadURL();
    } catch (e) {
      print('Error uploading image: $e');
      rethrow;
    }
  }

  /// Delete image from Firebase Storage
  static Future<void> deleteImage(String imageUrl) async {
    try {
      final ref = _storage.refFromURL(imageUrl);
      await ref.delete();
    } catch (e) {
      print('Error deleting image: $e');
      // Don't rethrow - deletion failure shouldn't break the flow
    }
  }

  /// Upload post image (for social feed)
  static Future<String> uploadPostImage(dynamic image, String postId) async {
    try {
      final ref = _storage.ref().child('posts/$postId/${DateTime.now().millisecondsSinceEpoch}.jpg');
      final metadata = SettableMetadata(contentType: 'image/jpeg');
      
      UploadTask uploadTask;
      if (image is Uint8List) {
        uploadTask = ref.putData(image, metadata);
      } else if (image is XFile) {
        final bytes = await image.readAsBytes();
        uploadTask = ref.putData(bytes, metadata);
      } else if (image is File) {
        uploadTask = ref.putFile(image, metadata);
      } else {
        throw ArgumentError('Image must be Uint8List, XFile, or File');
      }

      final snapshot = await uploadTask;
      return await snapshot.ref.getDownloadURL();
    } catch (e) {
      print('Error uploading post image: $e');
      rethrow;
    }
  }

  /// Upload venue image
  static Future<String> uploadVenueImage(dynamic image, String venueId) async {
    try {
      final ref = _storage.ref().child('venues/$venueId/${DateTime.now().millisecondsSinceEpoch}.jpg');
      final metadata = SettableMetadata(contentType: 'image/jpeg');
      
      UploadTask uploadTask;
      if (image is Uint8List) {
        uploadTask = ref.putData(image, metadata);
      } else if (image is XFile) {
        final bytes = await image.readAsBytes();
        uploadTask = ref.putData(bytes, metadata);
      } else if (image is File) {
        uploadTask = ref.putFile(image, metadata);
      } else {
        throw ArgumentError('Image must be Uint8List, XFile, or File');
      }

      final snapshot = await uploadTask;
      return await snapshot.ref.getDownloadURL();
    } catch (e) {
      print('Error uploading venue image: $e');
      rethrow;
    }
  }

  /// Upload product image
  static Future<String> uploadProductImage(dynamic image, String productId) async {
    try {
      final ref = _storage.ref().child('products/$productId/${DateTime.now().millisecondsSinceEpoch}.jpg');
      final metadata = SettableMetadata(contentType: 'image/jpeg');
      
      UploadTask uploadTask;
      if (image is Uint8List) {
        uploadTask = ref.putData(image, metadata);
      } else if (image is XFile) {
        final bytes = await image.readAsBytes();
        uploadTask = ref.putData(bytes, metadata);
      } else if (image is File) {
        uploadTask = ref.putFile(image, metadata);
      } else {
        throw ArgumentError('Image must be Uint8List, XFile, or File');
      }

      final snapshot = await uploadTask;
      return await snapshot.ref.getDownloadURL();
    } catch (e) {
      print('Error uploading product image: $e');
      rethrow;
    }
  }
}

