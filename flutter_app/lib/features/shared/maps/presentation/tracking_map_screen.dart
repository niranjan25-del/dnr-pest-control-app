// lib/features/shared/maps/presentation/tracking_map_screen.dart
//
// Customer-facing live tracking: technician marker on a Google Map + an ETA banner that
// updates from the Location socket (or REST poll fallback). Pass the booking id and the
// destination (service address) coordinates.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../../../core/extensions/context_extensions.dart';
import '../application/tracking_controller.dart';

class TrackingMapScreen extends ConsumerWidget {
  final String bookingId;
  final double? destLat;
  final double? destLng;
  const TrackingMapScreen({super.key, required this.bookingId, this.destLat, this.destLng});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(trackingControllerProvider(bookingId));
    final tech = state.location;
    final dest = (destLat != null && destLng != null) ? LatLng(destLat!, destLng!) : null;
    final techPos = tech != null ? LatLng(tech.latitude, tech.longitude) : null;

    final markers = <Marker>{
      if (dest != null) Marker(markerId: const MarkerId('dest'), position: dest, infoWindow: const InfoWindow(title: 'Service address')),
      if (techPos != null)
        Marker(markerId: const MarkerId('tech'), position: techPos, icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen), infoWindow: const InfoWindow(title: 'Technician')),
    };

    return Scaffold(
      appBar: AppBar(title: const Text('Track technician')),
      body: Stack(children: [
        GoogleMap(
          initialCameraPosition: CameraPosition(target: techPos ?? dest ?? const LatLng(13.0827, 80.2707), zoom: 14),
          markers: markers,
          myLocationButtonEnabled: false,
        ),
        Positioned(
          left: 16,
          right: 16,
          top: 16,
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(children: [
                Icon(state.arrived ? Icons.location_on : Icons.local_shipping_outlined, color: context.colors.primary),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    state.arrived
                        ? 'Your technician has arrived'
                        : state.eta?.pretty ?? (tech == null ? 'Waiting for technician location…' : 'On the way'),
                    style: context.text.titleSmall,
                  ),
                ),
                if (!state.connected) const Icon(Icons.sync, size: 16),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}
