// lib/features/customer/shared/models/customer_models.dart
//
// Wire/domain models for the customer app. Parse the backend's snake_case JSON. Money is
// kept as String (backend returns Decimal-as-string). Kept in one file for cohesion;
// split per-aggregate later if it grows.

class Paginated<T> {
  final List<T> data;
  final int page;
  final int limit;
  final int total;
  const Paginated({required this.data, this.page = 1, this.limit = 20, this.total = 0});

  factory Paginated.fromJson(Map<String, dynamic> json, T Function(Map<String, dynamic>) item) {
    final list = (json['data'] as List? ?? const []).whereType<Map<String, dynamic>>().map(item).toList();
    final meta = json['meta'] as Map<String, dynamic>?;
    return Paginated(
      data: list,
      page: (meta?['page'] as num?)?.toInt() ?? 1,
      limit: (meta?['limit'] as num?)?.toInt() ?? list.length,
      total: (meta?['total'] as num?)?.toInt() ?? list.length,
    );
  }
}

class Service {
  final String id;
  final String name;
  final String? category;
  final String? description;
  final String basePrice;
  final int? estimatedDurationMin;
  final List<String> targetPests;

  const Service({
    required this.id,
    required this.name,
    required this.basePrice,
    this.category,
    this.description,
    this.estimatedDurationMin,
    this.targetPests = const [],
  });

  factory Service.fromJson(Map<String, dynamic> j) => Service(
        id: j['id'].toString(),
        name: j['name']?.toString() ?? '',
        category: j['category']?.toString() ?? (j['category_name']?.toString()),
        description: j['description']?.toString(),
        basePrice: (j['base_price'] ?? j['basePrice'] ?? '0').toString(),
        estimatedDurationMin: (j['estimated_duration_min'] as num?)?.toInt(),
        targetPests: (j['target_pests'] as List? ?? const []).map((e) => e.toString()).toList(),
      );
}

class ServicePackage {
  final String id;
  final String name;
  final String price;
  final String? billingCycle;
  final int? visitFrequency;
  const ServicePackage({required this.id, required this.name, required this.price, this.billingCycle, this.visitFrequency});

  factory ServicePackage.fromJson(Map<String, dynamic> j) => ServicePackage(
        id: j['id'].toString(),
        name: j['name']?.toString() ?? '',
        price: (j['price'] ?? '0').toString(),
        billingCycle: j['billing_cycle']?.toString(),
        visitFrequency: (j['visit_frequency'] as num?)?.toInt(),
      );
}

class Address {
  final String id;
  final String label;
  final String line1;
  final String? line2;
  final String city;
  final String state;
  final String postalCode;
  final String country;
  final String? gateCode;
  final String? accessNotes;
  final bool isDefault;

  const Address({
    required this.id,
    required this.label,
    required this.line1,
    required this.city,
    required this.state,
    required this.postalCode,
    required this.country,
    this.line2,
    this.gateCode,
    this.accessNotes,
    this.isDefault = false,
  });

  String get oneLine => [line1, if (line2?.isNotEmpty ?? false) line2, city, state, postalCode].whereType<String>().join(', ');

  factory Address.fromJson(Map<String, dynamic> j) => Address(
        id: j['id'].toString(),
        label: j['label']?.toString() ?? 'Address',
        line1: j['line1']?.toString() ?? '',
        line2: j['line2']?.toString(),
        city: j['city']?.toString() ?? '',
        state: j['state']?.toString() ?? '',
        postalCode: (j['postal_code'] ?? j['postalCode'] ?? '').toString(),
        country: j['country']?.toString() ?? 'IN',
        gateCode: j['gate_code']?.toString(),
        accessNotes: j['access_notes']?.toString(),
        isDefault: j['is_default'] == true,
      );
}

class Booking {
  final String id;
  final String status;
  final String? serviceId;
  final String? serviceName;
  final String? addressId;
  final String? addressLine;
  final DateTime? windowStart;
  final DateTime? windowEnd;
  final String price;
  final String? discountAmount;
  final String currency;
  final String? invoiceId;
  final String? technicianName;

  const Booking({
    required this.id,
    required this.status,
    required this.price,
    this.currency = 'INR',
    this.serviceId,
    this.serviceName,
    this.addressId,
    this.addressLine,
    this.windowStart,
    this.windowEnd,
    this.discountAmount,
    this.invoiceId,
    this.technicianName,
  });

