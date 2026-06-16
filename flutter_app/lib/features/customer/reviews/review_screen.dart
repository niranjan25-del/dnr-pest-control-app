// lib/features/customer/reviews/review_screen.dart
//
// Submit a rating + comment for a completed booking (POST /reviews). Server moderates
// before publishing; we surface that to set expectations.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/extensions/context_extensions.dart';
import '../../../shared/state/submission_state.dart';
import '../shared/application/customer_providers.dart';

class ReviewScreen extends ConsumerStatefulWidget {
  final String bookingId;
  const ReviewScreen({super.key, required this.bookingId});
  @override
  ConsumerState<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends ConsumerState<ReviewScreen> {
  int _rating = 0;
  final _comment = TextEditingController();
  SubmissionState _state = const SubmissionState.idle();

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_rating == 0) {
      context.showSnack('Please choose a rating');
      return;
    }
    setState(() => _state = const SubmissionState.submitting());
    final res = await ref
        .read(accountRepositoryProvider)
        .submitReview(bookingId: widget.bookingId, rating: _rating, comment: _comment.text.trim());
    if (!mounted) return;
    res.when(
      success: (_) {
        context.showSnack('Thanks! Your review is pending moderation.');
        context.pop();
      },
      failure: (f) {
        setState(() => _state = SubmissionState.error(f));
        context.showSnack(f.message);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Leave a review')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('How was your service?', style: context.text.titleLarge),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(5, (i) {
                  final filled = i < _rating;
                  return IconButton(
                    iconSize: 40,
                    icon: Icon(filled ? Icons.star : Icons.star_border, color: context.colors.primary),
                    onPressed: () => setState(() => _rating = i + 1),
                  );
                }),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _comment,
                maxLines: 5,
                decoration: const InputDecoration(hintText: 'Share details of your experience (optional)'),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _state.isSubmitting ? null : _submit,
                child: _state.isSubmitting
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2.5))
                    : const Text('Submit review'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
