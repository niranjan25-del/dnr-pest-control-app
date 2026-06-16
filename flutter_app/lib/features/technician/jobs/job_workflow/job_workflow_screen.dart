// lib/features/technician/jobs/job_workflow/job_workflow_screen.dart
//
// The on-site job workflow as a guided checklist. Status steps (accept/en route/arrived/
// start/complete) call the workflow controller; the report steps (before photos → notes →
// after photos → signature → submit) build the report draft and submit it before
// completion. Everything is offline-tolerant via the controllers' outbox behavior.

import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import '../../../../core/extensions/context_extensions.dart';
import '../../shared/application/technician_providers.dart';
import '../../shared/models/technician_models.dart';
import 'job_workflow_controller.dart';
import 'report_builder_controller.dart';
import 'signature_pad.dart';

class JobWorkflowScreen extends ConsumerStatefulWidget {
  final String bookingId;
  const JobWorkflowScreen({super.key, required this.bookingId});
  @override
  ConsumerState<JobWorkflowScreen> createState() => _JobWorkflowScreenState();
}

class _JobWorkflowScreenState extends ConsumerState<JobWorkflowScreen> {
  final _sig = SignaturePadController();
  final _signerName = TextEditingController();

  @override
  void dispose() {
    _signerName.dispose();
    super.dispose();
  }

  JobWorkflowController get _wf => ref.read(jobWorkflowControllerProvider.notifier);
  ReportBuilderController get _report => ref.read(reportBuilderControllerProvider.notifier);

  Future<void> _pickPhotos({required bool before}) async {
    final picked = await ImagePicker().pickMultiImage(imageQuality: 70);
    if (picked.isEmpty) return;
    final files = picked.map((x) => File(x.path)).toList();
    _report.update((d) => before ? d.copyWith(beforePhotos: [...d.beforePhotos, ...files]) : d.copyWith(afterPhotos: [...d.afterPhotos, ...files]));
  }

  @override
  Widget build(BuildContext context) {
    final job = ref.watch(jobByIdProvider(widget.bookingId));
    ref.listen(jobWorkflowControllerProvider, (_, n) {
      if (n.isFailure) context.showSnack(n.failure?.message ?? 'Action failed');
    });

    return Scaffold(
      appBar: AppBar(title: const Text('Job workflow')),
      body: job.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Could not load job: $e')),
        data: (j) => _buildSteps(j),
      ),
    );
  }

  Widget _buildSteps(Job j) {
    final status = j.status;
    final wfState = ref.watch(jobWorkflowControllerProvider);
    final report = ref.watch(reportBuilderControllerProvider);
    final busy = wfState.isSubmitting || report.submission.isSubmitting;

    final steps = <Widget>[
      _StepCard(
        index: 1,
        title: 'Job details',
        child: _JobSummary(j),
      ),
      if (j.needsAcceptance)
        _ActionCard(
          index: 2,
          title: 'Accept job',
          action: 'Accept',
          secondary: 'Decline',
          busy: busy,
          onAction: () => _wf.accept(j.id),
          onSecondary: () => _wf.decline(j.id),
        ),
      _statusAction(3, 'On my way', JobStatus.enRoute, enabled: status.index < JobStatus.enRoute.index, busy: busy, bookingId: j.id),
      _statusAction(4, 'I have arrived', JobStatus.arrived, enabled: status == JobStatus.enRoute, busy: busy, bookingId: j.id),
      _statusAction(5, 'Start service', JobStatus.inProgress, enabled: status == JobStatus.arrived, busy: busy, bookingId: j.id),
      // Report capture (6–10) — available once on site.
      _StepCard(index: 6, title: 'Before photos', child: _PhotoRow(report.draft.beforePhotos, () => _pickPhotos(before: true))),
      _StepCard(index: 7, title: 'Treatment notes & chemicals', child: _NotesAndChemicals(onChanged: _report.update)),
      _StepCard(index: 8, title: 'After photos', child: _PhotoRow(report.draft.afterPhotos, () => _pickPhotos(before: false))),
      _StepCard(index: 9, title: 'Customer signature', child: _SignatureSection(_sig, _signerName, onName: (v) => _report.update((d) => d.copyWith(signerName: v)))),
      _ActionCard(
        index: 10,
        title: 'Submit report',
        action: 'Submit report',
        busy: busy,
        onAction: () async {
          // Capture signature bytes at submit time.
          final png = await _sig.exportPng();
          if (png != null) _report.update((d) => d.copyWith(signatureBytes: Uint8List.fromList(png)));
          final ok = await _report.submit(j.id);
          if (ok && mounted) context.showSnack('Report submitted (or queued if offline)');
        },
      ),
      _statusAction(11, 'Complete job', JobStatus.completed, enabled: status == JobStatus.inProgress, busy: busy, bookingId: j.id, onDone: () {
        if (mounted) context.go('/technician');
      }),
    ];

    return ListView(padding: const EdgeInsets.all(16), children: [
      _StatusBanner(status),
      const SizedBox(height: 12),
      ...steps,
    ]);
  }

  Widget _statusAction(int i, String title, JobStatus to, {required bool enabled, required bool busy, required String bookingId, VoidCallback? onDone}) {
    return _ActionCard(
      index: i,
      title: title,
      action: title,
      busy: busy,
      enabled: enabled,
      onAction: () async {
        final ok = await _wf.transition(bookingId: bookingId, to: to);
        if (ok) onDone?.call();
      },
    );
  }
}

