// test/unit/eta_info_test.dart
//
// EtaInfo backs the technician navigation ETA banner. Its parsing and the duration/distance
// formatting + estimate flag are pure and user-visible, so they're pinned here.

import 'package:flutter_test/flutter_test.dart';
import 'package:dnr_pest_control/features/technician/shared/data/report_repository.dart';

void main() {
  group('EtaInfo.fromJson', () {
    test('parses the backend shape { distance_m, duration_s, eta, source }', () {
      final e = EtaInfo.fromJson({
        'distance_m': 5200,
        'duration_s': 600,
        'eta': '2026-06-11T10:30:00.000Z',
        'source': 'google',
      });
      expect(e.distanceMeters, 5200);
      expect(e.durationSeconds, 600);
      expect(e.arrivalAt, isNotNull);
      expect(e.source, 'google');
      expect(e.isEstimate, isFalse);
    });

    test('tolerates string numbers and missing fields, defaulting to estimate', () {
      final e = EtaInfo.fromJson({'distance_m': '800', 'duration_s': '45'});
      expect(e.distanceMeters, 800);
      expect(e.durationSeconds, 45);
      expect(e.arrivalAt, isNull);
      expect(e.source, 'estimate');
      expect(e.isEstimate, isTrue);
    });
  });

  group('EtaInfo formatting', () {
    EtaInfo eta({int d = 0, int dist = 0, String src = 'google'}) =>
        EtaInfo(distanceMeters: dist, durationSeconds: d, source: src);

    test('duration label: arriving now / minutes / hours', () {
      expect(eta(d: 20).durationLabel, 'Arriving now');   // < 1 min rounds to 0
      expect(eta(d: 600).durationLabel, '10 min');
      expect(eta(d: 3900).durationLabel, '1 h 5 min');    // 65 min
    });

    test('distance label switches from metres to kilometres', () {
      expect(eta(dist: 800).distanceLabel, '800 m');
      expect(eta(dist: 5200).distanceLabel, '5.2 km');
    });

    test('isEstimate is true for any non-google source', () {
      expect(eta(src: 'estimate').isEstimate, isTrue);
      expect(eta(src: 'google').isEstimate, isFalse);
    });
  });
}
