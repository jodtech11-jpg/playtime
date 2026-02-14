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
  String? _error;
  StreamSubscription<List<MatchFeedItem>>? _feedSubscription;
  DocumentSnapshot<Map<String, dynamic>>? _lastDocument;
  static const int _pageSize = 20;

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
    _feedItems = [];
    notifyListeners();

    _feedSubscription?.cancel();
    _feedSubscription = FirestoreService.getFeedItemsStream().listen(
      (items) {
        _feedItems = items;
        _isLoading = false;
        _hasMore = items.length >= _pageSize;
        notifyListeners();
      },
      onError: (error) {
        _error = 'Failed to load feed: $error';
        _isLoading = false;
        notifyListeners();
      },
    );
  }

  Future<void> loadMoreFeedItems() async {
    if (_isLoadingMore || !_hasMore) return;

    _isLoadingMore = true;
    notifyListeners();

    try {
      final items = await FirestoreService.getFeedItems(
        limit: _pageSize,
        startAfter: _lastDocument,
      );

      if (items.isNotEmpty) {
        _feedItems.addAll(items);
        _hasMore = items.length >= _pageSize;
        // Store last document for next pagination - get from the query result
        final querySnapshot = await FirebaseFirestore.instance
            .collection('posts')
            .where('status', isEqualTo: 'Approved')
            .orderBy('createdAt', descending: true)
            .limit(_feedItems.length)
            .get();
        if (querySnapshot.docs.length >= _feedItems.length) {
          _lastDocument = querySnapshot.docs[_feedItems.length - 1];
        } else {
          _hasMore = false;
        }
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

