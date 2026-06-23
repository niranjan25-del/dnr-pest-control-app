// lib/features/customer/bookings/booking_flow/booking_draft_controller.dart
//
// Holds the in-progress booking across the 10-step wizard, validates each step's
// readiness, and performs the final create→invoice→pay→confirm sequence. Photos/notes are
// collected here; photo upload reuses the Media endpoints (wired when the booking id
// exists — kept as local paths in the draft until then).

import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/result.dart';
import '../../../../shared/state/submission_state.dart';
import '../../shared/application/customer_providers.dart';
import '../../shared/models/customer_models.dart';

/// One-time vs recurring choice for the "package" step (MVP routes one-time via service).
enum BookingMode { oneTime, recurring }

class BookingDraft {
  final BookingMode mode;
  final Service? service;
  final String? pestType;
  final ServicePackage? package;
  final Address? address;
  final DateTime? windowStart;
  final DateTime? windowEnd;
  final List<File> photos;
  final String? notes;
  final String? couponCode;

  const BookingDraft({
    this.mode = BookingMode.oneTime,
    this.service,
    this.pestType,
    this.package,
    this.address,
    this.windowStart,
    this.windowEnd,
    this.photos = const [],
    this.notes,
    this.couponCode,
  });

  BookingDraft copyWith({
    BookingMode? mode,
    Service? service,
    String? pestType,
    ServicePackage? package,
    Address? address,
    DateTime? windowStart,
    DateTime? windowEnd,
    List<File>? photos,
    String? notes,
    String? couponCode,
  }) =>
      BookingDraft(
        mode: mode ?? this.mode,
        service: service ?? this.service,
        pestType: pestType ?? this.pestType,
        package: package ?? this.package,
        address: address ?? this.address,
        windowStart: windowStart ?? this.windowStart,
        windowEnd: windowEnd ?? this.windowEnd,
        photos: photos ?? this.photos,
        notes: notes ?? this.notes,
        couponCode: couponCode ?? this.couponCode,
      );

  bool get hasService => service != null;
  bool get hasAddress => address != null;
  bool get hasSchedule => windowStart != null && windowEnd != null;
  bool get readyToReview => hasService && hasAddress && hasSchedule;
}

class BookingFlowState {
  final BookingDraft draft;
  final SubmissionState submission;
  final Booking? createdBooking;
  const BookingFlowState({this.draft = const BookingDraft(), this.submission = const SubmissionState.idle(), this.createdBooking});

  BookingFlowState copyWith({BookingDraft? draft, SubmissionState? submission, Booking? createdBooking}) =>
      BookingFlowState(draft: draft ?? this.draft, submission: submission ?? this.submission, createdBooking: createdBooking ?? this.createdBooking);
}

class BookingDraftController extends StateNotifier<BookingFlowState> {
  final Ref _ref;
  BookingDraftController(this._ref) : super(const BookingFlowState());

  void update(BookingDraft Function(BookingDraft) fn) => state = state.copyWith(draft: fn(state.draft));
  void reset() => state = const BookingFlowState();

  /// Creates the booking. Payment is handled separately by the payment step (which reads
  /// [createdBooking]). Returns the created booking on success.
  Future<Booking?> submitBooking() async {
    final d = state.draft;
    if (!d.readyToReview) return null;
    state = state.copyWith(submission: const SubmissionState.submitting());
    final key = 'booking-${DateTime.now().millisecondsSinceEpoch}-${d.service!.id}';
    final result = await _ref.read(bookingRepositoryProvider).create(
          serviceId: d.service!.id,
          addressId: d.address!.id,
          windowStart: d.windowStart!,
          windowEnd: d.windowEnd!,
          couponCode: d.couponCode,
          notes: d.notes,
          idempotencyKey: key,
        );
    return result.when(
      success: (b) {
        state = state.copyWith(submission: const SubmissionState.success(), createdBooking: b);
        return b;
      },
      failure: (f) {
        state = state.copyWith(submission: SubmissionState.error(f));
        return null;
      },
    );
  }
}

final bookingDraftControllerProvider =
    StateNotifierProvider.autoDispose<BookingDraftController, BookingFlowState>((ref) => BookingDraftController(ref));