class _StatusBanner extends StatelessWidget {
  final JobStatus status;
  const _StatusBanner(this.status);
  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: context.colors.secondaryContainer, borderRadius: BorderRadius.circular(12)),
        child: Text('Current status: ${status.label}', style: context.text.titleSmall),
      );
}

class _StepCard extends StatelessWidget {
  final int index;
  final String title;
  final Widget child;
  const _StepCard({required this.index, required this.title, required this.child});
  @override
  Widget build(BuildContext context) => Card(
        margin: const EdgeInsets.only(bottom: 12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [CircleAvatar(radius: 12, child: Text('$index', style: const TextStyle(fontSize: 11))), const SizedBox(width: 8), Text(title, style: context.text.titleMedium)]),
            const SizedBox(height: 12),
            child,
          ]),
        ),
      );
}

class _ActionCard extends StatelessWidget {
  final int index;
  final String title;
  final String action;
  final String? secondary;
  final bool busy;
  final bool enabled;
  final VoidCallback onAction;
  final VoidCallback? onSecondary;
  const _ActionCard({
    required this.index,
    required this.title,
    required this.action,
    required this.busy,
    this.enabled = true,
    required this.onAction,
    this.secondary,
    this.onSecondary,
  });
  @override
  Widget build(BuildContext context) => _StepCard(
        index: index,
        title: title,
        child: Row(children: [
          Expanded(
            child: FilledButton(onPressed: enabled && !busy ? onAction : null, child: Text(action)),
          ),
          if (secondary != null) ...[
            const SizedBox(width: 12),
            Expanded(child: OutlinedButton(onPressed: enabled && !busy ? onSecondary : null, child: Text(secondary!))),
          ],
        ]),
      );
}

class _JobSummary extends StatelessWidget {
  final Job j;
  const _JobSummary(this.j);
  @override
  Widget build(BuildContext context) {
    Widget row(IconData i, String v) => Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [Icon(i, size: 18), const SizedBox(width: 8), Expanded(child: Text(v))]));
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      row(Icons.pest_control_outlined, j.serviceName ?? 'Service'),
      row(Icons.person_outline, j.customerName ?? '—'),
      row(Icons.location_on_outlined, j.addressLine ?? '—'),
      if (j.windowStart != null) row(Icons.schedule, '${j.windowStart}'.split('.').first),
      if (j.gateCode != null) row(Icons.vpn_key_outlined, 'Gate: ${j.gateCode}'),
      if (j.accessNotes != null) row(Icons.sticky_note_2_outlined, j.accessNotes!),
    ]);
  }
}

