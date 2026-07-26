import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/match_feed_item.dart';
import '../services/firestore_service.dart';

class FeedProvider with ChangeNotifier {
  List<MatchFeedItem> _feedItems = [];
  bool _isLoading = false;
  bool _isLoadingMore = false;
  bool _hasMore = true;

  /// Cursor for `startAfter` pagination; resolved asynchronously after each stream emission.
  bool _paginationCursorReady = false;
  String? _error;
  StreamSubscription<List<MatchFeedItem>>? _feedSubscription;
  DocumentSnapshot<Map<String, dynamic>>? _lastDocument;

  List<MatchFeedItem> get feedItems => _feedItems;
  bool get isLoading => _isLoading;
  bool get isLoadingMore => _isLoadingMore;
  bool get hasMore => _hasMore;
  String? get error => _error;

  FeedProvider() {
    loadFeedItems();
  }

  void loadFeedItems() {
    _isLoading = true;
    _error = null;
    _hasMore = true;
    _lastDocument = null;
    _paginationCursorReady = false;
    _feedItems = [];
    notifyListeners();

    _feedSubscription?.cancel();
    _feedSubscription = FirestoreService.getFeedItemsStream().listen(
      (items) {
        _paginationCursorReady = false;
        _feedItems = items;
        _isLoading = false;
        final approvedItems = items
            .where((item) => !item.isPendingReview)
            .toList();
        _hasMore = approvedItems.length >= FirestoreService.feedPageSize;
        notifyListeners();

        if (items.isEmpty) {
          _lastDocument = null;
          _paginationCursorReady = true;
          notifyListeners();
          return;
        }

        final cursorItem = approvedItems.isEmpty ? null : approvedItems.last;
        if (cursorItem == null) {
          _lastDocument = null;
          _paginationCursorReady = true;
          notifyListeners();
          return;
        }

        FirebaseFirestore.instance
            .collection('posts')
            .doc(cursorItem.id)
            .get()
            .then((doc) {
              _lastDocument = doc;
              _paginationCursorReady = true;
              notifyListeners();
            })
            .catchError((Object e) {
              debugPrint('Feed pagination cursor failed: $e');
              _lastDocument = null;
              _paginationCursorReady = false;
              notifyListeners();
            });
      },
      onError: (error) {
        _error = 'Failed to load feed: $error';
        _isLoading = false;
        _paginationCursorReady = false;
        notifyListeners();
      },
    );
  }

  Future<void> loadMoreFeedItems() async {
    if (_isLoadingMore || !_hasMore || !_paginationCursorReady) return;

    _isLoadingMore = true;
    notifyListeners();

    try {
      final items = await FirestoreService.getFeedItems(
        limit: FirestoreService.feedPageSize,
        startAfter: _lastDocument,
      );

      if (items.isNotEmpty) {
        _feedItems.addAll(items);
        _hasMore = items.length >= FirestoreService.feedPageSize;
        // Fetch only the last item's document as cursor for next page (O(1) instead of O(n))
        final lastDoc = await FirebaseFirestore.instance
            .collection('posts')
            .doc(items.last.id)
            .get();
        _lastDocument = lastDoc;
      } else {
        _hasMore = false;
      }
    } catch (e) {
      _error = 'Failed to load more items: $e';
    } finally {
      _isLoadingMore = false;
      notifyListeners();
    }
  }

  Future<void> refreshFeed() async {
    loadFeedItems();
  }

  @override
  void dispose() {
    _feedSubscription?.cancel();
    super.dispose();
  }
}