  bool get isUpcoming => const ['PENDING', 'CONFIRMED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'WAITING'].contains(status.toUpperCase());
  bool get isCompleted => status.toUpperCase() == 'COMPLETED';
  bool get isCancellable => const ['PENDING', 'CONFIRMED'].contains(status.toUpperCase());

  static DateTime? _date(dynamic v) => v == null ? null : DateTime.tryParse(v.toString())?.toLocal();

  factory Booking.fromJson(Map<String, dynamic> j) => Booking(
        id: j['id'].toString(),
        status: j['status']?.toString() ?? 'PENDING',
        serviceId: j['service_id']?.toString(),
        serviceName: (j['service'] is Map ? (j['service']['name']) : j['service_name'])?.toString(),
        addressId: j['address_id']?.toString(),
        addressLine: (j['address'] is Map ? (j['address']['line1']) : j['address_line'])?.toString(),
        windowStart: _date(j['scheduled_window_start']),
        windowEnd: _date(j['scheduled_window_end']),
        price: (j['price'] ?? '0').toString(),
        discountAmount: j['discount_amount']?.toString(),
        currency: j['currency']?.toString() ?? 'INR',
        invoiceId: j['invoice_id']?.toString() ?? (j['invoice'] is Map ? j['invoice']['id']?.toString() : null),
        technicianName: j['technician'] is Map ? j['technician']['full_name']?.toString() : null,
      );
}

class PaymentIntentResult {
  final String paymentId;
  final String clientSecret;
  final String amount;
  final String currency;
  const PaymentIntentResult({required this.paymentId, required this.clientSecret, required this.amount, required this.currency});

  factory PaymentIntentResult.fromJson(Map<String, dynamic> j) => PaymentIntentResult(
        paymentId: (j['payment_id'] ?? j['paymentId']).toString(),
        clientSecret: (j['client_secret'] ?? j['clientSecret']).toString(),
        amount: (j['amount'] ?? '0').toString(),
        currency: j['currency']?.toString() ?? 'INR',
      );
}

class ReviewItem {
  final String id;
  final int rating;
  final String? comment;
  final bool isPublished;
  final DateTime? createdAt;
  const ReviewItem({required this.id, required this.rating, this.comment, this.isPublished = false, this.createdAt});

  factory ReviewItem.fromJson(Map<String, dynamic> j) => ReviewItem(
        id: j['id'].toString(),
        rating: (j['rating'] as num?)?.toInt() ?? 0,
        comment: j['comment']?.toString(),
        isPublished: j['is_published'] == true,
        createdAt: j['created_at'] == null ? null : DateTime.tryParse(j['created_at'].toString()),
      );
}

class NotificationItem {
  final String id;
  final String type;
  final String title;
  final String? body;
  final bool read;
  final DateTime? createdAt;
  const NotificationItem({required this.id, required this.type, required this.title, this.body, this.read = false, this.createdAt});

  factory NotificationItem.fromJson(Map<String, dynamic> j) => NotificationItem(
        id: j['id'].toString(),
        type: j['type']?.toString() ?? 'IN_APP',
        title: j['title']?.toString() ?? '',
        body: j['body']?.toString(),
        read: j['read_at'] != null || j['read'] == true,
        createdAt: j['created_at'] == null ? null : DateTime.tryParse(j['created_at'].toString()),
      );
}

class CustomerProfile {
  final String id;
  final String fullName;
  final String? email;
  final String? phone;
  final String? companyName;
  final String? customerType;
  const CustomerProfile({required this.id, required this.fullName, this.email, this.phone, this.companyName, this.customerType});

  factory CustomerProfile.fromJson(Map<String, dynamic> j) {
    final user = j['user'] is Map ? j['user'] as Map<String, dynamic> : const {};
    return CustomerProfile(
      id: j['id'].toString(),
      fullName: (j['full_name'] ?? user['full_name'] ?? '').toString(),
      email: (j['email'] ?? user['email'])?.toString(),
      phone: (j['phone'] ?? user['phone'])?.toString(),
      companyName: j['company_name']?.toString(),
      customerType: j['customer_type']?.toString(),
    );
  }
}
