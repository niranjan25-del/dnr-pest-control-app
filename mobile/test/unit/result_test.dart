// test/unit/result_test.dart
//
// The Result<T> sealed type is the contract between repositories and the UI, so its
// pattern-matching and accessors must be airtight.

import 'package:flutter_test/flutter_test.dart';
import 'package:dnr_pest_control/core/network/result.dart';
import 'package:dnr_pest_control/core/error/failures.dart';

void main() {
  group('Result', () {
    test('Success exposes data and matches the success branch', () {
      const Result<int> r = Success(42);
      expect(r.isSuccess, isTrue);
      expect(r.dataOrNull, 42);
      expect(r.failureOrNull, isNull);
      final mapped = r.when(success: (d) => 'ok:$d', failure: (_) => 'err');
      expect(mapped, 'ok:42');
    });

    test('FailureResult exposes failure and matches the failure branch', () {
      final failure = const NetworkFailure('offline');
      final Result<int> r = FailureResult(failure);
      expect(r.isSuccess, isFalse);
      expect(r.dataOrNull, isNull);
      expect(r.failureOrNull, same(failure));
      final mapped = r.when(success: (_) => 'ok', failure: (f) => 'err:${f.message}');
      expect(mapped, 'err:offline');
    });
  });
}
