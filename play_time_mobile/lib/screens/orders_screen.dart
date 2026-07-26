import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../providers/order_provider.dart';
import '../theme/app_colors.dart';

class OrdersScreen extends StatelessWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<OrderProvider>();
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(title: const Text('My Orders')),
      body: RefreshIndicator(
        onRefresh: provider.refresh,
        child: provider.isLoading && provider.orders.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : provider.error != null && provider.orders.isEmpty
            ? ListView(
                padding: const EdgeInsets.all(24),
                children: [
                  const SizedBox(height: 120),
                  const Icon(Icons.error_outline, size: 48),
                  const SizedBox(height: 12),
                  Text(provider.error!, textAlign: TextAlign.center),
                ],
              )
            : provider.orders.isEmpty
            ? ListView(
                padding: const EdgeInsets.all(24),
                children: const [
                  SizedBox(height: 120),
                  Icon(Icons.inventory_2_outlined, size: 56),
                  SizedBox(height: 12),
                  Text('No orders yet', textAlign: TextAlign.center),
                ],
              )
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: provider.orders.length,
                separatorBuilder: (_, _) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final order = provider.orders[index];
                  final date = order.createdAt == null
                      ? ''
                      : DateFormat.yMMMd().format(order.createdAt!);
                  return Semantics(
                    button: true,
                    label:
                        'Order ${order.orderNumber}, ${order.status}, ₹${order.total.toStringAsFixed(0)}',
                    child: Card(
                      color: AppColors.surfaceDark,
                      child: ListTile(
                        contentPadding: const EdgeInsets.all(16),
                        leading: const CircleAvatar(
                          backgroundColor: AppColors.surfaceInput,
                          child: Icon(
                            Icons.shopping_bag_outlined,
                            color: AppColors.primary,
                          ),
                        ),
                        title: Text(
                          order.orderNumber.isEmpty
                              ? 'Order ${order.id.substring(0, order.id.length.clamp(0, 8))}'
                              : order.orderNumber,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        subtitle: Text(
                          '${order.items.length} item(s)${date.isEmpty ? '' : ' • $date'}\n${order.status}',
                        ),
                        isThreeLine: true,
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              '₹${order.total.toStringAsFixed(0)}',
                              style: const TextStyle(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const Icon(Icons.chevron_right),
                          ],
                        ),
                        onTap: () => context.push('/order/${order.id}'),
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
