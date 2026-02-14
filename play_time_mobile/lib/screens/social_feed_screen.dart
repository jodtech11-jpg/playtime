import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:share_plus/share_plus.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'dart:async';
import '../theme/app_colors.dart';
import '../widgets/bottom_nav.dart';
import '../providers/booking_provider.dart';
import '../providers/feed_provider.dart';
import '../providers/venue_provider.dart';
import '../models/match_feed_item.dart';
import '../models/booking.dart';
import '../services/social_service.dart';
import '../services/firestore_service.dart';
import '../widgets/loading_widget.dart';
import '../widgets/error_widget.dart';
import '../widgets/create_post_modal.dart';

class SocialFeedScreen extends StatefulWidget {
  const SocialFeedScreen({super.key});

  @override
  State<SocialFeedScreen> createState() => _SocialFeedScreenState();
}

class _SocialFeedScreenState extends State<SocialFeedScreen> {
  int _selectedChip = 0;
  final Map<String, bool> _likedPosts = {};
  final Map<String, int> _postLikes = {};
  final Map<String, int> _postComments = {};
  final Map<String, List<Map<String, dynamic>>> _postCommentsList = {};
  final Map<String, bool> _showComments = {};
  final Map<String, TextEditingController> _commentControllers = {};
  final Map<String, StreamSubscription> _commentSubscriptions = {};

  // _postContentController and _isCreatingPost removed as they are now handled in CreatePostModal
  String _sortBy = 'recent'; // 'recent', 'likes', 'comments'
  String? _filterSport;
  final Set<String> _hiddenPosts = {}; // Track hidden posts

