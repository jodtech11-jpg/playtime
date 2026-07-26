import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../theme/app_colors.dart';
import '../providers/cart_provider.dart';
import '../providers/product_provider.dart';
import '../providers/engagement_provider.dart';
import '../models/product.dart';
import '../models/engagement.dart';
import '../widgets/loading_widget.dart';
import '../widgets/error_widget.dart';
import 'package:cached_network_image/cached_network_image.dart';

class MarketplaceScreen extends StatefulWidget {
  const MarketplaceScreen({super.key});

  @override
  State<MarketplaceScreen> createState() => _MarketplaceScreenState();
}

class _MarketplaceScreenState extends State<MarketplaceScreen> {
  int _selectedCategory = 0;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() {
      setState(() {
        _searchQuery = _searchController.text.toLowerCase();
      });
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<Product> _getFilteredProducts(List<Product> products) {
    var filtered = products;

    // Filter by search query
    if (_searchQuery.isNotEmpty) {
      filtered = filtered.where((product) {
        return product.name.toLowerCase().contains(_searchQuery) ||
            product.brand.toLowerCase().contains(_searchQuery);
      }).toList();
    }

    // Filter by category
    if (_selectedCategory > 0) {
      final categories = [
        'All',
        'Cricket',
        'Football',
        'Badminton',
        'Tennis',
        'Apparel',
      ];
      final selectedCategory = categories[_selectedCategory];
      filtered = filtered.where((product) {
        final category = product.category?.toLowerCase() ?? '';
        return category == selectedCategory.toLowerCase() ||
            product.name.toLowerCase().contains(
              selectedCategory.toLowerCase(),
            ) ||
            product.brand.toLowerCase().contains(
              selectedCategory.toLowerCase(),
            );
      }).toList();
    }

    return filtered;
  }

  Widget _buildPromoBanner() {
    return Consumer<EngagementProvider>(
      builder: (context, engagement, _) {
        final campaigns = engagement.campaigns;
        final deals = engagement.flashDeals;

        if (campaigns.isNotEmpty) {
          return _campaignBanner(campaigns.first);
        }
        if (deals.isNotEmpty) {
          return _dealBanner(deals.first);
        }

        // Fallback when no live campaigns exist yet
        return Container(
          height: 200,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
            gradient: LinearGradient(
              colors: [
                AppColors.primary.withValues(alpha: 0.25),
                AppColors.surfaceDark,
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: const Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'Offers from venues will appear here',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _campaignBanner(MarketingCampaignItem campaign) {
    return Container(
      height: 200,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Stack(
        children: [
          if (campaign.imageUrl.isNotEmpty)
            ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: CachedNetworkImage(
                imageUrl: campaign.imageUrl,
                width: double.infinity,
                height: double.infinity,
                fit: BoxFit.cover,
                errorWidget: (_, _, _) =>
                    Container(color: AppColors.surfaceDark),
              ),
            )
          else
            Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(24),
                color: AppColors.surfaceDark,
              ),
            ),
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.transparent,
                  AppColors.backgroundDark.withValues(alpha: 0.4),
                  AppColors.backgroundDark,
                ],
              ),
            ),
          ),
          Positioned(
            bottom: 20,
            left: 20,
            right: 20,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    'OFFER',
                    style: TextStyle(
                      color: AppColors.backgroundDark,
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.25,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  campaign.title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                if (campaign.description != null &&
                    campaign.description!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    campaign.description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: Colors.grey[300], fontSize: 13),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _dealBanner(FlashDealItem deal) {
    return GestureDetector(
      onTap: () => context.push('/venue/${deal.venueId}'),
      child: Container(
        height: 160,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          gradient: LinearGradient(
            colors: [
              Colors.orange.shade700,
              AppColors.primary.withValues(alpha: 0.8),
            ],
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'FLASH DEAL',
              style: TextStyle(
                color: Colors.white70,
                fontSize: 10,
                fontWeight: FontWeight.w900,
                letterSpacing: 1,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              deal.title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w900,
              ),
            ),
            const Spacer(),
            Text(
              '${deal.venueName ?? 'Venue'} • ₹${deal.discountedPrice.toInt()} (was ₹${deal.originalPrice.toInt()})',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProClubCta(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFF1c3024),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Play Time Pro',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
              SizedBox(height: 4),
              Text(
                'Platform membership — not venue subscriptions',
                style: TextStyle(
                  color: Colors.grey,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ),
          ElevatedButton(
            onPressed: () {
              context.push('/membership');
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white.withValues(alpha: 0.1),
              foregroundColor: AppColors.primary,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(
                  color: AppColors.primary.withValues(alpha: 0.2),
                ),
              ),
            ),
            child: const Text(
              'JOIN NOW',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w900,
                letterSpacing: 0.25,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cartProvider = Provider.of<CartProvider>(context);
    final cartItems = cartProvider.items;
    final total = cartProvider.total;
    final originalTotal = cartProvider.originalTotal;

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
                  color: AppColors.backgroundDark.withValues(alpha: 0.95),
                  border: Border(
                    bottom: BorderSide(
                      color: Colors.white.withValues(alpha: 0.05),
                    ),
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
                              color: Colors.white.withValues(alpha: 0.05),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(
                              Icons.arrow_back,
                              color: Colors.white,
                            ),
                          ),
                          onPressed: () {
                            if (Navigator.canPop(context)) {
                              context.pop();
                            } else {
                              context.go('/home');
                            }
                          },
                        ),
                        const Expanded(
                          child: Text(
                            'Marketplace',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                        Stack(
                          children: [
                            IconButton(
                              icon: Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.05),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Icon(
                                  Icons.shopping_cart,
                                  color: Colors.white,
                                ),
                              ),
                              onPressed: () {
                                if (cartItems.isNotEmpty) {
                                  context.push('/checkout');
                                } else {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text(
                                        'Your cart is empty',
                                        style: TextStyle(
                                          color: AppColors.backgroundDark,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      backgroundColor: AppColors.primary,
                                    ),
                                  );
                                }
                              },
                            ),
                            if (cartItems.isNotEmpty)
                              Positioned(
                                top: 8,
                                right: 8,
                                child: Container(
                                  width: 16,
                                  height: 16,
                                  decoration: const BoxDecoration(
                                    color: AppColors.primary,
                                    shape: BoxShape.circle,
                                  ),
                                  child: Center(
                                    child: Text(
                                      '${cartProvider.itemCount}',
                                      style: const TextStyle(
                                        color: AppColors.backgroundDark,
                                        fontSize: 10,
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    // Search
                    Container(
                      height: 48,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceDark,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.05),
                        ),
                      ),
                      child: TextField(
                        controller: _searchController,
                        style: const TextStyle(color: Colors.white),
                        decoration: InputDecoration(
                          hintText: 'Search for gear...',
                          hintStyle: TextStyle(color: Colors.grey[600]),
                          prefixIcon: Icon(
                            Icons.search,
                            color: Colors.grey[500],
                          ),
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              // Categories
              Container(
                padding: const EdgeInsets.symmetric(
                  vertical: 12,
                  horizontal: 16,
                ),
                height: 60,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: 6,
                  itemBuilder: (context, index) {
                    final categories = [
                      'All',
                      'Cricket',
                      'Football',
                      'Badminton',
                      'Tennis',
                      'Apparel',
                    ];
                    final isSelected = _selectedCategory == index;
                    return Padding(
                      padding: const EdgeInsets.only(right: 12),
                      child: GestureDetector(
                        onTap: () => setState(() => _selectedCategory = index),
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
                                  : Colors.white.withValues(alpha: 0.05),
                            ),
                          ),
                          child: Text(
                            categories[index].toUpperCase(),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            softWrap: false,
                            style: TextStyle(
                              color: isSelected
                                  ? AppColors.backgroundDark
                                  : Colors.grey[400],
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.25,
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
              // Content — lazy grid via SliverGrid when products exist
              Expanded(
                child: Consumer<ProductProvider>(
                  builder: (context, productProvider, _) {
                    final c = Provider.of<CartProvider>(context, listen: false);
                    const sectionPad = EdgeInsets.symmetric(horizontal: 16);
                    Widget popularRow() => Padding(
                      padding: sectionPad,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Popular Gear',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          TextButton(
                            onPressed: () {
                              setState(() {
                                _selectedCategory = 0;
                                _searchQuery = '';
                                _searchController.clear();
                              });
                            },
                            child: const Text(
                              'SEE ALL',
                              style: TextStyle(
                                color: AppColors.primary,
                                fontSize: 12,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.25,
                              ),
                            ),
                          ),
                        ],
                      ),
                    );

                    if (productProvider.isLoading) {
                      return ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          _buildPromoBanner(),
                          const SizedBox(height: 32),
                          popularRow(),
                          const SizedBox(height: 16),
                          const LoadingWidget(message: 'Loading products...'),
                        ],
                      );
                    }
                    if (productProvider.error != null) {
                      return ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          _buildPromoBanner(),
                          const SizedBox(height: 32),
                          popularRow(),
                          const SizedBox(height: 16),
                          ErrorDisplayWidget(
                            message: productProvider.error!,
                            onRetry: () => productProvider.loadProducts(),
                          ),
                        ],
                      );
                    }

                    final filteredProducts = _getFilteredProducts(
                      productProvider.products,
                    );
                    if (filteredProducts.isEmpty) {
                      return ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          _buildPromoBanner(),
                          const SizedBox(height: 32),
                          popularRow(),
                          const SizedBox(height: 16),
                          EmptyStateWidget(
                            icon:
                                _searchQuery.isNotEmpty || _selectedCategory > 0
                                ? Icons.search_off
                                : Icons.shopping_bag_outlined,
                            title:
                                _searchQuery.isNotEmpty || _selectedCategory > 0
                                ? 'No products found'
                                : 'No products available',
                            message:
                                _searchQuery.isNotEmpty || _selectedCategory > 0
                                ? 'Try adjusting your search or filters'
                                : 'Check back later for new items',
                          ),
                          const SizedBox(height: 24),
                          _buildProClubCta(context),
                          const SizedBox(height: 100),
                        ],
                      );
                    }

                    return CustomScrollView(
                      slivers: [
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
                          sliver: SliverToBoxAdapter(
                            child: _buildPromoBanner(),
                          ),
                        ),
                        const SliverToBoxAdapter(child: SizedBox(height: 32)),
                        SliverToBoxAdapter(child: popularRow()),
                        const SliverToBoxAdapter(child: SizedBox(height: 16)),
                        SliverPadding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          sliver: SliverGrid(
                            gridDelegate:
                                const SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: 2,
                                  crossAxisSpacing: 16,
                                  mainAxisSpacing: 16,
                                  childAspectRatio: 0.75,
                                ),
                            delegate: SliverChildBuilderDelegate((
                              context,
                              index,
                            ) {
                              final product = filteredProducts[index];
                              return _buildProductCard(product, c);
                            }, childCount: filteredProducts.length),
                          ),
                        ),
                        const SliverToBoxAdapter(child: SizedBox(height: 24)),
                        SliverPadding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          sliver: SliverToBoxAdapter(
                            child: _buildProClubCta(context),
                          ),
                        ),
                        const SliverToBoxAdapter(child: SizedBox(height: 100)),
                      ],
                    );
                  },
                ),
              ),
            ],
          ),
        ),
        // Checkout Bar
        bottomNavigationBar: cartItems.isNotEmpty
            ? Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.backgroundDark.withValues(alpha: 0.95),
                  border: Border(
                    top: BorderSide(
                      color: Colors.white.withValues(alpha: 0.05),
                    ),
                  ),
                ),
                child: SafeArea(
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'TOTAL (${cartProvider.itemCount} items)',
                              style: TextStyle(
                                color: Colors.grey[400],
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.25,
                              ),
                            ),
                            Row(
                              children: [
                                Text(
                                  '₹${total.toInt()}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 24,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                if (originalTotal > total) ...[
                                  const SizedBox(width: 8),
                                  Text(
                                    '₹${originalTotal.toInt()}',
                                    style: TextStyle(
                                      color: Colors.grey[500],
                                      fontSize: 14,
                                      decoration: TextDecoration.lineThrough,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        flex: 2,
                        child: ElevatedButton(
                          onPressed: () {
                            context.push('/checkout');
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: AppColors.backgroundDark,
                            padding: const EdgeInsets.symmetric(vertical: 18),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                'CHECKOUT',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.25,
                                ),
                              ),
                              SizedBox(width: 8),
                              Icon(Icons.arrow_forward, size: 20),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              )
            : null,
      ),
    );
  }

  Widget _buildProductCard(Product product, CartProvider cartProvider) {
    final isInCart = cartProvider.isInCart(product.id);

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceDark,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Image
          Expanded(
            child: Stack(
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(16),
                    topRight: Radius.circular(16),
                  ),
                  child: Image.network(
                    product.image,
                    width: double.infinity,
                    height: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) {
                      return Container(
                        color: Colors.white.withValues(alpha: 0.05),
                        child: const Center(
                          child: Icon(
                            Icons.image_not_supported,
                            color: Colors.white24,
                            size: 32,
                          ),
                        ),
                      );
                    },
                  ),
                ),
                if (product.tag != null)
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.red,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        product.tag!.toUpperCase(),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.25,
                        ),
                      ),
                    ),
                  ),
                Positioned(
                  top: 8,
                  right: 8,
                  child: IconButton(
                    icon: Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.4),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        isInCart
                            ? Icons.shopping_bag
                            : Icons.shopping_bag_outlined,
                        color: isInCart ? AppColors.primary : Colors.white,
                        size: 18,
                      ),
                    ),
                    onPressed: () {
                      if (isInCart) {
                        cartProvider.removeFromCart(product.id);
                      } else {
                        cartProvider.addToCart(product);
                      }
                    },
                  ),
                ),
              ],
            ),
          ),
          // Details
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.name,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Text(
                  product.brand.toUpperCase(),
                  style: TextStyle(
                    color: Colors.grey[400],
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.25,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (product.originalPrice > product.price)
                          Text(
                            '₹${product.originalPrice.toInt()}',
                            style: TextStyle(
                              color: Colors.grey[500],
                              fontSize: 10,
                              decoration: TextDecoration.lineThrough,
                            ),
                          ),
                        Text(
                          '₹${product.price.toInt()}',
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                    IgnorePointer(
                      ignoring: product.isOutOfStock,
                      child: Opacity(
                        opacity: product.isOutOfStock ? 0.45 : 1,
                        child: GestureDetector(
                          onTap: () {
                            if (isInCart) {
                              cartProvider.removeFromCart(product.id);
                            } else {
                              cartProvider.addToCart(product);
                            }
                          },
                          child: Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: product.isOutOfStock
                                  ? Colors.grey.withValues(alpha: 0.2)
                                  : isInCart
                                  ? AppColors.primary
                                  : AppColors.primary.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(
                              product.isOutOfStock
                                  ? Icons.block
                                  : isInCart
                                  ? Icons.check
                                  : Icons.add,
                              color: product.isOutOfStock
                                  ? Colors.grey
                                  : isInCart
                                  ? AppColors.backgroundDark
                                  : AppColors.primary,
                              size: 20,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
