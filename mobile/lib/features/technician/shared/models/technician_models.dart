// lib/features/technician/shared/models/technician_models.dart
//
// Technician-side models: profile, a Job (assigned booking + customer/address/access),
// the job status workflow, and the report draft + chemical entries. Money/dates parsed
// defensively from snake_case JSON.

class TechnicianProfile {
  final String id;
  final String fullName;
  final String? email;
  final String? phone;
  final String? licenseNumber;
  final DateTime? licenseExpiry;
  final List<String> skills;
  final bool isAvailable;

  const TechnicianProfile({
    required this.id,
    required this.fullName,
    this.email,
    this.phone,
    this.licenseNumber,
    this.licenseExpiry,
    this.skills = const [],
    this.isAvailable = false,
  });

  factory TechnicianProfile.fromJson(Map<String, dynamic> j) {
    final user = j['user'] is Map ? j['user'] as Map<String, dynamic> : const {};
    return TechnicianProfile(
      id: j['id'].toString(),
      fullName: (j['full_name'] ?? user['full_name'] ?? '').toString(),
      email: (j['email'] ?? user['email'])?.toString(),
      phone: (j['phone'] ?? user['phone'])?.toString(),
      licenseNumber: j['license_number']?.toString(),
      licenseExpiry: j['license_expiry'] == null ? null : DateTime.tryParse(j['license_expiry'].toString()),
      skills: (j['skills'] as List? ?? const []).map((e) => e.toString()).toList(),
      isAvailable: j['is_available'] == true,
    );
  }
}

/// Canonical job status order for a technician's workflow.
enum JobStatus { pending, confirmed, enRoute, arrived, inProgress, completed, other }

JobStatus jobStatusFrom(String? raw) {
  switch (raw?.toUpperCase()) {
    case 'PENDING':
      return JobStatus.pending;
    case 'CONFIRMED':
      return JobStatus.confirmed;
    case 'EN_ROUTE':
      return JobStatus.enRoute;
    case 'ARRIVED':
      return JobStatus.arrived;
    case 'IN_PROGRESS':
      return JobStatus.inProgress;
    case 'COMPLETED':
      return JobStatus.completed;
    default:
      return JobStatus.other;
  }
}

extension JobStatusX on JobStatus {
  String get apiValue => switch (this) {
        JobStatus.enRoute => 'EN_ROUTE',
        JobStatus.arrived => 'ARRIVED',
        JobStatus.inProgress => 'IN_PROGRESS',
        JobStatus.completed => 'COMPLETED',
        JobStatus.confirmed => 'CONFIRMED',
        JobStatus.pending => 'PENDING',
        JobStatus.other => 'OTHER',
      };
  String get label => switch (this) {
        JobStatus.pending => 'Pending',
        JobStatus.confirmed => 'Accepted',
        JobStatus.enRoute => 'En route',
        JobStatus.arrived => 'Arrived',
        JobStatus.inProgress => 'In progress',
        JobStatus.completed => 'Completed',
        JobStatus.other => 'Unknown',
      };
}

class Job {
  final String id;
  final String? assignmentId;
  final String? assignmentStatus; // ASSIGNED/ACCEPTED/...
  final JobStatus status;
  final String? serviceName;
  final List<String> targetPests;
  final String? customerName;
  final String? customerPhone;
  final String? addressLabel;
  final String? addressLine;
  final double? latitude;
  final double? longitude;
  final String? gateCode;
  final String? accessNotes;
  final DateTime? windowStart;
  final DateTime? windowEnd;

  const Job({
    required this.id,
    required this.status,
    this.assignmentId,
    this.assignmentStatus,
    this.serviceName,
    this.targetPests = const [],
    this.customerName,
    this.customerPhone,
    this.addressLabel,
    this.addressLine,
    this.latitude,
    this.longitude,
    this.gateCode,
    this.accessNotes,
    this.windowStart,
    this.windowEnd,
  });

  bool get isToday {
    final s = windowStart;
    if (s == null) return false;
    final now = DateTime.now();
    return s.year == now.year && s.month == now.month && s.day == now.day;
  }

  bool get needsAcceptance => (assignmentStatus?.toUpperCase() == 'ASSIGNED');
  bool get isActive => const [JobStatus.confirmed, JobStatus.enRoute, JobStatus.arrived, JobStatus.inProgress].contains(status);

  static double? _d(dynamic v) => v == null ? null : double.tryParse(v.toString());
  static DateTime? _date(dynamic v) => v == null ? null : DateTime.tryParse(v.toString())?.toLocal();

  factory Job.fromJson(Map<String, dynamic> j) {
    final addr = j['address'] is Map ? j['address'] as Map<String, dynamic> : const {};
    final cust = j['customer'] is Map ? j['customer'] as Map<String, dynamic> : const {};
    final custUser = cust['user'] is Map ? cust['user'] as Map<String, dynamic> : const {};
    final svc = j['service'] is Map ? j['service'] as Map<String, dynamic> : const {};
    final assignment = j['assignment'] is Map ? j['assignment'] as Map<String, dynamic> : const {};
    return Job(
      id: j['id'].toString(),
      assignmentId: (assignment['id'] ?? j['assignment_id'])?.toString(),
      assignmentStatus: (assignment['status'] ?? j['assignment_status'])?.toString(),
      status: jobStatusFrom(j['status']?.toString()),
      serviceName: (svc['name'] ?? j['service_name'])?.toString(),
      targetPests: (svc['target_pests'] as List? ?? const []).map((e) => e.toString()).toList(),
      customerName: (cust['full_name'] ?? custUser['full_name'] ?? j['customer_name'])?.toString(),
      customerPhone: (cust['phone'] ?? custUser['phone'])?.toString(),
      addressLabel: addr['label']?.toString(),
      addressLine: (addr['line1'] ?? j['address_line'])?.toString(),
      latitude: _d(addr['latitude']),
      longitude: _d(addr['longitude']),
      gateCode: addr['gate_code']?.toString(),
      accessNotes: addr['access_notes']?.toString(),
      windowStart: _date(j['scheduled_window_start']),
      windowEnd: _date(j['scheduled_window_end']),
    );
  }
}

class ChemicalEntry {
  final String productName;
  final String? epaRegistrationNumber;
  final String? targetPest;
  final double quantityUsed;
  final String unit;
  final String? applicationMethod;
  final DateTime appliedAt;

  ChemicalEntry({
    required this.productName,
    required this.quantityUsed,
    required this.unit,
    this.epaRegistrationNumber,
    this.targetPest,
    this.applicationMethod,
    DateTime? appliedAt,
  }) : appliedAt = appliedAt ?? DateTime.now();

  Map<String, dynamic> toJson() => {
        'product_name': productName,
        if (epaRegistrationNumber != null) 'epa_registration_number': epaRegistrationNumber,
        if (targetPest != null) 'target_pest': targetPest,
        'quantity_used': quantityUsed,
        'unit': unit,
        if (applicationMethod != null) 'application_method': applicationMethod,
        'applied_at': appliedAt.toUtc().toIso8601String(),
      };
}
