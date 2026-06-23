// lib/features/technician/navigation/navigation_screen.dart
//
// Shows the job site on a Google Map with the technician's current position, and an "Open
// in Maps" action that hands off turn-by-turn to the device's maps app via a geo: / Apple
// Maps URL (launched through the platform — no extra coupling). Live location pings to the
// backend are handled by LocationTrackingService once the job is en route.

import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/extensions/context_extensions.dart';
import '../../../shared/widgets/state_views.dart';
import '../shared/application/technician_providers.dart';
import '../shared/models/technician_models.dart';

class NavigationScreen extends ConsumerWidget {
  final String bookingId;
  const NavigationScreen({super.key, required this.bookingId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final job = ref.watch(jobByIdProvider(bookingId));
    return Scaffold(
      appBar: AppBar(title: const Text('Navigate')),
      body: job.when(
        loading: () => const LoadingView(),
        error: (_, __) => const ErrorView(message: 'Could not load job'),
        data: (j) {
          if (j.latitude == null || j.longitude == null) {
            return const EmptyView(icon: Icons.location_off_outlined, title: 'No location for this job');
          }
          final target = LatLng(j.latitude!, j.longitude!);
          return Stack(children: [
            GoogleMap(
              initialCameraPosition: CameraPosition(target: target, zoom: 15),
              myLocationEnabled: true,
              myLocationButtonEnabled: true,
              markers: {Marker(markerId: MarkerId(j.id), position: target, infoWindow: InfoWindow(title: j.addressLabel ?? 'Job site', snippet: j.addressLine))},
            ),
            Positioned(left: 16, right: 16, top: 16, child: _EtaBanner(bookingId: bookingId)),
            Positioned(
              left: 16,
              right: 16,
              bottom: 24,
              child: FilledButton.icon(
                onPressed: () => _openExternal(context, j),
                icon: const Icon(Icons.directions),
                label: const Text('Open in Maps'),
              ),
            ),
          ]);
        },
      ),
    );
  }

  Future<void> _openExternal(BuildContext context, Job j) async {
    // Hand off turn-by-turn to the platform maps app: Apple Maps on iOS, Google Maps
    // (geo: intent / universal URL) on Android, with a web fallback.
    final lat = j.latitude, lng = j.longitude;
    final label = Uri.encodeComponent(j.addressLabel ?? 'Job site');
    final candidates = <Uri>[
      if (Platform.isIOS) Uri.parse('https://maps.apple.com/?daddr=$lat,$lng&q=$label'),
      if (Platform.isAndroid) Uri.parse('google.navigation:q=$lat,$lng'),
      Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng'),
    ];
    for (final uri in candidates) {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
        return;
      }
    }
    if (context.mounted) context.showSnack('No maps app available to open directions.');
  }
}

/// Live ETA chip shown over the map. Silent (renders nothing) while loading or if ETA is
/// unavailable, so it never blocks navigation. Tag marks straight-line estimates.
class _EtaBanner extends ConsumerWidget {
  final String bookingId;
  const _EtaBanner({required this.bookingId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eta = ref.watch(etaProvider(bookingId));
    return eta.maybeWhen(
      data: (e) => Material(
        elevation: 2,
        borderRadius: BorderRadius.circular(12),
        color: context.colors.surface,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(children: [
            Icon(Icons.navigation_outlined, color: context.colors.primary),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                '${e.durationLabel} • ${e.distanceLabel}${e.isEstimate ? '  (estimate)' : ''}',
                style: context.text.titleSmall?.copyWith(fontWeight: FontWeight.w600),
              ),
            ),
            IconButton(
              tooltip: 'Refresh ETA',
              icon: const Icon(Icons.refresh),
              onPressed: () => ref.invalidate(etaProvider(bookingId)),
            ),
          ]),
        ),
      ),
      orElse: () => const SizedBox.shrink(),
    );
  }
}
