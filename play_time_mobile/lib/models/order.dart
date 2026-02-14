import 'package:cloud_firestore/cloud_firestore.dart';

class OrderItem {
  final String productId;
  final String productName;
  final int quantity;
  final double price;
  final String? image;

  OrderItem({
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.price,
    this.image,
  });

  Map<String, dynamic> toJson() {
    return {
      'productId': productId,
      'productName': productName,
      'quantity': quantity,
      'price': price,
      'image': image,
    };
  }
}

class ShippingAddress {
  final String name;
  final String phone;
  final String address;
  final String city;
  final String state;
  final String pincode;
  final String? landmark;

  ShippingAddress({
    required this.name,
    required this.phone,
    required this.address,
    required this.city,
    required this.state,
    required this.pincode,
    this.landmark,
  });

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'phone': phone,
      'address': address,
      'city': city,
      'state': state,
      'pincode': pincode,
      'landmark': landmark,
    };
  }
}

class Order {
  final String id;
  final String orderNumber;
  final String userId;
  final String? userName;
  final String? userEmail;
  final String? userPhone;
  final List<OrderItem> items;
  final double subtotal;
  final double? discount;
  final double? shippingCost;
  final double? tax;
  final double total;
  final String status; // 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Refunded'
  final ShippingAddress? shippingAddress;
  final String paymentStatus; // 'Pending' | 'Paid' | 'Refunded' | 'Partially Refunded'
  final String? paymentMethod;
  final String? paymentTransactionId;
  final String? venueId;
  final String? venueName;
  final DateTime? createdAt;

  Order({
    required this.id,
    required this.orderNumber,
    required this.userId,
    this.userName,
    this.userEmail,
    this.userPhone,
    required this.items,
    required this.subtotal,
    this.discount,
    this.shippingCost,
    this.tax,
    required this.total,
    required this.status,
    this.shippingAddress,
    required this.paymentStatus,
    this.paymentMethod,
    this.paymentTransactionId,
    this.venueId,
    this.venueName,
    this.createdAt,
  });

  factory Order.fromFirestore(String id, Map<String, dynamic> data) {
    final itemsData = data['items'] as List<dynamic>? ?? [];
    final items = itemsData.map((item) => OrderItem(
      productId: item['productId'] as String,
      productName: item['productName'] as String,
      quantity: item['quantity'] as int,
      price: (item['price'] as num).toDouble(),
      image: item['image'] as String?,
    )).toList();

    ShippingAddress? shippingAddress;
    if (data['shippingAddress'] != null) {
      final addr = data['shippingAddress'] as Map<String, dynamic>;
      shippingAddress = ShippingAddress(
        name: addr['name'] as String,
        phone: addr['phone'] as String,
        address: addr['address'] as String,
        city: addr['city'] as String,
        state: addr['state'] as String,
        pincode: addr['pincode'] as String,
        landmark: addr['landmark'] as String?,
      );
    }

    return Order(
      id: id,
      orderNumber: data['orderNumber'] as String? ?? '',
      userId: data['userId'] as String? ?? '',
      userName: data['userName'] as String?,
      userEmail: data['userEmail'] as String?,
      userPhone: data['userPhone'] as String?,
      items: items,
      subtotal: (data['subtotal'] as num?)?.toDouble() ?? 0.0,
      discount: (data['discount'] as num?)?.toDouble(),
      shippingCost: (data['shippingCost'] as num?)?.toDouble(),
      tax: (data['tax'] as num?)?.toDouble(),
      total: (data['total'] as num?)?.toDouble() ?? 0.0,
      status: data['status'] as String? ?? 'Pending',
      shippingAddress: shippingAddress,
      paymentStatus: data['paymentStatus'] as String? ?? 'Pending',
      paymentMethod: data['paymentMethod'] as String?,
      paymentTransactionId: data['paymentTransactionId'] as String?,
      venueId: data['venueId'] as String?,
      venueName: data['venueName'] as String?,
      createdAt: data['createdAt'] != null
          ? (data['createdAt'] as Timestamp).toDate()
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'orderNumber': orderNumber,
      'userId': userId,
      'userName': userName,
      'userEmail': userEmail,
      'userPhone': userPhone,
      'items': items.map((item) => item.toJson()).toList(),
      'subtotal': subtotal,
      'discount': discount,
      'shippingCost': shippingCost,
      'tax': tax,
      'total': total,
      'status': status,
      'shippingAddress': shippingAddress?.toJson(),
      'paymentStatus': paymentStatus,
      'paymentMethod': paymentMethod,
      'paymentTransactionId': paymentTransactionId,
      'venueId': venueId,
      'venueName': venueName,
    };
  }
}

