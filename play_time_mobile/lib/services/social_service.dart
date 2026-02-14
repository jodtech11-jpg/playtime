import 'package:cloud_firestore/cloud_firestore.dart';

class SocialService {
  static final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  /// Like or unlike a post
  static Future<void> toggleLike(String postId, String userId) async {
    try {
      final postRef = _firestore.collection('posts').doc(postId);
      final likeRef = _firestore
          .collection('posts')
          .doc(postId)
          .collection('likes')
          .doc(userId);

      await _firestore.runTransaction((transaction) async {
        final postDoc = await transaction.get(postRef);
        if (!postDoc.exists) {
          throw Exception('Post not found');
        }

        final likeDoc = await transaction.get(likeRef);
        final currentLikes = (postDoc.data()?['likes'] as num?)?.toInt() ?? 0;

        if (likeDoc.exists) {
          // Unlike: Remove like document and decrement count
          transaction.delete(likeRef);
          transaction.update(postRef, {
            'likes': FieldValue.increment(-1),
            'updatedAt': FieldValue.serverTimestamp(),
          });
        } else {
          // Like: Create like document and increment count
          transaction.set(likeRef, {
            'userId': userId,
            'createdAt': FieldValue.serverTimestamp(),
          });
          transaction.update(postRef, {
            'likes': FieldValue.increment(1),
            'updatedAt': FieldValue.serverTimestamp(),
          });
        }
      });
    } catch (e) {
      if (e.toString().contains('permission-denied')) {
        print('Firestore Permission Denied: You may not have permission to update the "posts" collection or the "likes" subcollection.');
        print('Check your Firestore Security Rules for "posts" and "posts/{postId}/likes".');
      }
      print('Error toggling like: $e');
      rethrow;
    }
  }

  /// Check if user has liked a post
  static Future<bool> hasUserLiked(String postId, String userId) async {
    try {
      final likeDoc = await _firestore
          .collection('posts')
          .doc(postId)
          .collection('likes')
          .doc(userId)
          .get();
      return likeDoc.exists;
    } catch (e) {
      print('Error checking like status: $e');
      return false;
    }
  }

  /// Get all users who liked a post
  static Stream<List<String>> getPostLikesStream(String postId) {
    return _firestore
        .collection('posts')
        .doc(postId)
        .collection('likes')
        .snapshots()
        .map((snapshot) => snapshot.docs.map((doc) => doc.id).toList());
  }

  /// Add a comment to a post
  static Future<String> addComment({
    required String postId,
    required String userId,
    required String userName,
    required String userAvatar,
    required String content,
  }) async {
    try {
      final commentRef = _firestore
          .collection('posts')
          .doc(postId)
          .collection('comments')
          .doc();

      await _firestore.runTransaction((transaction) async {
        final postRef = _firestore.collection('posts').doc(postId);
        final postDoc = await transaction.get(postRef);
        
        if (!postDoc.exists) {
          throw Exception('Post not found');
        }

        final currentComments = postDoc.data()?['comments'] as int? ?? 0;

        // Create comment
        transaction.set(commentRef, {
          'userId': userId,
          'userName': userName,
          'userAvatar': userAvatar,
          'content': content,
          'createdAt': FieldValue.serverTimestamp(),
          'updatedAt': FieldValue.serverTimestamp(),
        });

        // Increment comment count
        transaction.update(postRef, {
          'comments': FieldValue.increment(1),
          'updatedAt': FieldValue.serverTimestamp(),
        });
      });

      return commentRef.id;
    } catch (e) {
      print('Error adding comment: $e');
      rethrow;
    }
  }

  /// Get comments for a post
  static Stream<List<Map<String, dynamic>>> getPostCommentsStream(String postId) {
    return _firestore
        .collection('posts')
        .doc(postId)
        .collection('comments')
        .orderBy('createdAt', descending: false)
        .snapshots()
        .map((snapshot) => snapshot.docs.map((doc) {
              final data = doc.data();
              return {
                'id': doc.id,
                ...data,
              };
            }).toList());
  }

  /// Delete a comment
  static Future<void> deleteComment(String postId, String commentId, String userId) async {
    try {
      final commentRef = _firestore
          .collection('posts')
          .doc(postId)
          .collection('comments')
          .doc(commentId);

      await _firestore.runTransaction((transaction) async {
        final commentDoc = await transaction.get(commentRef);
        if (!commentDoc.exists) {
          throw Exception('Comment not found');
        }

        final commentData = commentDoc.data()!;
        if (commentData['userId'] != userId) {
          throw Exception('Not authorized to delete this comment');
        }

        final postRef = _firestore.collection('posts').doc(postId);
        final postDoc = await transaction.get(postRef);
        final currentComments = postDoc.data()?['comments'] as int? ?? 0;

        // Delete comment
        transaction.delete(commentRef);

        // Decrement comment count
        transaction.update(postRef, {
          'comments': FieldValue.increment(-1),
          'updatedAt': FieldValue.serverTimestamp(),
        });
      });
    } catch (e) {
      print('Error deleting comment: $e');
      rethrow;
    }
  }

  /// Get comment count for a post
  static Future<int> getCommentCount(String postId) async {
    try {
      final snapshot = await _firestore
          .collection('posts')
          .doc(postId)
          .collection('comments')
          .count()
          .get();
      return snapshot.count ?? 0;
    } catch (e) {
      print('Error getting comment count: $e');
      return 0;
    }
  }

  /// Get like count for a post
  static Future<int> getLikeCount(String postId) async {
    try {
      final snapshot = await _firestore
          .collection('posts')
          .doc(postId)
          .collection('likes')
          .count()
          .get();
      return snapshot.count ?? 0;
    } catch (e) {
      print('Error getting like count: $e');
      return 0;
    }
  }
}

