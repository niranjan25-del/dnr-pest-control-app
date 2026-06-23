// lib/features/technician/jobs/job_workflow/signature_pad.dart
//
// A self-contained signature pad (no extra package): captures strokes with CustomPaint and
// exports a transparent PNG via PictureRecorder. Used in the "Capture signature" step.

import 'dart:ui' as ui;
import 'package:flutter/material.dart';

class SignaturePadController {
  final List<List<Offset>> _strokes = [];
  List<Offset> _current = [];
  Size _size = Size.zero;

  void start(Offset p) => _current = [p];
  void append(Offset p) => _current.add(p);
  void end() {
    if (_current.isNotEmpty) _strokes.add(List.of(_current));
    _current = [];
  }

  void clear() {
    _strokes.clear();
    _current = [];
  }

  bool get isEmpty => _strokes.isEmpty && _current.isEmpty;

  /// Render the strokes to a PNG byte list.
  Future<List<int>?> exportPng() async {
    if (isEmpty || _size == Size.zero) return null;
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    final paint = Paint()
      ..color = const Color(0xFF161B21)
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    for (final stroke in [..._strokes, if (_current.isNotEmpty) _current]) {
      for (var i = 0; i < stroke.length - 1; i++) {
        canvas.drawLine(stroke[i], stroke[i + 1], paint);
      }
    }
    final picture = recorder.endRecording();
    final image = await picture.toImage(_size.width.toInt(), _size.height.toInt());
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    return bytes?.buffer.asUint8List();
  }
}

class SignaturePad extends StatefulWidget {
  final SignaturePadController controller;
  const SignaturePad({super.key, required this.controller});
  @override
  State<SignaturePad> createState() => _SignaturePadState();
}

class _SignaturePadState extends State<SignaturePad> {
  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        widget.controller._size = Size(constraints.maxWidth, 200);
        return Container(
          height: 200,
          decoration: BoxDecoration(
            border: Border.all(color: Theme.of(context).colorScheme.outline),
            borderRadius: BorderRadius.circular(12),
          ),
          child: GestureDetector(
            onPanStart: (d) => setState(() => widget.controller.start(d.localPosition)),
            onPanUpdate: (d) => setState(() => widget.controller.append(d.localPosition)),
            onPanEnd: (_) => setState(() => widget.controller.end()),
            child: CustomPaint(painter: _SignaturePainter(widget.controller), size: Size.infinite),
          ),
        );
      },
    );
  }
}

class _SignaturePainter extends CustomPainter {
  final SignaturePadController controller;
  _SignaturePainter(this.controller);
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF161B21)
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    for (final stroke in [...controller._strokes, controller._current]) {
      for (var i = 0; i < stroke.length - 1; i++) {
        canvas.drawLine(stroke[i], stroke[i + 1], paint);
      }
    }
  }

  @override
  bool shouldRepaint(_) => true;
}
