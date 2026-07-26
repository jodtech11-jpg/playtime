import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/order.dart';
import '../providers/order_provider.dart';
import '../services/firestore_service.dart';
import '../theme/app_colors.dart';

class OrderDetailScreen extends StatelessWidget {
  final String orderId;

  const OrderDetailScreen({super.key, required this.orderId});

  @override
  Widget build(BuildContext context) {
    final cached = context.watch<OrderProvider>().byId(orderId);
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(title: const Text('Order Details')),
      body: cached != null
          ? _OrderBody(order: cached)
          : FutureBuilder<Order?>(
              future: FirestoreService.getOrderById(orderId),
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const Center(child: CircularProgressIndicator());
                }
                final order = snapshot.data;
                if (order == null) {
                  return const Center(child: Text('Order not found.'));
                }
                return _OrderBody(order: order);
              },
            ),
    );
  }
}

class _OrderBody extends StatelessWidget {
  final Order order;

  const _OrderBody({required this.order});

  @override
  Widget build(BuildContext context) {
    final address = order.shippingAddress;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          order.orderNumber.isEmpty ? 'Order' : order.orderNumber,
          style: Theme.of(
            context,
          ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 6),
        if (order.createdAt != null)
          Text(DateFormat.yMMMd().add_jm().format(order.createdAt!)),
        const SizedBox(height: 16),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            Chip(label: Text(order.status)),
            Chip(label: Text('Payment: ${order.paymentStatus}')),
          ],
        ),
        const SizedBox(height: 24),
        const Text(
          'Items',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 10),
        ...order.items.map(
          (item) => Card(
            color: AppColors.surfaceDark,
            child: ListTile(
              title: Text(item.productName),
              subtitle: Text('Quantity: ${item.quantity}'),
              trailing: Text(
                '₹${(item.price * item.quantity).toStringAsFixed(0)}',
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
          ),
        ),
        if (address != null) ...[
          const SizedBox(height: 24),
          const Text(
            'Delivery address',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 10),
          Card(
            color: AppColors.surfaceDark,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                '${address.name}\n${address.address}'
                '${address.landmark?.isNotEmpty == true ? ', ${address.landmark}' : ''}'
                '\n${address.city}, ${address.state} ${address.pincode}'
                '\n${address.phone}',
              ),
            ),
          ),
        ],
        const SizedBox(height: 24),
        _totalRow('Subtotal', order.subtotal),
        if ((order.discount ?? 0) > 0)
          _totalRow('Discount', -(order.discount ?? 0)),
        _totalRow('Shipping', order.shippingCost ?? 0),
        _totalRow('Tax', order.tax ?? 0),
        const Divider(height: 28),
        _totalRow('Total', order.total, emphasized: true),
      ],
    );
  }

  Widget _totalRow(String label, double amount, {bool emphasized = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          Text(
            '${amount < 0 ? '-' : ''}₹${amount.abs().toStringAsFixed(0)}',
            style: TextStyle(
              color: emphasized ? AppColors.primary : null,
              fontSize: emphasized ? 20 : 14,
              fontWeight: emphasized ? FontWeight.w900 : FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