  @override
  void initState() {
    super.initState();
    // Load like statuses after first frame when feed is loaded
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadLikeStatuses();
    });
  }

  @override
  void dispose() {
    for (var controller in _commentControllers.values) {
      controller.dispose();
    }
    for (var subscription in _commentSubscriptions.values) {
      subscription.cancel();
    }
    for (var subscription in _commentSubscriptions.values) {
      subscription.cancel();
    }
    super.dispose();
  }

  Future<void> _loadLikeStatuses() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    final feedProvider = Provider.of<FeedProvider>(context, listen: false);
    for (final item in feedProvider.feedItems) {
      if (!_likedPosts.containsKey(item.id)) {
        final hasLiked = await SocialService.hasUserLiked(item.id, user.uid);
        if (mounted) {
          setState(() {
            _likedPosts[item.id] = hasLiked;
            _postLikes[item.id] = item.likes;
            _postComments[item.id] = item.comments;
          });
        }
      }
    }
  }
  
  void _loadLikeStatusForNewPosts(List<MatchFeedItem> items) {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    
    // Batch load like statuses to avoid too many setState calls
    final itemsToLoad = items.where((item) => !_likedPosts.containsKey(item.id)).toList();
    if (itemsToLoad.isEmpty) return;
    
    // Load all at once
    Future.wait(
      itemsToLoad.map((item) => SocialService.hasUserLiked(item.id, user.uid)),
    ).then((results) {
      if (mounted) {
        setState(() {
          for (int i = 0; i < itemsToLoad.length; i++) {
            final item = itemsToLoad[i];
            final hasLiked = results[i];
            _likedPosts[item.id] = hasLiked;
            _postLikes[item.id] = item.likes;
            _postComments[item.id] = item.comments;
          }
        });
      }
    }).catchError((error) {
      print('Error loading like statuses: $error');
    });
  }

  Future<void> _handleLike(String postId) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please login to like posts'),
            backgroundColor: AppColors.error,
          ),
        );
      }
      return;
    }

    // Store original state before toggle
    final wasLiked = _likedPosts[postId] ?? false;
    final originalLikeCount = _postLikes[postId] ?? 0;

    // Optimistic update
    if (mounted) {
      setState(() {
        _likedPosts[postId] = !wasLiked;
        _postLikes[postId] = originalLikeCount + (wasLiked ? -1 : 1);
      });
    }

    try {
      await SocialService.toggleLike(postId, user.uid);

      // Refresh like count from server
      final likeCount = await SocialService.getLikeCount(postId);
      if (mounted) {
        setState(() {
          _postLikes[postId] = likeCount;
        });
      }
    } catch (e) {
      // Revert on error - restore original state
      if (mounted) {
        setState(() {
          _likedPosts[postId] = wasLiked;
          _postLikes[postId] = originalLikeCount;
        });
        ErrorSnackbar.show(context, 'Failed to like post: $e');
      }
    }
  }

  Future<void> _handleComment(String postId) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      if (mounted) {
        ErrorSnackbar.show(context, 'Please login to comment');
      }
      return;
    }

    setState(() {
      _showComments[postId] = !(_showComments[postId] ?? false);
      if (_showComments[postId] == true && !_commentControllers.containsKey(postId)) {
        _commentControllers[postId] = TextEditingController();
      }
    });

    // Load comments if showing
    if (_showComments[postId] == true) {
      // Cancel existing subscription if any
      _commentSubscriptions[postId]?.cancel();
      
      _commentSubscriptions[postId] = SocialService.getPostCommentsStream(postId).listen((comments) {
        if (mounted) {
          setState(() {
            _postCommentsList[postId] = comments;
            _postComments[postId] = comments.length;
          });
        }
      });
    } else {
      // Cancel subscription when hiding comments
      _commentSubscriptions[postId]?.cancel();
      _commentSubscriptions.remove(postId);
    }
  }
  
  Future<void> _submitComment(String postId) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    
    final controller = _commentControllers[postId];
    if (controller == null || controller.text.trim().isEmpty) return;
    
    try {
      final userProfile = await FirestoreService.getUserProfile(user.uid);
      final userName = user.displayName ?? 
          userProfile?['name'] ?? 
          user.email?.split('@').first ?? 
          'User';
      final userAvatar = user.photoURL ?? userProfile?['photoURL'] ?? '';
      
      await SocialService.addComment(
        postId: postId,
        userId: user.uid,
        userName: userName,
        userAvatar: userAvatar,
        content: controller.text.trim(),
      );
      
      controller.clear();
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Comment added'),
            backgroundColor: AppColors.success,
            duration: Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to add comment: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }
  
  Future<void> _sharePost(MatchFeedItem item) async {
    try {
      final shareText = '${item.title}\n\n${item.description}\n\nShared from PlayTime';
      await Share.share(shareText);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to share: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }
  
  Future<void> _reportPost(String postId) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please login to report posts'),
            backgroundColor: AppColors.error,
          ),
        );
      }
      return;
    }
    
    try {
      await FirebaseFirestore.instance.collection('reports').add({
        'postId': postId,
        'userId': user.uid,
        'type': 'post',
        'reason': 'Inappropriate content',
        'status': 'Pending',
        'createdAt': FieldValue.serverTimestamp(),
      });
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Post reported. Thank you for your feedback.'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to report post: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }
  
  void _unhidePost(String postId) {
    setState(() {
      _hiddenPosts.remove(postId);
    });
  }

  Future<void> _hidePost(String postId) async {
    setState(() {
      _hiddenPosts.add(postId);
    });
    
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Post hidden'),
          backgroundColor: AppColors.primary,
          action: SnackBarAction(
            label: 'UNDO',
            textColor: AppColors.backgroundDark,
            onPressed: () => _unhidePost(postId),
          ),
        ),
      );
    }
  }


  String _getSportIcon(String sport) {
    switch (sport.toLowerCase()) {
      case 'football':
        return 'sports_soccer';
      case 'cricket':
        return 'sports_cricket';
      case 'badminton':
        return 'sports_tennis';
      default:
        return 'sports_basketball';
    }
  }

  Future<void> _showCreatePostModal() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please login to create a post'),
            backgroundColor: AppColors.error,
          ),
        );
      }
      return;
    }

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => CreatePostModal(user: user),
    );
  }



  @override
  Widget build(BuildContext context) {
    final bookingProvider = Provider.of<BookingProvider>(context);
    final venueProvider = Provider.of<VenueProvider>(context);
    final upcomingBookings = bookingProvider.getUpcomingBookings();
    final selectedVenue = venueProvider.venues.isNotEmpty ? venueProvider.venues.first : null;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) {
          if (Navigator.canPop(context)) {
            context.pop();
          } else {
            context.go('/home');
          }
        }
      },
      child: Scaffold(
        backgroundColor: AppColors.backgroundDark,
        body: SafeArea(
        child: Column(
          children: [
            // Header
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.backgroundDark.withOpacity(0.95),
                border: Border(
                  bottom: BorderSide(color: Colors.white.withOpacity(0.05)),
                ),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      IconButton(
                        icon: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.05),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.arrow_back, color: Colors.white),
                        ),
                        onPressed: () {
                          if (Navigator.canPop(context)) {
                            context.pop();
                          } else {
                            context.go('/home');
                          }
                        },
                      ),
                      const Spacer(),
                      OutlinedButton(
                        onPressed: () {
                          // Show following/followers modal or navigate to following screen
                          _showFollowingModal();
                        },
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(
                            color: AppColors.primary.withOpacity(0.3),
                          ),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 8,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                          ),
                        ),
                        child: const Text(
                          'FOLLOWING',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontSize: 12,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1,
                          ),
                        ),
                      ),
                      PopupMenuButton<String>(
                        icon: const Icon(Icons.more_vert, color: Colors.white),
                        color: AppColors.surfaceDark,
                        onSelected: (value) {
                          switch (value) {
                            case 'filter':
                              _showFilterModal();
                              break;
                            case 'sort':
                              _showSortModal();
                              break;
                            case 'share':
                              _showShareOptions();
                              break;
                            case 'report':
                              _showReportOptions();
                              break;
                            case 'hide':
                              if (_hiddenPosts.isNotEmpty) {
                                setState(() {
                                  _hiddenPosts.clear();
                                });
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('All hidden posts restored'),
                                    backgroundColor: AppColors.success,
                                  ),
                                );
                              } else {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Use the menu on individual posts to hide them'),
                                    backgroundColor: AppColors.primary,
                                  ),
                                );
                              }
                              break;
                          }
                        },
                        itemBuilder: (context) => [
                          const PopupMenuItem(
                            value: 'filter',
                            child: Row(
                              children: [
                                Icon(Icons.filter_list, color: Colors.white, size: 20),
                                SizedBox(width: 12),
                                Text('Filter', style: TextStyle(color: Colors.white)),
                              ],
                            ),
                          ),
                          const PopupMenuItem(
                            value: 'sort',
                            child: Row(
                              children: [
                                Icon(Icons.sort, color: Colors.white, size: 20),
                                SizedBox(width: 12),
                                Text('Sort', style: TextStyle(color: Colors.white)),
                              ],
                            ),
                          ),
                          const PopupMenuItem(
                            value: 'share',
                            child: Row(
                              children: [
                                Icon(Icons.share, color: Colors.white, size: 20),
                                SizedBox(width: 12),
                                Text('Share', style: TextStyle(color: Colors.white)),
                              ],
                            ),
                          ),
                          const PopupMenuItem(
                            value: 'report',
                            child: Row(
                              children: [
                                Icon(Icons.flag, color: Colors.white, size: 20),
                                SizedBox(width: 12),
                                Text('Report', style: TextStyle(color: Colors.white)),
                              ],
                            ),
                          ),
                          PopupMenuItem(
                            value: 'hide',
                            child: Row(
                              children: [
                                Icon(
                                  _hiddenPosts.isNotEmpty ? Icons.visibility : Icons.visibility_off, 
                                  color: Colors.white, 
                                  size: 20
                                ),
                                const SizedBox(width: 12),
                                Text(
                                  _hiddenPosts.isNotEmpty ? 'Restore Hidden' : 'Hide Info', 
                                  style: const TextStyle(color: Colors.white)
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              selectedVenue?.name ?? 'Social Feed',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 28,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(height: 8),
                            if (selectedVenue != null)
                              Row(
                                children: [
                                  const Icon(Icons.location_on,
                                      color: AppColors.primary, size: 18),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      selectedVenue.address,
                                      style: TextStyle(
                                        color: AppColors.textSecondary,
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700,
                                        letterSpacing: 1,
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                          ],
                        ),
                      ),
                      if (selectedVenue?.image != null)
                        Container(
                          width: 56,
                          height: 56,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: AppColors.primary,
                              width: 2,
                            ),
                          ),
                          child: ClipOval(
                            child: Image.network(
                              selectedVenue!.image!,
                              fit: BoxFit.cover,
                              errorBuilder: (context, error, stackTrace) {
                                return Container(
                                  color: AppColors.surfaceDark,
                                  child: const Icon(Icons.image, color: Colors.grey),
                                );
                              },
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            // Stats
            Container(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceDark,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: Colors.white.withOpacity(0.05),
                        ),
                      ),
                      child: Column(
                        children: [
                          FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  selectedVenue != null 
                                    ? (selectedVenue.rating != null ? selectedVenue.rating!.toStringAsFixed(1) : 'NEW')
                                    : '0',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 24,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                const SizedBox(width: 4),
                                const Icon(Icons.star_rounded,
                                    color: AppColors.primary, size: 18),
                              ],
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'RATING',
                            style: TextStyle(
                              color: Colors.grey[500],
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceDark,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: Colors.white.withOpacity(0.05),
                        ),
                      ),
                      child: Column(
                        children: [
                          Text(
                            '0',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 24,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'PLAYERS',
                            style: TextStyle(
                              color: Colors.grey[500],
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceDark,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: Colors.white.withOpacity(0.05),
                        ),
                      ),
                      child: Consumer<FeedProvider>(
                        builder: (context, feedProvider, child) {
                          return Column(
                            children: [
                              Text(
                                '${feedProvider.feedItems.length}',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 24,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'POSTS',
                                style: TextStyle(
                                  color: Colors.grey[500],
                                  fontSize: 9,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 1.5,
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                    ),
                  ),
                ],
              ),
            ),
            // Chips
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              height: 36,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: 3,
                itemBuilder: (context, index) {
                  final labels = ['Recent Matches', 'Top Highlights', 'Upcoming'];
                  final isSelected = _selectedChip == index;
                  return Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: GestureDetector(
                      onTap: () => setState(() => _selectedChip = index),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 24,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? AppColors.primary
                              : AppColors.surfaceDark,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: isSelected
                                ? AppColors.primary
                                : Colors.white.withOpacity(0.05),
                          ),
                        ),
                        child: Text(
                          labels[index].toUpperCase(),
                          style: TextStyle(
                            color: isSelected
                                ? AppColors.backgroundDark
                                : Colors.grey[400],
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            // Feed
            Expanded(
              child: Consumer<FeedProvider>(
                builder: (context, feedProvider, child) {
                  if (feedProvider.isLoading) {
                    return const Center(
                      child: CircularProgressIndicator(),
                    );
                  }
                  
                  if (feedProvider.error != null) {
                    return Center(
                      child: Text(
                        feedProvider.error!,
                        style: const TextStyle(color: Colors.white),
                      ),
                    );
                  }
                  
                  if (feedProvider.feedItems.isEmpty) {
                    return const EmptyStateWidget(
                      icon: Icons.feed_outlined,
                      title: 'No feed items available',
                      message: 'Check back later for updates',
                    );
                  }
                  
                  // Filter out hidden posts first
                  var visibleItems = feedProvider.feedItems
                      .where((item) => !_hiddenPosts.contains(item.id))
                      .toList();
                  
                  // Filter and sort items
                  var filteredItems = _filterAndSortItems(visibleItems);
                  
                  // Load like statuses for new items (only once per item)
                  // Use a flag to prevent multiple calls
                  if (filteredItems.isNotEmpty) {
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (mounted) {
                        _loadLikeStatusForNewPosts(filteredItems);
                      }
                    });
                  }
                  
                  return ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: filteredItems.length + (feedProvider.hasMore ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index == filteredItems.length) {
                        // Load more trigger - use original feedItems length, not filtered
                        if (feedProvider.hasMore && !feedProvider.isLoadingMore) {
                          WidgetsBinding.instance.addPostFrameCallback((_) {
                            feedProvider.loadMoreFeedItems();
                          });
                        }
                        return feedProvider.isLoadingMore
                            ? const Padding(
                                padding: EdgeInsets.all(20),
                                child: Center(child: CircularProgressIndicator()),
                              )
                            : const SizedBox.shrink();
                      }
                      return _buildFeedItem(
                        filteredItems[index],
                        upcomingBookings,
                        bookingProvider,
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: const BottomNav(currentIndex: 2),
      floatingActionButton: FloatingActionButton(
        onPressed: _showCreatePostModal,
        backgroundColor: AppColors.primary,
        child: const Icon(
          Icons.add,
          color: AppColors.backgroundDark,
        ),
      ),
      ),
    );
  }

  Widget _buildFeedItem(
    MatchFeedItem item,
    List<Booking> upcomingBookings,
    BookingProvider bookingProvider,
  ) {
    return Container(
      margin: const EdgeInsets.only(bottom: 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        colors: [
                          AppColors.primary.withOpacity(0.8),
                          Colors.blue.withOpacity(0.8),
                        ],
                      ),
                      border: Border.all(
                        color: AppColors.backgroundDark,
                        width: 2,
                      ),
                    ),
                    child: const Center(
                      child: Text('⚽', style: TextStyle(fontSize: 18)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      Text(
                        item.time,
                        style: TextStyle(
                          color: Colors.grey[500],
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_horiz, color: Colors.grey),
                color: AppColors.surfaceDark,
                onSelected: (value) {
                  switch (value) {
                    case 'share':
                      _sharePost(item);
                      break;
                    case 'report':
                      _reportPost(item.id);
                      break;
                    case 'hide':
                      _hidePost(item.id);
                      break;
                  }
                },
                itemBuilder: (context) => [
                  const PopupMenuItem(
                    value: 'share',
                    child: Row(
                      children: [
                        Icon(Icons.share, color: Colors.white, size: 20),
                        SizedBox(width: 12),
                        Text('Share', style: TextStyle(color: Colors.white)),
                      ],
                    ),
                  ),
                  const PopupMenuItem(
                    value: 'report',
                    child: Row(
                      children: [
                        Icon(Icons.flag, color: Colors.white, size: 20),
                        SizedBox(width: 12),
                        Text('Report', style: TextStyle(color: Colors.white)),
                      ],
                    ),
                  ),
                  const PopupMenuItem(
                    value: 'hide',
                    child: Row(
                      children: [
                        Icon(Icons.visibility_off, color: Colors.white, size: 20),
                        SizedBox(width: 12),
                        Text('Hide', style: TextStyle(color: Colors.white)),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Image Display
          if (item.imageUrl != null && item.imageUrl!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(24),
                child: Image.network(
                  item.imageUrl!,
                  width: double.infinity,
                  height: 300,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      height: 200,
                      color: AppColors.surfaceDark,
                      child: const Center(
                        child: Icon(Icons.broken_image, color: Colors.grey),
                      ),
                    );
                  },
                ),
              ),
            ),

          // Match Display - only show if teams have names (match data exists)
          if (item.teamA.name.isNotEmpty && item.teamB.name.isNotEmpty)
            ...[
              if (item.type == MatchFeedType.live)
                _buildLiveMatch(item)
              else if (item.type == MatchFeedType.result)
                _buildResultMatch(item),
              const SizedBox(height: 16),
            ],
          // Description
          if (item.description.isNotEmpty)
            Text(
              item.description,
              style: TextStyle(
                color: Colors.grey[300],
                fontSize: 14,
                height: 1.6,
              ),
            ),
          if (item.description.isEmpty && item.teamA.name.isEmpty && item.teamB.name.isEmpty)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surfaceDark,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(
                'No content available',
                style: TextStyle(
                  color: Colors.grey[500],
                  fontSize: 12,
                ),
              ),
            ),
          const SizedBox(height: 16),
          // Actions
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  IconButton(
                    icon: Icon(
                      _likedPosts[item.id] == true
                          ? Icons.favorite
                          : Icons.favorite_border,
                      color: _likedPosts[item.id] == true
                          ? Colors.red
                          : AppColors.primary,
                    ),
                    onPressed: () => _handleLike(item.id),
                  ),
                  Text(
                    '${_postLikes[item.id] ?? item.likes}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(width: 24),
                  IconButton(
                    icon: Icon(
                      _showComments[item.id] == true
                          ? Icons.chat_bubble
                          : Icons.chat_bubble_outline,
                      color: _showComments[item.id] == true
                          ? AppColors.primary
                          : Colors.grey,
                    ),
                    onPressed: () => _handleComment(item.id),
                  ),
                  Text(
                    '${_postComments[item.id] ?? item.comments}',
                    style: TextStyle(
                      color: Colors.grey[500],
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: () => _sharePost(item),
                icon: const Icon(Icons.ios_share, color: AppColors.primary),
                label: const Text(
                  'SHARE',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1,
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: Colors.white.withOpacity(0.1)),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 12,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ),
            ],
          ),
          // Comments Section
          if (_showComments[item.id] == true) ...[
            const SizedBox(height: 16),
            _buildCommentsSection(item.id),
          ],
          // Upcoming Bookings Nudge
          if (upcomingBookings.isNotEmpty) ...[
            const SizedBox(height: 16),
            _buildUpcomingBookingsNudge(upcomingBookings, bookingProvider),
          ],
          const SizedBox(height: 16),
          const Divider(color: Colors.white10),
        ],
      ),
    );
  }
  
  Widget _buildCommentsSection(String postId) {
    final comments = _postCommentsList[postId] ?? [];
    final controller = _commentControllers[postId];
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceDark,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: Colors.white.withOpacity(0.05),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Comments (${comments.length})',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 12),
          if (comments.isEmpty)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                'No comments yet. Be the first to comment!',
                style: TextStyle(
                  color: Colors.grey[500],
                  fontSize: 12,
                ),
              ),
            )
          else
            ...comments.map((comment) => _buildCommentItem(comment, postId)),
          const SizedBox(height: 12),
          if (controller != null)
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: controller,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      hintText: 'Write a comment...',
                      hintStyle: TextStyle(color: Colors.grey[600]),
                      filled: true,
                      fillColor: AppColors.backgroundDark,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(
                          color: Colors.white.withOpacity(0.05),
                        ),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(
                          color: Colors.white.withOpacity(0.05),
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(
                          color: AppColors.primary,
                          width: 2,
                        ),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.send,
                      color: AppColors.backgroundDark,
                      size: 20,
                    ),
                  ),
                  onPressed: () => _submitComment(postId),
                ),
              ],
            ),
        ],
      ),
    );
  }
  
  Widget _buildCommentItem(Map<String, dynamic> comment, String postId) {
    final user = FirebaseAuth.instance.currentUser;
    final isOwnComment = comment['userId'] == user?.uid;
    
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                colors: [
                  AppColors.primary.withOpacity(0.8),
                  Colors.blue.withOpacity(0.8),
                ],
              ),
            ),
            child: Center(
              child: Text(
                (comment['userName'] as String? ?? 'U').substring(0, 1).toUpperCase(),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      comment['userName'] as String? ?? 'User',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _formatCommentTime(comment['createdAt']),
                      style: TextStyle(
                        color: Colors.grey[500],
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  comment['content'] as String? ?? '',
                  style: TextStyle(
                    color: Colors.grey[300],
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
          if (isOwnComment)
            IconButton(
              icon: const Icon(Icons.delete_outline, color: Colors.grey, size: 18),
              onPressed: () => _deleteComment(postId, comment['id'] as String),
            ),
        ],
      ),
    );
  }
  
  String _formatCommentTime(dynamic timestamp) {
    if (timestamp == null) return 'now';
    try {
      DateTime dateTime;
      if (timestamp is Timestamp) {
        dateTime = timestamp.toDate();
      } else {
        return 'now';
      }
      final now = DateTime.now();
      final diff = now.difference(dateTime);
      
      if (diff.inMinutes < 1) return 'now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
      if (diff.inHours < 24) return '${diff.inHours}h ago';
      return '${diff.inDays}d ago';
    } catch (e) {
      return 'now';
    }
  }
  
  Future<void> _deleteComment(String postId, String commentId) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    
    try {
      await SocialService.deleteComment(postId, commentId, user.uid);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Comment deleted'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to delete comment: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }
  
  List<MatchFeedItem> _filterAndSortItems(List<MatchFeedItem> items) {
    var filtered = List<MatchFeedItem>.from(items);
    
    // Apply chip filter first
    if (_selectedChip == 1) {
      // Top Highlights - filter and sort by likes (already sorted by provider)
      // Just ensure it's sorted by likes
      filtered.sort((a, b) {
        final aLikes = _postLikes[a.id] ?? a.likes;
        final bLikes = _postLikes[b.id] ?? b.likes;
        return bLikes.compareTo(aLikes);
      });
    } else if (_selectedChip == 2) {
      // Upcoming - filter for live matches
      filtered = filtered.where((item) => item.type == MatchFeedType.live).toList();
    }
    // Chip 0 (Recent Matches) - no additional filtering
    
    // Apply sport filter (if sport info is available in future)
    if (_filterSport != null) {
      // This would need sport info in the feed item
      // For now, skip sport filtering as MatchFeedItem doesn't have sport field
    }
    
    // Apply sort (only if not already sorted by chip filter)
    if (_selectedChip != 1) {
      if (_sortBy == 'likes') {
        filtered.sort((a, b) {
          final aLikes = _postLikes[a.id] ?? a.likes;
          final bLikes = _postLikes[b.id] ?? b.likes;
          return bLikes.compareTo(aLikes);
        });
      } else if (_sortBy == 'comments') {
        filtered.sort((a, b) {
          final aComments = _postComments[a.id] ?? a.comments;
          final bComments = _postComments[b.id] ?? b.comments;
          return bComments.compareTo(aComments);
        });
      }
      // 'recent' is default (already sorted by createdAt from provider)
    }
    
    return filtered;
  }
  
  void _showFollowingModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Following',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Follow other players to see their posts in your feed',
              style: TextStyle(
                color: Colors.grey,
                fontSize: 14,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.backgroundDark,
              ),
              child: const Text('CLOSE'),
            ),
          ],
        ),
      ),
    );
  }
  
  void _showFilterModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Filter Posts',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 20),
            ListTile(
              title: const Text('All Sports', style: TextStyle(color: Colors.white)),
              trailing: _filterSport == null
                  ? const Icon(Icons.check, color: AppColors.primary)
                  : null,
              onTap: () {
                setState(() => _filterSport = null);
                Navigator.pop(context);
              },
            ),
            ListTile(
              title: const Text('Football', style: TextStyle(color: Colors.white)),
              trailing: _filterSport == 'Football'
                  ? const Icon(Icons.check, color: AppColors.primary)
                  : null,
              onTap: () {
                setState(() => _filterSport = 'Football');
                Navigator.pop(context);
              },
            ),
            ListTile(
              title: const Text('Cricket', style: TextStyle(color: Colors.white)),
              trailing: _filterSport == 'Cricket'
                  ? const Icon(Icons.check, color: AppColors.primary)
                  : null,
              onTap: () {
                setState(() => _filterSport = 'Cricket');
                Navigator.pop(context);
              },
            ),
            ListTile(
              title: const Text('Badminton', style: TextStyle(color: Colors.white)),
              trailing: _filterSport == 'Badminton'
                  ? const Icon(Icons.check, color: AppColors.primary)
                  : null,
              onTap: () {
                setState(() => _filterSport = 'Badminton');
                Navigator.pop(context);
              },
            ),
          ],
        ),
      ),
    );
  }
  
  void _showSortModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Sort Posts',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 20),
            ListTile(
              title: const Text('Most Recent', style: TextStyle(color: Colors.white)),
              trailing: _sortBy == 'recent'
                  ? const Icon(Icons.check, color: AppColors.primary)
                  : null,
              onTap: () {
                setState(() => _sortBy = 'recent');
                Navigator.pop(context);
              },
            ),
            ListTile(
              title: const Text('Most Liked', style: TextStyle(color: Colors.white)),
              trailing: _sortBy == 'likes'
                  ? const Icon(Icons.check, color: AppColors.primary)
                  : null,
              onTap: () {
                setState(() => _sortBy = 'likes');
                Navigator.pop(context);
              },
            ),
            ListTile(
              title: const Text('Most Comments', style: TextStyle(color: Colors.white)),
              trailing: _sortBy == 'comments'
                  ? const Icon(Icons.check, color: AppColors.primary)
                  : null,
              onTap: () {
                setState(() => _sortBy = 'comments');
                Navigator.pop(context);
              },
            ),
          ],
        ),
      ),
    );
  }
  
  void _showShareOptions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Share Feed',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Share the PlayTime feed with your friends',
              style: TextStyle(
                color: Colors.grey,
                fontSize: 14,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                Share.share('Check out PlayTime - The ultimate sports community app!');
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.backgroundDark,
              ),
              child: const Text('SHARE APP'),
            ),
          ],
        ),
      ),
    );
  }
  
  void _showReportOptions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Report',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Report inappropriate content in the feed',
              style: TextStyle(
                color: Colors.grey,
                fontSize: 14,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Use the menu on individual posts to report them'),
                    backgroundColor: AppColors.primary,
                  ),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.backgroundDark,
              ),
              child: const Text('UNDERSTOOD'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLiveMatch(MatchFeedItem item) {
    return Container(
      height: 200,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: Colors.white.withOpacity(0.05),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Stack(
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(24),
                    bottomLeft: Radius.circular(24),
                  ),
                  child: item.teamA.logo != null && item.teamA.logo!.isNotEmpty
                      ? Image.network(
                          item.teamA.logo!,
                          width: double.infinity,
                          height: double.infinity,
                          fit: BoxFit.cover,
                          color: Colors.black.withOpacity(0.4),
                          colorBlendMode: BlendMode.darken,
                          errorBuilder: (context, error, stackTrace) {
                            return Container(
                              color: AppColors.surfaceDark,
                              child: Center(
                                child: Text(
                                  item.teamA.icon,
                                  style: const TextStyle(fontSize: 48),
                                ),
                              ),
                            );
                          },
                        )
                      : Container(
                          color: AppColors.surfaceDark,
                          child: Center(
                            child: Text(
                              item.teamA.icon,
                              style: const TextStyle(fontSize: 48),
                            ),
                          ),
                        ),
                ),
                Positioned(
                  bottom: 16,
                  left: 16,
                  child: Text(
                    item.teamA.name.replaceAll(' ', '\n'),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Container(
            width: 56,
            alignment: Alignment.center,
            child: Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
                border: Border.all(
                  color: AppColors.backgroundDark,
                  width: 4,
                ),
              ),
              child: const Center(
                child: Text(
                  'VS',
                  style: TextStyle(
                    color: AppColors.backgroundDark,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: Stack(
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.only(
                    topRight: Radius.circular(24),
                    bottomRight: Radius.circular(24),
                  ),
                  child: item.teamB.logo != null && item.teamB.logo!.isNotEmpty
                      ? Image.network(
                          item.teamB.logo!,
                          width: double.infinity,
                          height: double.infinity,
                          fit: BoxFit.cover,
                          color: Colors.black.withOpacity(0.4),
                          colorBlendMode: BlendMode.darken,
                          errorBuilder: (context, error, stackTrace) {
                            return Container(
                              color: AppColors.surfaceDark,
                              child: Center(
                                child: Text(
                                  item.teamB.icon,
                                  style: const TextStyle(fontSize: 48),
                                ),
                              ),
                            );
                          },
                        )
                      : Container(
                          color: AppColors.surfaceDark,
                          child: Center(
                            child: Text(
                              item.teamB.icon,
                              style: const TextStyle(fontSize: 48),
                            ),
                          ),
                        ),
                ),
                Positioned(
                  bottom: 16,
                  right: 16,
                  child: Text(
                    item.teamB.name.replaceAll(' ', '\n'),
                    textAlign: TextAlign.right,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResultMatch(MatchFeedItem item) {
    return Container(
      height: 200,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: Colors.white.withOpacity(0.05),
        ),
      ),
      child: Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: Image.network(
              'https://lh3.googleusercontent.com/aida-public/AB6AXuDt4QbaMgaB9tKIIRII3R86jshjF3qCn3thaI2JJJz6rBaJPL-9vDNwL3WkFPn0AA7fhRCBTXH-sEN3uPkHmj69_FHqn4OQKHlb6HMjpvUP8IJ7O3IKsbN4vLaVsUUC_9v0rPbNyd8lgUjEG98XFbTRpj-bmveKl7fLoyT6EzbrvFubwQuYd-5YZrZuFcyx9D8xcaDj7OoFv8hcNS_0o66WxVS34jYJdWI-IlmaQ0ab-C9zXB2nq_1SayDWNc0SE6CjysLsMTQQL9_r',
              width: double.infinity,
              height: double.infinity,
              fit: BoxFit.cover,
              color: Colors.black.withOpacity(0.7),
              colorBlendMode: BlendMode.darken,
            ),
          ),
          Center(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.1),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Colors.white.withOpacity(0.2),
                        ),
                      ),
                      child: Center(
                        child: Text(
                          item.teamA.icon,
                          style: const TextStyle(fontSize: 32),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      item.teamA.name,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1,
                      ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 16,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.6),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: Colors.white.withOpacity(0.1),
                    ),
                  ),
                  child: Column(
                    children: [
                      Text(
                        '${item.teamA.score ?? 0} - ${item.teamB.score ?? 0}',
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontSize: 36,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.05),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Text(
                          'FULL TIME',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.1),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Colors.white.withOpacity(0.2),
                        ),
                      ),
                      child: Center(
                        child: Text(
                          item.teamB.icon,
                          style: const TextStyle(fontSize: 32),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      item.teamB.name,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Positioned(
            top: 16,
            right: 16,
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: 12,
                vertical: 8,
              ),
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.emoji_events,
                    color: AppColors.backgroundDark,
                    size: 14,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    item.teamA.score != null && item.teamB.score != null
                        ? (item.teamA.score! > item.teamB.score!
                            ? '${item.teamA.name} Won'
                            : item.teamB.score! > item.teamA.score!
                                ? '${item.teamB.name} Won'
                                : 'Draw')
                        : 'Match Result',
                    style: const TextStyle(
                      color: AppColors.backgroundDark,
                      fontSize: 9,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUpcomingBookingsNudge(
    List<Booking> bookings,
    BookingProvider provider,
  ) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surfaceDark,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: AppColors.primary.withOpacity(0.2),
        ),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.05),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: AppColors.primary.withOpacity(0.1),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(
                      Icons.event,
                      color: AppColors.primary,
                      size: 16,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'YOUR UPCOMING SCHEDULE',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ],
                ),
                Text(
                  'PLAYER PASS',
                  style: TextStyle(
                    color: Colors.grey[500],
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          ...bookings.take(1).map((booking) => Row(
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.4),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: Colors.white.withOpacity(0.05),
                      ),
                    ),
                    child: Icon(
                      _getSportIcon(booking.sport) == 'sports_soccer'
                          ? Icons.sports_soccer
                          : _getSportIcon(booking.sport) == 'sports_cricket'
                              ? Icons.sports_cricket
                              : Icons.sports_tennis,
                      color: AppColors.primary,
                      size: 28,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          booking.venueName,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Icon(Icons.calendar_today,
                                color: Colors.grey[400], size: 16),
                            const SizedBox(width: 4),
                            Text(
                              booking.date,
                              style: TextStyle(
                                color: Colors.grey[400],
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(width: 16),
                            Icon(Icons.schedule,
                                color: Colors.grey[400], size: 16),
                            const SizedBox(width: 4),
                            Text(
                              booking.time,
                              style: TextStyle(
                                color: Colors.grey[400],
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.chevron_right,
                        color: AppColors.backgroundDark,
                      ),
                    ),
                    onPressed: () {
                      context.push('/venue-detail?id=${booking.id}');
                    },
                  ),
                ],
              )),
          if (bookings.length > 1)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () {
                    context.push('/profile');
                  },
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(
                      color: Colors.white.withOpacity(0.05),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    '+ ${bookings.length - 1} more bookings',
                    style: TextStyle(
                      color: Colors.grey[400],
                      fontSize: 9,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
