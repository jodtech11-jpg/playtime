import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:play_time_mobile/models/engagement.dart';
import 'package:play_time_mobile/models/product.dart';
import 'package:play_time_mobile/providers/cart_provider.dart';
import 'package:play_time_mobile/models/order.dart';
import 'package:play_time_mobile/utils/app_link_mapper.dart';
import 'package:play_time_mobile/utils/booking_time_policy.dart';
import 'package:play_time_mobile/utils/error_utils.dart';
import 'package:play_time_mobile/screens/login_screen.dart';

class _LoginKeyboardHarness extends StatefulWidget {
  const _LoginKeyboardHarness({super.key});

  @override
  State<_LoginKeyboardHarness> createState() => _LoginKeyboardHarnessState();
}

class _LoginKeyboardHarnessState extends State<_LoginKeyboardHarness> {
  bool keyboardOpen = false;

  void showKeyboardInset() => setState(() => keyboardOpen = true);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: MediaQuery(
        data: MediaQueryData(
          size: const Size(400, 800),
          viewInsets: EdgeInsets.only(bottom: keyboardOpen ? 300 : 0),
        ),
        child: const LoginScreen(),
      ),
    );
  }
}

void main() {
  test('product parser preserves fulfilment venue', () {
    final product = Product.fromFirestore('p1', {
      'name': 'Racket',
      'price': 900,
      'venueId': 'venue-a',
      'venueName': 'Arena A',
    });

    expect(product.venueId, 'venue-a');
    expect(product.venueName, 'Arena A');
  });

  test('cart detects unsupported multi-venue checkout', () {
    Product product(String id, String? venueId) => Product(
      id: id,
      name: id,
      brand: '',
      price: 100,
      originalPrice: 100,
      image: '',
      venueId: venueId,
    );
    final cart = CartProvider()
      ..addToCart(product('p1', 'venue-a'))
      ..addToCart(product('p2', 'venue-b'));

    expect(cart.isMultiVenue, isTrue);
    expect(cart.venueIds, {'venue-a', 'venue-b'});
    expect(cart.fulfilmentVenueId, isNull);
  });

  test('cart allows platform fulfilment for global products', () {
    Product product(String id) => Product(
      id: id,
      name: id,
      brand: '',
      price: 100,
      originalPrice: 150,
      image: '',
    );
    final cart = CartProvider()
      ..addToCart(product('p1'))
      ..addToCart(product('p2'));

    expect(cart.hasProductsWithoutVenue, isTrue);
    expect(cart.fulfilmentVenueId, 'platform');
    expect(cart.discount, 100);
  });

  test('poll parser handles numeric vote values', () {
    final poll = AppPoll.fromFirestore('poll-1', {
      'question': 'Best time?',
      'options': [
        {'id': 'morning', 'text': 'Morning', 'votes': 2.0},
      ],
      'totalVotes': 2.0,
      'votedUserIds': ['user-1'],
    });

    expect(poll.options.single.votes, 2);
    expect(poll.hasVoted('user-1'), isTrue);
  });

  test('custom app links map to guarded application routes', () {
    expect(
      AppLinkMapper.routeFor(Uri.parse('playtime://app/order/order-1')),
      '/order/order-1',
    );
    expect(
      AppLinkMapper.routeFor(
        Uri.parse('https://example.invalid/venue/venue-1?source=share'),
      ),
      isNull,
    );
    expect(
      AppLinkMapper.routeFor(Uri.parse('playtime://untrusted/order/order-1')),
      isNull,
    );
    expect(
      AppLinkMapper.routeFor(Uri.parse('playtime://app/admin/users')),
      isNull,
    );
  });

  test('order parser tolerates numeric and missing optional fields', () {
    final order = Order.fromFirestore('order-1', {
      'userId': 'user-1',
      'items': [
        {
          'productId': 'product-1',
          'productName': 'Ball',
          'quantity': 2.0,
          'price': 125,
        },
      ],
      'subtotal': 250,
      'total': 250,
    });

    expect(order.items.single.quantity, 2);
    expect(order.items.single.price, 125);
    expect(order.status, 'Pending');
    expect(order.paymentStatus, 'Pending');
  });

  test('booking policy enforces the exact 15-minute lead boundary', () {
    final now = DateTime.utc(2026, 7, 26, 12);

    expect(
      BookingTimePolicy.isBookable(
        now.add(const Duration(minutes: 14, seconds: 59)),
        now,
      ),
      isFalse,
    );
    expect(
      BookingTimePolicy.isBookable(now.add(const Duration(minutes: 15)), now),
      isTrue,
    );
  });

  test('friendly errors prioritize actionable payment and slot messages', () {
    expect(
      friendlyErrorMessage(Exception('Razorpay is not configured')),
      'Online payment is not available for this venue right now.',
    );
    expect(
      friendlyErrorMessage(StateError('This slot overlaps another booking')),
      'That time slot is no longer available. Please pick another.',
    );
    expect(
      friendlyErrorMessage(
        Exception('PlatformException(${List.filled(150, 'x').join()})'),
        fallback: 'Safe fallback',
      ),
      'Safe fallback',
    );
  });

  testWidgets('login phone field keeps focus when keyboard inset opens', (
    tester,
  ) async {
    final harnessKey = GlobalKey<_LoginKeyboardHarnessState>();
    await tester.pumpWidget(_LoginKeyboardHarness(key: harnessKey));

    final phoneField = find.byType(TextField);
    await tester.tap(phoneField);
    await tester.enterText(phoneField, '98765');
    harnessKey.currentState!.showKeyboardInset();
    await tester.pump();

    final textField = tester.widget<TextField>(phoneField);
    expect(textField.focusNode!.hasFocus, isTrue);
    expect(find.text('98765'), findsOneWidget);

    await tester.enterText(phoneField, '98765abc4321099');
    expect(find.text('9876543210'), findsOneWidget);
  });
}
