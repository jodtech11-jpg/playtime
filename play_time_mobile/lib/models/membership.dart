import 'package:cloud_firestore/cloud_firestore.dart';

class Membership {
  final String id;
  final String userId;
  final String venueId;
  final String planId;
  final String planName;
  final String planType; // 'Monthly' | '6 Months' | 'Annual'
  final double price;
  final String? paymentStatus; // 'Pending' | 'Paid' | 'Refunded'
  final String? paymentMethod; // 'Online' | 'Offline' | 'Cash'
  final String? paymentGateway; // 'Razorpay' | 'Other'
  final String? paymentTransactionId;
  final DateTime? paymentDate;
  final DateTime startDate;
  final DateTime endDate;
  final String status; // 'Pending' | 'Active' | 'Expired' | 'Cancelled'

  Membership({
    required this.id,
    required this.userId,
    required this.venueId,
    required this.planId,
    required this.planName,
    required this.planType,
    required this.price,
    this.paymentStatus,
    this.paymentMethod,
    this.paymentGateway,
    this.paymentTransactionId,
    this.paymentDate,
    required this.startDate,
    required this.endDate,
    required this.status,
  });

  factory Membership.fromFirestore(String id, Map<String, dynamic> data) {
    return Membership(
      id: id,
      userId: data['userId'] as String? ?? '',
      venueId: data['venueId'] as String? ?? '',
      planId: data['planId'] as String? ?? '',
      planName: data['planName'] as String? ?? '',
      planType: data['planType'] as String? ?? 'Monthly',
      price: (data['price'] as num?)?.toDouble() ?? 0.0,
      paymentStatus: data['paymentStatus'] as String?,
      paymentMethod: data['paymentMethod'] as String?,
      paymentGateway: data['paymentGateway'] as String?,
      paymentTransactionId: data['paymentTransactionId'] as String?,
      paymentDate: data['paymentDate'] != null
          ? (data['paymentDate'] as Timestamp).toDate()
          : null,
      startDate: data['startDate'] != null
          ? (data['startDate'] as Timestamp).toDate()
          : DateTime.now(),
      endDate: data['endDate'] != null
          ? (data['endDate'] as Timestamp).toDate()
          : DateTime.now(),
      status: data['status'] as String? ?? 'Pending',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'venueId': venueId,
      'planId': planId,
      'planName': planName,
      'planType': planType,
      'price': price,
      'paymentStatus': paymentStatus,
      'paymentMethod': paymentMethod,
      'paymentGateway': paymentGateway,
      'paymentTransactionId': paymentTransactionId,
      'paymentDate': paymentDate != null ? Timestamp.fromDate(paymentDate!) : null,
      'startDate': Timestamp.fromDate(startDate),
      'endDate': Timestamp.fromDate(endDate),
      'status': status,
    };
  }

  bool get isActive => status == 'Active' && endDate.isAfter(DateTime.now());
  bool get isExpired => endDate.isBefore(DateTime.now());
}