class _PhotoRow extends StatelessWidget {
  final List<File> photos;
  final VoidCallback onAdd;
  const _PhotoRow(this.photos, this.onAdd);
  @override
  Widget build(BuildContext context) => Wrap(spacing: 8, runSpacing: 8, children: [
        ...photos.map((f) => ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.file(f, width: 80, height: 80, fit: BoxFit.cover))),
        InkWell(
          onTap: onAdd,
          child: Container(width: 80, height: 80, decoration: BoxDecoration(border: Border.all(color: context.colors.outline), borderRadius: BorderRadius.circular(8)), child: const Icon(Icons.add_a_photo_outlined)),
        ),
      ]);
}

class _NotesAndChemicals extends ConsumerStatefulWidget {
  final void Function(ReportDraft Function(ReportDraft)) onChanged;
  const _NotesAndChemicals({required this.onChanged});
  @override
  ConsumerState<_NotesAndChemicals> createState() => _NotesAndChemicalsState();
}

class _NotesAndChemicalsState extends ConsumerState<_NotesAndChemicals> {
  final _summary = TextEditingController();
  final _product = TextEditingController();
  final _epa = TextEditingController();
  final _qty = TextEditingController();
  final _unit = TextEditingController(text: 'L');

  @override
  void dispose() {
    for (final c in [_summary, _product, _epa, _qty, _unit]) {
      c.dispose();
    }
    super.dispose();
  }

  void _addChemical() {
    final qty = double.tryParse(_qty.text);
    if (_product.text.trim().isEmpty || qty == null) {
      context.showSnack('Product name and quantity are required');
      return;
    }
    final entry = ChemicalEntry(
      productName: _product.text.trim(),
      epaRegistrationNumber: _epa.text.trim().isEmpty ? null : _epa.text.trim(),
      quantityUsed: qty,
      unit: _unit.text.trim(),
    );
    widget.onChanged((d) => d.copyWith(chemicals: [...d.chemicals, entry]));
    _product.clear();
    _epa.clear();
    _qty.clear();
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final chemicals = ref.watch(reportBuilderControllerProvider).draft.chemicals;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      TextField(
        controller: _summary,
        maxLines: 3,
        decoration: const InputDecoration(hintText: 'Treatment summary / observations'),
        onChanged: (v) => widget.onChanged((d) => d.copyWith(summary: v)),
      ),
      const SizedBox(height: 16),
      Text('Products / chemicals used', style: context.text.labelLarge),
      const SizedBox(height: 8),
      ...chemicals.map((c) => ListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.science_outlined),
            title: Text(c.productName),
            subtitle: Text('${c.quantityUsed} ${c.unit}${c.epaRegistrationNumber != null ? ' • EPA ${c.epaRegistrationNumber}' : ''}'),
          )),
      Row(children: [
        Expanded(flex: 3, child: TextField(controller: _product, decoration: const InputDecoration(labelText: 'Product'))),
        const SizedBox(width: 8),
        Expanded(flex: 2, child: TextField(controller: _qty, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Qty'))),
        const SizedBox(width: 8),
        SizedBox(width: 56, child: TextField(controller: _unit, decoration: const InputDecoration(labelText: 'Unit'))),
      ]),
      TextField(controller: _epa, decoration: const InputDecoration(labelText: 'EPA reg # (optional)')),
      const SizedBox(height: 8),
      OutlinedButton.icon(onPressed: _addChemical, icon: const Icon(Icons.add), label: const Text('Add chemical')),
    ]);
  }
}

class _SignatureSection extends StatelessWidget {
  final SignaturePadController controller;
  final TextEditingController signerName;
  final ValueChanged<String> onName;
  const _SignatureSection(this.controller, this.signerName, {required this.onName});
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        TextField(controller: signerName, decoration: const InputDecoration(labelText: 'Signer name'), onChanged: onName),
        const SizedBox(height: 12),
        SignaturePad(controller: controller),
        const SizedBox(height: 8),
        Align(alignment: Alignment.centerRight, child: TextButton.icon(onPressed: () => controller.clear(), icon: const Icon(Icons.clear), label: const Text('Clear'))),
      ]);
}
