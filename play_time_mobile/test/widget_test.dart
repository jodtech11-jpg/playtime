import 'package:flutter_test/flutter_test.dart';
import 'package:play_time_mobile/models/engagement.dart';
import 'package:play_time_mobile/models/product.dart';
import 'package:play_time_mobile/providers/cart_provider.dart';

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
    Product product(String id, String venueId) => Product(
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
}
